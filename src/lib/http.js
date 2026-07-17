import * as cheerio from "cheerio";
import { config } from "../config.js";
import { cache } from "./cache.js";
import { UpstreamError } from "./errors.js";

let requestChain = Promise.resolve();
let lastRequestStartedAt = 0;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function safeElCinemaUrl(pathname) {
  const url = new URL(pathname, config.baseUrl);
  if (url.origin !== config.baseUrl) {
    throw new UpstreamError("Blocked an unexpected upstream URL.");
  }
  return url;
}

function headers(extra = {}) {
  return {
    accept: "text/html,application/xhtml+xml",
    "accept-language": "en-US,en;q=0.9",
    "user-agent": config.userAgent,
    ...extra,
  };
}

async function queuedFetch(url, options = {}) {
  const run = requestChain.then(async () => {
    const waitFor = Math.max(0, config.minRequestIntervalMs - (Date.now() - lastRequestStartedAt));
    if (waitFor) await delay(waitFor);
    lastRequestStartedAt = Date.now();

    let response;
    try {
      response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(config.requestTimeoutMs),
        ...options,
      });
    } catch (error) {
      throw new UpstreamError("Could not connect to elCinema.", { cause: error.message });
    }

    if (!response.ok) {
      throw new UpstreamError(`elCinema returned HTTP ${response.status}.`, {
        upstreamStatus: response.status,
      });
    }
    return response;
  });

  requestChain = run.catch(() => undefined);
  return run;
}

export async function getHtml(pathname, { ttlMs = config.cacheTtlMs } = {}) {
  const url = safeElCinemaUrl(pathname);
  const key = `GET:${url}`;
  const cached = cache.get(key);
  if (cached) return { html: cached, cache: "hit", url: url.toString() };

  const response = await queuedFetch(url, { headers: headers() });
  const html = await response.text();
  cache.set(key, html, ttlMs);
  return { html, cache: "miss", url: url.toString() };
}

function extractCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";", 1)[0])
      .join("; ");
  }
  const cookie = response.headers.get("set-cookie");
  return cookie ? cookie.split(";", 1)[0] : "";
}

async function openTheaterSession(theaterId) {
  const key = `SESSION:theater:${theaterId}`;
  const cached = cache.get(key);
  if (cached) return { ...cached, cache: "hit" };

  const url = safeElCinemaUrl(`/en/theater/${theaterId}/`);
  const response = await queuedFetch(url, { headers: headers() });
  const html = await response.text();
  const $ = cheerio.load(html);
  const csrfToken = $('meta[name="csrf-token"]').attr("content");
  const cookie = extractCookies(response);

  if (!csrfToken || !cookie) {
    throw new UpstreamError("Could not create the temporary elCinema session needed for prices.");
  }

  const session = { html, csrfToken, cookie, url: url.toString() };
  cache.set(key, session, Math.min(config.cacheTtlMs, 10 * 60 * 1000));
  return { ...session, cache: "miss" };
}

export async function getTheaterDetailsHtml(theaterId) {
  const session = await openTheaterSession(theaterId);
  return { html: session.html, cache: session.cache };
}

export async function getTheaterShowtimesHtml(theaterId, date) {
  const resultKey = `THEATER:${theaterId}:${date}`;
  const cached = cache.get(resultKey);
  if (cached) return { html: cached, cache: "hit" };

  let session = await openTheaterSession(theaterId);
  const $ = cheerio.load(session.html);
  const selectedDate = $("#theater-showtimes-date-selector option[selected]").attr("value");

  if (selectedDate === date) {
    cache.set(resultKey, session.html, Math.min(config.cacheTtlMs, 10 * 60 * 1000));
    return { html: session.html, cache: session.cache };
  }

  const endpoint = safeElCinemaUrl("/en/theater/ajax_show");
  const body = new URLSearchParams({ date, id: theaterId });

  let response = await queuedFetch(endpoint, {
    method: "POST",
    headers: headers({
      "content-type": "application/x-www-form-urlencoded",
      "x-csrf-token": session.csrfToken,
      cookie: session.cookie,
      referer: session.url,
    }),
    body,
  });

  if (response.status === 403 || response.status === 422) {
    cache.delete(`SESSION:theater:${theaterId}`);
    session = await openTheaterSession(theaterId);
    response = await queuedFetch(endpoint, {
      method: "POST",
      headers: headers({
        "content-type": "application/x-www-form-urlencoded",
        "x-csrf-token": session.csrfToken,
        cookie: session.cookie,
        referer: session.url,
      }),
      body,
    });
  }

  const html = await response.text();
  cache.set(resultKey, html, Math.min(config.cacheTtlMs, 10 * 60 * 1000));
  return { html, cache: "miss" };
}
