import * as cheerio from "cheerio";
import { absoluteElCinemaUrl, cleanText, parseId } from "./helpers.js";

export function parseNowPlaying(html) {
  const $ = cheerio.load(html);
  const movies = [];

  $('div.row[id^="w"]').each((_, element) => {
    const row = $(element);
    const rowId = row.attr("id") || "";
    if (!/^w\d+$/.test(rowId)) return;

    const titleLink = row.find('h3 a[href*="/work/"]').first();
    const href = titleLink.attr("href");
    const id = parseId(href, "work") || rowId.slice(1);
    const title = cleanText(titleLink.text());
    if (!id || !title) return;

    const image = row.find(".thumbnail-wrapper img").first();
    const poster = image.attr("data-src") || image.attr("src") || null;
    const ratingText = cleanText(row.find(".stars-rating-lg .legend").first().text());
    const ratingMatch = ratingText.match(/\d+(?:\.\d+)?/);
    const censorship = cleanText(row.find(".censorship li").last().text()) || null;
    const genres = row
      .find('a[href*="/index/work/genre/"]')
      .map((__, item) => cleanText($(item).text()))
      .get()
      .filter(Boolean);
    const releaseDay = cleanText(row.find('a[href*="/index/work/release_day/"]').first().text());
    const releaseYear = cleanText(row.find('a[href*="/index/work/release_year/"]').first().text());
    const bookingHref = row.find(`a[href^="/en/booking/${id}"]`).first().attr("href");

    movies.push({
      id,
      title,
      poster: poster ? absoluteElCinemaUrl(poster) : null,
      rating: ratingMatch ? Number(ratingMatch[0]) : null,
      censorship,
      genres,
      releaseDate: cleanText(`${releaseDay} ${releaseYear}`) || null,
      movieUrl: absoluteElCinemaUrl(`/en/work/${id}/`),
      showtimesUrl: absoluteElCinemaUrl(`/en/work/${id}/theater`),
      bookingUrl: absoluteElCinemaUrl(bookingHref),
    });
  });

  return movies;
}

