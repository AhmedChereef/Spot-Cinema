import express from "express";
import { config } from "./config.js";
import { AppError, ValidationError } from "./lib/errors.js";
import {
  getCinemaMovieDetails,
  getEgyptAreas,
  getEgyptLocations,
  getMovieShowtimes,
  getNowPlaying,
} from "./service.js";

const app = express();
const requests = new Map();

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", config.allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  const now = Date.now();
  const key = req.ip || "unknown";
  const current = requests.get(key);
  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  current.count += 1;
  if (current.count > 60) {
    res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
    return res.status(429).json({
      error: { code: "RATE_LIMITED", message: "Too many requests. Try again shortly." },
    });
  }
  next();
});

app.use(express.static("public", { extensions: ["html"] }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "elcinema-unofficial-api", version: "0.3.1" });
});

app.get("/api/locations", async (_req, res, next) => {
  try {
    res.json(await getEgyptLocations());
  } catch (error) {
    next(error);
  }
});

app.get("/api/locations/:cityId/areas", async (req, res, next) => {
  try {
    if (!/^\d{1,4}$/.test(req.params.cityId)) {
      throw new ValidationError("cityId must contain digits only.");
    }
    res.json(await getEgyptAreas(req.params.cityId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/movies", async (req, res, next) => {
  try {
    const query = typeof req.query.query === "string" ? req.query.query.trim().slice(0, 100) : "";
    const { movies, cacheStatus } = await getNowPlaying({ query });
    res.setHeader("X-Cache", cacheStatus);
    res.json({ count: movies.length, movies });
  } catch (error) {
    next(error);
  }
});

app.get("/api/movies/:movieId/showtimes", async (req, res, next) => {
  try {
    const movieId = req.params.movieId;
    if (!/^\d{5,10}$/.test(movieId)) {
      throw new ValidationError("movieId must contain digits only.");
    }

    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ValidationError("date must use YYYY-MM-DD format.");
    }

    const includePrices = ["1", "true", "yes"].includes(String(req.query.includePrices).toLowerCase());
    const requestedLimit = Number.parseInt(req.query.maxCinemas, 10);
    const maxCinemas = Number.isFinite(requestedLimit)
      ? Math.min(config.maxPriceCinemas, Math.max(1, requestedLimit))
      : undefined;

    const data = await getMovieShowtimes(movieId, { date, includePrices, maxCinemas });
    res.setHeader("X-Cache", data.cacheStatus);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/movies/:movieId/theaters/:theaterId", async (req, res, next) => {
  try {
    const { movieId, theaterId } = req.params;
    if (!/^\d{5,10}$/.test(movieId) || !/^\d{5,10}$/.test(theaterId)) {
      throw new ValidationError("movieId and theaterId must contain digits only.");
    }
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ValidationError("date must use YYYY-MM-DD format.");
    }
    res.json(await getCinemaMovieDetails(movieId, theaterId, date));
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: { code: "ROUTE_NOT_FOUND", message: "Route not found." } });
});

app.use((error, _req, res, _next) => {
  const known = error instanceof AppError;
  const status = known ? error.status : 500;
  if (!known) console.error(error);
  res.status(status).json({
    error: {
      code: known ? error.code : "INTERNAL_ERROR",
      message: known ? error.message : "Unexpected server error.",
      ...(known && error.details ? { details: error.details } : {}),
    },
  });
});

export default app;
