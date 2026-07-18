export function findUpcomingShowings(days, now = Date.now(), limit = 3) {
  const nowTimestamp = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(nowTimestamp) || limit < 1) return [];

  return (days || [])
    .flatMap((day) => (day.cinemas || []).flatMap((cinema) => (cinema.showtimes || []).map((showtime) => ({
      day: day.date,
      cinema,
      showtime,
      startsAt: showtime.startsAt,
      startsAtTimestamp: Date.parse(showtime.startsAt),
    }))))
    .filter((showing) => Number.isFinite(showing.startsAtTimestamp) && showing.startsAtTimestamp >= nowTimestamp)
    .sort((first, second) => {
      const timeDifference = first.startsAtTimestamp - second.startsAtTimestamp;
      if (timeDifference) return timeDifference;
      const firstDistance = Number.isFinite(first.cinema.distanceKm) ? first.cinema.distanceKm : Number.POSITIVE_INFINITY;
      const secondDistance = Number.isFinite(second.cinema.distanceKm) ? second.cinema.distanceKm : Number.POSITIVE_INFINITY;
      return firstDistance - secondDistance;
    })
    .slice(0, limit);
}
