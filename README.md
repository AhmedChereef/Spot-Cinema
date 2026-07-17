# Cinema Finder / elCinema Unofficial API — v0.3

A small Node.js wrapper around public elCinema pages. It converts current movies, cinema showtimes, locations, and ticket prices into JSON. Version 0.3 adds a daily static snapshot, so the Arabic website can show every collected cinema and price immediately without contacting elCinema during the user's visit. The interface supports selecting several areas in one search and displays the selected movie poster with its results.

> This is an independent prototype. It is not affiliated with or endorsed by elCinema. Review elCinema's terms and obtain permission before commercial or high-volume use.

## Run it

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env
npm start
```

Open <http://localhost:3000> to try the Arabic playground.

For responsible requests, edit `.env` and replace the default user agent with a real contact email:

```env
ELCINEMA_USER_AGENT=CinemaFinderPrototype/0.1 (+you@example.com)
```

## Build the fast daily snapshot

Run this once before opening the static website:

```bash
npm run snapshot
npm start
```

The generator stores up to seven available days in `public/data/snapshot.json`. Change the range if needed:

```bash
SNAPSHOT_DAYS=3 npm run snapshot
```

The write is atomic: the previous valid snapshot remains available if a collection run fails before completion. The website displays the snapshot's last-update time and has a button that checks whether a newer file was published.

## Run daily without keeping CMD open

The included `.github/workflows/daily-snapshot.yml` workflow:

1. Runs automatically every day at 03:17 UTC.
2. Generates a fresh seven-day snapshot.
3. Publishes `public/` to GitHub Pages.
4. Can also be started manually from the Actions tab.

After pushing this folder to a GitHub repository, open **Settings → Pages → Build and deployment**, select **GitHub Actions**, then run **Daily cinema snapshot** once. The deployed website is static, so neither this Node server nor your computer needs to remain running.

## API

### Health

```http
GET /api/health
```

### Movies currently playing in Egypt

```http
GET /api/movies
GET /api/movies?query=obsession
```

### Showtimes for a movie

```http
GET /api/movies/2097700/showtimes
GET /api/movies/2097700/showtimes?date=2026-07-18
```

### Showtimes with prices

```http
GET /api/movies/2097700/showtimes?date=2026-07-18&includePrices=true
```

The bulk endpoint now checks every listed cinema by default. Because this needs an extra upstream request per cinema, the browser playground uses the progressive endpoint below so results appear one cinema at a time instead of blocking the whole page.

### One cinema: prices and location

```http
GET /api/movies/2097700/theaters/3101119?date=2026-07-18
```

### Egypt cities and areas

```http
GET /api/locations
GET /api/locations/1/areas
```

Location names are returned in Arabic and English from elCinema's own cinema directory. No external map API or API key is needed for these dropdowns.

Each cinema returns a `pricesStatus` value:

- `not_requested`: basic showtimes only.
- `available`: price and experience data were found.
- `not_listed`: the cinema did not list a price for that film/day.
- `unavailable`: the price request failed.
- `skipped_by_limit`: only returned when an optional `maxCinemas` limit is explicitly provided.

## Important behavior

- Schedule entries before 6:00 AM are treated as after-midnight sessions belonging to the previous cinema schedule day.
- The wrapper only accepts fixed elCinema routes; it does not proxy arbitrary URLs.
- The live API cache is in memory. The daily snapshot is a persistent static JSON file and does not require Redis.
- If one movie fails during a daily run, the snapshot records that failure and publishes the other successful movies. It never replaces a snapshot when every movie fails.
- HTML structures can change. Parser tests catch expected structure, but a live health check is still useful.

## Tests

```bash
npm test
npm run test:live
```

The regular tests use local HTML samples. The live test makes real requests to elCinema and should not be run repeatedly.

## Suggested next steps

1. Rank cinemas by distance from the user's live location.
2. Add requested-time and maximum-price filters.
3. Store normalized cinema data in PostgreSQL/Supabase.
4. Add a scheduled parser health check and alert on markup changes.
5. Contact elCinema before public or commercial launch.
