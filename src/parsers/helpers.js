export const cleanText = (value = "") => value.replace(/\s+/g, " ").trim();

export function absoluteElCinemaUrl(pathname) {
  if (!pathname) return null;
  return new URL(pathname, "https://elcinema.com").toString();
}

export function parseId(href, type) {
  const match = href?.match(new RegExp(`/${type}/(\\d+)`));
  return match?.[1] ?? null;
}

export function normalizeTime(value) {
  const display = cleanText(value).toUpperCase();
  const match = display.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;

  return {
    display,
    time24: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    hour,
  };
}

export function showtimeDateTime(scheduleDate, time) {
  const afterMidnight = time.hour < 6;
  const date = new Date(`${scheduleDate}T00:00:00Z`);
  if (afterMidnight) date.setUTCDate(date.getUTCDate() + 1);
  const localDate = date.toISOString().slice(0, 10);
  const timeZone = "Africa/Cairo";
  const guess = new Date(`${localDate}T${time.time24}:00Z`);
  const zoneName = new Intl.DateTimeFormat("en", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(guess)
    .find((part) => part.type === "timeZoneName")?.value;
  const offset = zoneName?.replace("GMT", "") || "+02:00";
  return {
    startsAt: `${localDate}T${time.time24}:00${offset}`,
    timeZone,
    afterMidnight,
  };
}
