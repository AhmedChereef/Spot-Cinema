import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTheaterDetailsHtml } from "../src/lib/http.js";
import { parseTheaterDetails } from "../src/parsers/showtimes.js";
import {
  getEgyptAreas,
  getEgyptLocations,
  getMovieShowtimes,
  getNowPlaying,
} from "../src/service.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.resolve(process.env.SNAPSHOT_OUTPUT || path.join(root, "public/data/snapshot.json"));
const maxDays = Math.max(1, Math.min(14, Number.parseInt(process.env.SNAPSHOT_DAYS || "7", 10) || 7));

function log(message) {
  console.log(`[snapshot ${new Date().toISOString()}] ${message}`);
}

async function buildLocations() {
  const base = await getEgyptLocations();
  const areasByCity = {};
  for (const [index, city] of base.cities.entries()) {
    try {
      const data = await getEgyptAreas(city.id);
      areasByCity[city.id] = data.areas;
      log(`Locations ${index + 1}/${base.cities.length}: ${city.nameEn || city.nameAr}`);
    } catch (error) {
      areasByCity[city.id] = [];
      log(`Location warning for city ${city.id}: ${error.message}`);
    }
  }
  return { ...base, areasByCity };
}

async function enrichTheaters(day, theaterCache) {
  await Promise.all(day.cinemas.map(async (cinema) => {
    let theater = theaterCache.get(cinema.theaterId);
    if (!theater) {
      try {
        const result = await getTheaterDetailsHtml(cinema.theaterId);
        theater = parseTheaterDetails(result.html, cinema.theaterId);
      } catch (error) {
        theater = { id: cinema.theaterId, detailsStatus: "unavailable" };
        log(`Theater warning ${cinema.theaterId}: ${error.message}`);
      }
      theaterCache.set(cinema.theaterId, theater);
    }
    Object.assign(cinema, theater, {
      theater: cinema.theater || theater.name,
      detailsStatus: theater.detailsStatus || "available",
    });
  }));
}

async function buildMovie(movie, index, total, theaterCache) {
  const first = await getMovieShowtimes(movie.id);
  const dates = first.availableDates.slice(0, maxDays);
  const days = [];

  for (const selectedDate of dates) {
    const data = await getMovieShowtimes(movie.id, {
      date: selectedDate,
      includePrices: true,
    });
    const day = data.dates[0];
    await enrichTheaters(day, theaterCache);
    days.push(day);
  }

  log(`Movies ${index + 1}/${total}: ${movie.title} (${days.length} days)`);
  return {
    ...movie,
    ...first.movie,
    title: movie.title || first.movie.title,
    titleAr: movie.titleAr || null,
    titleEn: movie.titleEn || first.movie.title || null,
    availableDates: days.map((day) => day.date),
    dates: days,
  };
}

async function main() {
  log("Starting daily snapshot");
  const locations = await buildLocations();
  const { movies: catalog } = await getNowPlaying();
  const theaterCache = new Map();
  const movies = [];
  const failures = [];

  for (const [index, movie] of catalog.entries()) {
    try {
      movies.push(await buildMovie(movie, index, catalog.length, theaterCache));
    } catch (error) {
      failures.push({ movieId: movie.id, title: movie.title, message: error.message });
      log(`Movie warning ${movie.id}: ${error.message}`);
    }
  }

  if (!movies.length) throw new Error("Snapshot aborted because no movie schedules could be collected.");

  const generatedAt = new Date().toISOString();
  const cinemaIds = new Set();
  let sessionCount = 0;
  for (const movie of movies) {
    for (const day of movie.dates) {
      for (const cinema of day.cinemas) {
        cinemaIds.add(cinema.theaterId);
        sessionCount += cinema.showtimes.length;
      }
    }
  }

  const snapshot = {
    schemaVersion: 1,
    generatedAt,
    timeZone: "Africa/Cairo",
    source: "elCinema public pages",
    stats: {
      movies: movies.length,
      cinemas: cinemaIds.size,
      sessions: sessionCount,
      failedMovies: failures.length,
    },
    locations,
    movies,
    failures,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await rename(temporaryPath, outputPath);
  log(`Saved ${movies.length} movies, ${cinemaIds.size} cinemas and ${sessionCount} sessions to ${outputPath}`);
}

main().catch((error) => {
  console.error(`[snapshot] Failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
