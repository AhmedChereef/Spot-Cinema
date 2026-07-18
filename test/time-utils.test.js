import test from "node:test";
import assert from "node:assert/strict";
import { findUpcomingShowings } from "../public/time-utils.js";

function cinema(name, distanceKm, showtimes) {
  return { theater: name, distanceKm, showtimes };
}

test("finds the first future showtime across all available days", () => {
  const days = [
    {
      date: "2026-07-18",
      cinemas: [cinema("Cinema A", 8, [
        { startsAt: "2026-07-18T14:00:00+03:00", price: 100 },
        { startsAt: "2026-07-18T16:30:00+03:00", price: 120 },
      ])],
    },
    {
      date: "2026-07-19",
      cinemas: [cinema("Cinema B", 2, [
        { startsAt: "2026-07-19T00:30:00+03:00", price: 150 },
      ])],
    },
  ];

  const results = findUpcomingShowings(days, new Date("2026-07-18T15:30:00+03:00"), 3);
  assert.equal(results.length, 2);
  assert.equal(results[0].cinema.theater, "Cinema A");
  assert.equal(results[0].showtime.price, 120);
  assert.equal(results[1].cinema.theater, "Cinema B");
});

test("uses distance to rank cinemas with the same next showtime", () => {
  const days = [{
    date: "2026-07-18",
    cinemas: [
      cinema("Far Cinema", 12, [{ startsAt: "2026-07-18T18:00:00+03:00" }]),
      cinema("Near Cinema", 3, [{ startsAt: "2026-07-18T18:00:00+03:00" }]),
    ],
  }];

  const results = findUpcomingShowings(days, Date.parse("2026-07-18T15:30:00+03:00"), 2);
  assert.equal(results[0].cinema.theater, "Near Cinema");
  assert.equal(results[1].cinema.theater, "Far Cinema");
});

test("returns no result when every showtime has already started", () => {
  const days = [{
    date: "2026-07-18",
    cinemas: [cinema("Cinema A", null, [{ startsAt: "2026-07-18T14:00:00+03:00" }])],
  }];
  assert.deepEqual(findUpcomingShowings(days, Date.parse("2026-07-18T15:30:00+03:00")), []);
});
