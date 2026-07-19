import { config } from "./config.js";
import { cache } from "./lib/cache.js";
import { getHtml, getTheaterDetailsHtml, getTheaterShowtimesHtml } from "./lib/http.js";
import { NotFoundError } from "./lib/errors.js";
import { mergeLocalizedLocations, parseAreas, parseCities } from "./parsers/locations.js";
import { mergeLocalizedMovies, parseNowPlaying } from "./parsers/movies.js";
import {
  parseMovieShowtimes,
  parseTheaterDetails,
  parseTheaterMoviePrices,
} from "./parsers/showtimes.js";

export async function getNowPlaying({ query } = {}) {
  const resultKey = "DATA:now-playing:localized";
  let movies = cache.get(resultKey);
  let cacheStatus = "hit";

  if (!movies) {
    const english = await getHtml("/en/now/");
    const englishMovies = parseNowPlaying(english.html);
    let arabicMovies = [];
    let arabicCacheStatus = "unavailable";
    try {
      const arabic = await getHtml("/now/");
      arabicMovies = parseNowPlaying(arabic.html);
      arabicCacheStatus = arabic.cache;
    } catch {
      // Keep the English catalog available if the localized page temporarily fails.
    }
    movies = mergeLocalizedMovies(arabicMovies, englishMovies);
    cache.set(resultKey, movies, config.cacheTtlMs);
    cacheStatus = english.cache === "hit" && arabicCacheStatus === "hit" ? "hit" : "miss";
  }

  if (query) {
    const needle = query.toLocaleLowerCase();
    movies = movies.filter((movie) => [movie.title, movie.titleAr, movie.titleEn]
      .filter(Boolean)
      .some((title) => title.toLocaleLowerCase().includes(needle)));
  }

  return { movies, cacheStatus };
}

function mergeShowtimes(baseShowtimes, pricedSessions) {
  if (!pricedSessions.length) return baseShowtimes;
  const merged = [];
  const used = new Set();
  for (const baseShowtime of baseShowtimes) {
    const matches = pricedSessions
      .map((session, index) => ({ session, index }))
      .filter(({ session }) => session.time24 === baseShowtime.time24);
    if (!matches.length) {
      merged.push(baseShowtime);
      continue;
    }
    matches.forEach(({ session, index }) => {
      used.add(index);
      merged.push({ ...baseShowtime, ...session });
    });
  }
  pricedSessions.forEach((session, index) => {
    if (!used.has(index)) merged.push(session);
  });
  return merged;
}

async function addPrices(data, movieId, date, maxCinemas) {
  const target = data.dates.find((item) => item.date === date);
  if (!target) return data;

  const limit = maxCinemas || target.cinemas.length;
  const selected = target.cinemas.slice(0, limit);
  await Promise.all(
    selected.map(async (cinema) => {
      try {
        const result = await getTheaterShowtimesHtml(cinema.theaterId, date);
        const sessions = parseTheaterMoviePrices(result.html, movieId, date);
        cinema.showtimes = mergeShowtimes(cinema.showtimes, sessions);
        cinema.pricesStatus = sessions.length ? "available" : "not_listed";
      } catch (error) {
        cinema.pricesStatus = "unavailable";
        cinema.pricesError = error.code || "UPSTREAM_ERROR";
      }
    }),
  );

  target.cinemas.slice(limit).forEach((cinema) => {
    cinema.pricesStatus = "skipped_by_limit";
  });
  return data;
}

export async function getMovieShowtimes(movieId, { date, includePrices = false, maxCinemas } = {}) {
  const result = await getHtml(`/en/work/${movieId}/theater`);
  const data = parseMovieShowtimes(result.html, movieId);

  if (!data.availableDates.length) {
    throw new NotFoundError("No current cinema showtimes were found for this movie.", { movieId });
  }

  const selectedDate = date || data.availableDates[0];
  if (!data.availableDates.includes(selectedDate)) {
    throw new NotFoundError("No showtimes are listed for the requested date.", {
      requestedDate: selectedDate,
      availableDates: data.availableDates,
    });
  }

  data.dates = data.dates.filter((item) => item.date === selectedDate);
  if (includePrices) {
    await addPrices(data, movieId, selectedDate, maxCinemas || config.maxPriceCinemas);
  }

  return {
    ...data,
    requestedDate: selectedDate,
    source: "elCinema public pages",
    fetchedAt: new Date().toISOString(),
    cacheStatus: result.cache,
  };
}

export async function getCinemaMovieDetails(movieId, theaterId, date) {
  const movieData = await getMovieShowtimes(movieId, { date });
  const day = movieData.dates[0];
  const baseCinema = day.cinemas.find((cinema) => cinema.theaterId === String(theaterId));
  if (!baseCinema) {
    throw new NotFoundError("This cinema is not listed for the selected movie and date.", {
      movieId,
      theaterId,
      date: movieData.requestedDate,
    });
  }

  const pricesResult = await getTheaterShowtimesHtml(theaterId, movieData.requestedDate);
  const sessions = parseTheaterMoviePrices(pricesResult.html, movieId, movieData.requestedDate);
  const detailsResult = await getTheaterDetailsHtml(theaterId);
  const theater = parseTheaterDetails(detailsResult.html, theaterId);

  return {
    ...baseCinema,
    ...theater,
    showtimes: mergeShowtimes(baseCinema.showtimes, sessions),
    pricesStatus: sessions.length ? "available" : "not_listed",
    requestedDate: movieData.requestedDate,
  };
}

export async function getEgyptLocations() {
  const [arabic, english] = await Promise.all([getHtml("/theater/1/"), getHtml("/en/theater/1/")]);
  return {
    country: { id: "1", nameAr: "مصر", nameEn: "Egypt" },
    cities: mergeLocalizedLocations(parseCities(arabic.html), parseCities(english.html)),
  };
}

export async function getEgyptAreas(cityId) {
  const [arabic, english] = await Promise.all([
    getHtml(`/theater/1/${cityId}`),
    getHtml(`/en/theater/1/${cityId}`),
  ]);
  return {
    cityId: String(cityId),
    areas: mergeLocalizedLocations(parseAreas(arabic.html, cityId), parseAreas(english.html, cityId)),
  };
}
