# Client Finder

Lead finder for local businesses, built with Next.js and the Google Places API
(New). It has strict zero-cost safeguards. Read [docs/SETUP.md](docs/SETUP.md)
before enabling Google search.

## Run locally

Requires Node.js 20+ and a Supabase project (the Free plan is enough).

```sh
npm install
cp .env.example .env.local   # Places search stays disabled until you edit this
npm run dev                  # http://localhost:3000
```

Fill in the Supabase values in `.env.local`, run the files in
`supabase/migrations/` in order in the Supabase SQL Editor, then import a city:
`npm run import:places -- --area jeddah`.

- `/` is the map. Pins show businesses from open data, coloured by listed web
  presence. Use Filters for category, Instagram and confidence; click a pin for
  details. The map uses free OpenFreeMap tiles and needs no API key.
- `/google` is the optional Google Places search, off by default.

The app only answers on `localhost` until authentication is added.

## Checks

```sh
npm test           # Vitest; Google is always mocked, real network is blocked
npm run typecheck
npm run lint
npm run build
```

## Layout

- `src/lib/server/`: server-only code (config, Supabase stores, Places client, search orchestration)
- `src/app/api/`: `GET /api/places`, `GET /api/places/[id]`, plus the optional Google routes `POST /api/search`, `GET /api/status`, `POST /api/settings`
- `src/app/`: map page (`PlacesExplorer`, `LeadMap`, `PlaceDetailsPanel`); `src/app/google/` is the Google search page
- `supabase/migrations/`: database schema, run manually in the SQL Editor
- `scripts/import-overture.ts`: imports open places data (`npm run import:places`)
- `src/lib/places/`: web-presence labels and import areas, shared by server and browser
