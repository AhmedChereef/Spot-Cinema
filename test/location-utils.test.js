import test from "node:test";
import assert from "node:assert/strict";
import { localizedCinemaLocation, movieLocationOptions } from "../public/location-utils.js";

const locations = {
  cities: [
    { id: "1", nameAr: "القاهرة", nameEn: "Cairo" },
    { id: "2", nameAr: "الإسكندرية", nameEn: "Alexandria" },
  ],
  areasByCity: {
    1: [
      { id: "39", nameAr: "وسط البلد", nameEn: "Downtown" },
      { id: "71", nameAr: "مصر الجديدة", nameEn: "Heliopolis" },
    ],
    2: [{ id: "8", nameAr: "محطة الرمل", nameEn: "Raml Station" }],
  },
};

const movie = {
  dates: [
    {
      cinemas: [
        { location: { city: { id: "1", name: "Cairo" }, area: { id: "39", name: "Downtown" } } },
        { location: { city: { id: "2", name: "Alexandria" }, area: { id: "8", name: "Raml Station" } } },
      ],
    },
    {
      cinemas: [
        { location: { city: { id: "1", name: "Cairo" }, area: { id: "71", name: "Heliopolis" } } },
        { location: { city: { id: "1", name: "Cairo" }, area: { id: "39", name: "Downtown" } } },
      ],
    },
  ],
};

test("builds city and area filters from cinemas showing the selected movie", () => {
  const options = movieLocationOptions(movie, locations);
  assert.deepEqual(options.cities.map((item) => item.name), ["الإسكندرية", "القاهرة"]);
  assert.deepEqual(options.areasByCity["1"].map((item) => item.name), ["مصر الجديدة", "وسط البلد"]);
  assert.deepEqual(options.areasByCity["2"].map((item) => item.name), ["محطة الرمل"]);
});

test("uses Arabic location labels in cinema results", () => {
  const cinema = { location: { city: { id: "1", name: "Cairo" }, area: { id: "39", name: "Downtown" } } };
  assert.equal(localizedCinemaLocation(cinema, locations), "وسط البلد، القاهرة");
});

test("falls back to cinema location data when the general location list is incomplete", () => {
  const fallbackMovie = { dates: [{ cinemas: [{ location: { city: { id: "9", name: "Giza" }, area: { id: "4", name: "Dokki" } } }] }] };
  const options = movieLocationOptions(fallbackMovie, {});
  assert.deepEqual(options.cities, [{ id: "9", name: "Giza" }]);
  assert.deepEqual(options.areasByCity["9"], [{ id: "4", name: "Dokki" }]);
});
