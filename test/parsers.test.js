import test from "node:test";
import assert from "node:assert/strict";
import { mergeLocalizedLocations, parseAreas, parseCities } from "../src/parsers/locations.js";
import { mergeLocalizedMovies, parseNowPlaying } from "../src/parsers/movies.js";
import {
  parseMovieShowtimes,
  parseTheaterDetails,
  parseTheaterMoviePrices,
} from "../src/parsers/showtimes.js";

test("parses now-playing movies", () => {
  const html = `<div class="row" id="w2093181">
    <div class="thumbnail-wrapper"><img data-src="https://img.test/poster.jpg"></div>
    <h3><a href="/en/work/2093181/">Saqr w Kanarya</a></h3>
    <div class="stars-rating-lg"><span class="legend">7.8</span></div>
    <ul class="censorship"><li>مصري</li><li>+16</li></ul>
    <a href="/en/index/work/genre/19">Action</a>
    <a href="/en/index/work/release_day/06-24/">24 June</a>
    <a href="/en/index/work/release_year/2026/">2026</a>
    <a href="/en/booking/2093181/">tickets</a>
  </div>`;
  const movies = parseNowPlaying(html);
  assert.equal(movies.length, 1);
  assert.equal(movies[0].id, "2093181");
  assert.equal(movies[0].title, "Saqr w Kanarya");
  assert.equal(movies[0].rating, 7.8);
  assert.deepEqual(movies[0].genres, ["Action"]);
});

test("uses Arabic movie titles while preserving both localized names", () => {
  const english = [{ id: "2093181", title: "Saqr w Kanarya", poster: "poster.jpg" }, { id: "2094711", title: "Keeper" }];
  const arabic = [{ id: "2093181", title: "صقر وكناريا" }, { id: "2094711", title: "Keeper" }];
  const movies = mergeLocalizedMovies(arabic, english);

  assert.deepEqual(movies[0], {
    id: "2093181",
    title: "صقر وكناريا",
    titleAr: "صقر وكناريا",
    titleEn: "Saqr w Kanarya",
    poster: "poster.jpg",
  });
  assert.equal(movies[1].title, "Keeper");
});

test("parses movie cinema showtimes and after-midnight dates", () => {
  const html = `<title>Watch in Cinemas: Movie - Obsession - 2025</title>
    <div class="tabs-content"><div class="content active" id="wtheater20260717">
      <div class="row">
        <div><a href="/en/theater/3101119/">Sun City Cinema</a></div>
        <div><ul class="list-separator"><li>09:45 PM</li><li>12:15 AM</li><li><a>More</a></li></ul></div>
        <div><a href="/en/booking/2097700/3101119">tickets</a></div>
      </div>
    </div></div>`;
  const data = parseMovieShowtimes(html, "2097700");
  const cinema = data.dates[0].cinemas[0];
  assert.equal(data.movie.title, "Obsession");
  assert.equal(cinema.showtimes.length, 2);
  assert.equal(cinema.showtimes[0].time24, "21:45");
  assert.equal(cinema.showtimes[1].afterMidnight, true);
  assert.match(cinema.showtimes[1].startsAt, /^2026-07-18T00:15/);
  assert.equal(cinema.showtimes[1].timeZone, "Africa/Cairo");
});

test("parses per-experience prices from a theater page", () => {
  const html = `<div id="theater-showtimes-container"><div class="row">
    <h3><a href="/en/work/2093181/">Saqr w Kanarya</a></h3>
    <div class="swiper-slide"><h6 class="section-title"><strong>Standard</strong></h6>
      <table class="showtimes"><tr><td></td><td><strong>01:45 pm</strong></td><td><span class="price">190 EGP</span></td></tr></table>
    </div>
  </div></div>`;
  const sessions = parseTheaterMoviePrices(html, "2093181", "2026-07-17");
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].experience, "Standard");
  assert.equal(sessions[0].price, 190);
  assert.equal(sessions[0].currency, "EGP");
});

test("parses and merges bilingual cities and areas", () => {
  const en = `<select id="static-city-selector"><option value="/en/theater/1/1">Cairo</option></select>`;
  const ar = `<select id="static-city-selector"><option value="/theater/1/1">القاهرة</option></select>`;
  const cities = mergeLocalizedLocations(parseCities(ar), parseCities(en));
  assert.deepEqual(cities[0], {
    id: "1",
    nameAr: "القاهرة",
    nameEn: "Cairo",
    sourceUrl: "https://elcinema.com/en/theater/1/1",
  });

  const areasHtml = `<select id="static-district-selector"><option value="/en/theater/1/1/71">Heliopolis</option></select>`;
  assert.equal(parseAreas(areasHtml, "1")[0].id, "71");
});

test("parses theater location and coordinates", () => {
  const html = `<h1><span class="left">Test Cinema</span></h1>
    <ul class="unstyled no-margin">
      <li><a href="#google-map-theater">map</a> 10 Test Street</li>
      <li><a href="/en/theater/1/1/71">Heliopolis</a><a href="/en/theater/1/1">Cairo</a><a href="/en/theater/1/">Egypt</a><i class="fa-phone"></i> 16000</li>
    </ul>
    <iframe id="google-map-theater" src="https://maps.google.com/maps?q=30.08,31.33&output=embed"></iframe>`;
  const theater = parseTheaterDetails(html, "3100000");
  assert.equal(theater.location.city.id, "1");
  assert.equal(theater.location.area.id, "71");
  assert.equal(theater.coordinates.latitude, 30.08);
  assert.equal(theater.coordinates.longitude, 31.33);
});

test("ignores missing zero coordinates from theater maps", () => {
  const html = `<h1><span class="left">No Map Cinema</span></h1>
    <ul class="unstyled no-margin"><li><a href="#google-map-theater">map</a> Test Street</li></ul>
    <iframe id="google-map-theater" src="https://maps.google.com/maps?q=0,0&output=embed"></iframe>`;
  const theater = parseTheaterDetails(html, "3100001");
  assert.equal(theater.coordinates, null);
});
