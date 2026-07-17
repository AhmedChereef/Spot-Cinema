import assert from "node:assert/strict";
import { getMovieShowtimes, getNowPlaying } from "../src/service.js";

const { movies } = await getNowPlaying();
assert.ok(movies.length > 0, "Expected at least one now-playing movie");

const movie = movies.find((item) => item.id) || movies[0];
const result = await getMovieShowtimes(movie.id);
assert.ok(result.availableDates.length > 0, "Expected at least one available date");
assert.ok(result.dates[0].cinemas.length > 0, "Expected at least one cinema");

console.log(`Live check passed: ${movie.title}, ${result.dates[0].cinemas.length} cinemas`);

