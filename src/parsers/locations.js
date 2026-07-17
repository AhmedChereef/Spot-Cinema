import * as cheerio from "cheerio";
import { absoluteElCinemaUrl, cleanText } from "./helpers.js";

function parseOptions(html, selector, pattern) {
  const $ = cheerio.load(html);
  return $(`${selector} option[value]`)
    .map((_, option) => {
      const value = $(option).attr("value") || "";
      const match = value.match(pattern);
      if (!match) return null;
      return {
        id: match[1],
        name: cleanText($(option).text()),
        sourceUrl: absoluteElCinemaUrl(value),
      };
    })
    .get()
    .filter(Boolean);
}

export function parseCities(html) {
  return parseOptions(html, "#static-city-selector", /\/theater\/1\/(\d+)\/?$/);
}

export function parseAreas(html, cityId) {
  return parseOptions(
    html,
    "#static-district-selector",
    new RegExp(`/theater/1/${cityId}/(\\d+)/?$`),
  );
}

export function mergeLocalizedLocations(arabic, english) {
  const englishById = new Map(english.map((item) => [item.id, item]));
  return arabic.map((item) => ({
    id: item.id,
    nameAr: item.name,
    nameEn: englishById.get(item.id)?.name || item.name,
    sourceUrl: englishById.get(item.id)?.sourceUrl || item.sourceUrl,
  }));
}

