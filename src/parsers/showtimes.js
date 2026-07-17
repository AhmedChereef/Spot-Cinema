import * as cheerio from "cheerio";
import {
  absoluteElCinemaUrl,
  cleanText,
  normalizeTime,
  parseId,
  showtimeDateTime,
} from "./helpers.js";

function movieTitle($, movieId) {
  const breadcrumb = $(`.breadcrumbs a[href="/en/work/${movieId}"]`).first().text();
  const cleaned = cleanText(breadcrumb).replace(/^Movie\s*-\s*/i, "").replace(/\s*-\s*\d{4}\s*$/, "");
  if (cleaned) return cleaned;

  return cleanText($("title").text())
    .replace(/^Watch in Cinemas:\s*/i, "")
    .replace(/^Movie\s*-\s*/i, "")
    .replace(/\s*-\s*\d{4}\s*$/, "");
}

export function parseMovieShowtimes(html, movieId) {
  const $ = cheerio.load(html);
  const dates = [];

  $('div.content[id^="wtheater"]').each((_, panel) => {
    const dateId = $(panel).attr("id")?.replace("wtheater", "") || "";
    if (!/^\d{8}$/.test(dateId)) return;
    const date = `${dateId.slice(0, 4)}-${dateId.slice(4, 6)}-${dateId.slice(6, 8)}`;
    const cinemas = [];

    $(panel)
      .children(".row")
      .each((__, rowElement) => {
        const row = $(rowElement);
        const theaterLink = row.find('a[href*="/theater/"]').filter((___, a) => /\/theater\/\d+/.test($(a).attr("href") || "")).first();
        const theaterHref = theaterLink.attr("href");
        const theaterId = parseId(theaterHref, "theater");
        if (!theaterId) return;

        const times = row
          .find("ul.list-separator > li")
          .map((___, item) => normalizeTime($(item).clone().children().remove().end().text()))
          .get()
          .filter(Boolean)
          .map((time) => ({
            time: time.display,
            time24: time.time24,
            ...showtimeDateTime(date, time),
          }));
        if (!times.length) return;

        const bookingHref = row.find('a[href*="/booking/"]').first().attr("href");
        cinemas.push({
          theaterId,
          theater: cleanText(theaterLink.text()),
          theaterUrl: absoluteElCinemaUrl(theaterHref),
          bookingUrl: absoluteElCinemaUrl(bookingHref),
          showtimes: times,
          pricesStatus: "not_requested",
        });
      });

    dates.push({ date, cinemas });
  });

  return {
    movie: {
      id: String(movieId),
      title: movieTitle($, movieId),
      url: absoluteElCinemaUrl(`/en/work/${movieId}/`),
      poster: $("meta[property='og:image']").attr("content") || null,
    },
    availableDates: dates.map((item) => item.date),
    dates,
  };
}

export function parseTheaterMoviePrices(html, movieId, date) {
  const $ = cheerio.load(html);
  let movieRow = null;

  $(`a[href^="/en/work/${movieId}"]`).each((_, link) => {
    const candidate = $(link).closest(".row");
    if (candidate.find("table.showtimes").length) {
      movieRow = candidate;
      return false;
    }
  });

  if (!movieRow) return [];
  const sessions = [];

  movieRow.find(".swiper-slide").each((_, slideElement) => {
    const slide = $(slideElement);
    const experience = cleanText(slide.find("h6.section-title strong").first().text()) || "Standard";

    slide.find("table.showtimes tr").each((__, rowElement) => {
      const row = $(rowElement);
      const normalized = normalizeTime(row.find("td strong").first().text());
      if (!normalized) return;
      const priceText = cleanText(row.find(".price").first().text());
      const priceMatch = priceText.match(/([\d,.]+)\s*([A-Za-z]+)/);
      const dateTime = showtimeDateTime(date, normalized);

      sessions.push({
        time: normalized.display,
        time24: normalized.time24,
        ...dateTime,
        experience,
        price: priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null,
        currency: priceMatch?.[2]?.toUpperCase() || null,
      });
    });
  });

  return sessions;
}

export function parseTheaterDetails(html, theaterId) {
  const $ = cheerio.load(html);
  const info = $('a[href="#google-map-theater"]').closest("ul.unstyled.no-margin");
  const addressItem = info.children("li").first();
  const address = cleanText(addressItem.text()) || null;
  const phoneItem = info.find("li").filter((_, item) => $(item).find(".fa-phone").length).first();
  const phone = cleanText(phoneItem.text()) || null;
  const location = { country: null, city: null, area: null };

  info.find('a[href*="/theater/1"]').each((_, link) => {
    const href = $(link).attr("href") || "";
    const name = cleanText($(link).text());
    let match = href.match(/\/theater\/1\/(\d+)\/(\d+)\/?$/);
    if (match) {
      location.area = { id: match[2], name };
      if (!location.city) location.city = { id: match[1], name: null };
      return;
    }
    match = href.match(/\/theater\/1\/(\d+)\/?$/);
    if (match) {
      location.city = { id: match[1], name };
      return;
    }
    if (/\/theater\/1\/?$/.test(href)) location.country = { id: "1", name };
  });

  const mapUrl = $("iframe#google-map-theater").attr("src") || "";
  const coordinatesMatch = mapUrl.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const parsedCoordinates = coordinatesMatch
    ? {
        latitude: Number(coordinatesMatch[1]),
        longitude: Number(coordinatesMatch[2]),
      }
    : null;
  const coordinates = parsedCoordinates?.latitude === 0 && parsedCoordinates?.longitude === 0
    ? null
    : parsedCoordinates;

  return {
    id: String(theaterId),
    name: cleanText($("h1 span.left").first().text()) || cleanText($("title").text().split(" - ")[0]),
    address,
    phone,
    location,
    coordinates,
    theaterUrl: absoluteElCinemaUrl(`/en/theater/${theaterId}/`),
  };
}
