const integer = (value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export const config = Object.freeze({
  port: integer(process.env.PORT, 3000, { min: 1, max: 65535 }),
  baseUrl: "https://elcinema.com",
  cacheTtlMs: integer(process.env.CACHE_TTL_MS, 15 * 60 * 1000, { min: 60_000 }),
  requestTimeoutMs: integer(process.env.REQUEST_TIMEOUT_MS, 15_000, { min: 2_000, max: 60_000 }),
  minRequestIntervalMs: integer(process.env.MIN_REQUEST_INTERVAL_MS, 450, { min: 250, max: 5_000 }),
  maxPriceCinemas: integer(process.env.MAX_PRICE_CINEMAS, 100, { min: 1, max: 100 }),
  allowedOrigin: process.env.ALLOWED_ORIGIN || "*",
  userAgent:
    process.env.ELCINEMA_USER_AGENT ||
    "SpotCinemaPrototype/0.5 (+set-ELCINEMA_USER_AGENT-with-contact-email)",
});
