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

Fill in the Supabase values in `.env.local`, then run
`supabase/migrations/001_initial.sql` once in the Supabase SQL Editor. Until
then the dashboard shows "Usage tracking is unavailable" and refuses searches.

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
- `src/app/api/`: `POST /api/search`, `GET /api/status`, `POST /api/settings`
- `supabase/migrations/`: database schema, run manually in the SQL Editor
