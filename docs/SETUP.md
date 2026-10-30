# Setup and zero-cost safeguards

Goal: $0 in Google charges. No code can guarantee that on its own, so cost is
controlled in four layers. The app handles layers 1–2. You must set up 3–4 in
Google Cloud yourself; the app never changes Google Cloud settings.

| Layer | Who | What it stops |
|---|---|---|
| 1. Field mask | App | Requests being billed at a paid SKU |
| 2. App limits | App | This app making more than N requests/month |
| 3. Google quota (per day) | You | **Anything** using the project above the quota, including a leaked key |
| 4. Budget alert | You | Nothing. It only emails you |

## 1. Field mask (what Google bills for)

Text Search (New) is billed per request, at the SKU of the most expensive field
requested. Checked on 2026-10-29 against Google's
[pricing page](https://developers.google.com/maps/billing-and-pricing/pricing):

| `PLACES_FIELD_TIER` | Field mask | SKU | Free monthly cap |
|---|---|---|---|
| `ids_only` (default) | `places.id` | Text Search Essentials (IDs Only) | Unlimited |
| `pro` (opt-in) | `places.id,places.displayName,places.formattedAddress` | Text Search Pro | 5,000 requests, then $32 per 1,000 |

- The app never requests `*`, `nextPageToken` (no pagination), website, phone,
  rating, hours, reviews or photos. A test enforces this.
- It makes one request per search: no retries, and no Place Details calls per result.
- `ids_only` is the only setting Google lists as free with no cap. It returns
  place IDs but no names or addresses.
- `pro` is free only while the whole billing account stays under 5,000 Text
  Search Pro requests a month. Only enable it once you have done step 3.
- Pricing can change. Re-check the pricing page before enabling search and after
  any change, and confirm the actual SKU in your billing report.

## 2. App limits (`.env.local`)

| Variable | Default | Enforced on the server |
|---|---|---|
| `PLACES_SEARCH_ENABLED` | `false` | Must be exactly `true`, or no request is made |
| `MAX_RESULTS_PER_SEARCH` | `10` | Requests above it are rejected; the code ceiling is 10 |
| `MAX_PLACES_REQUESTS_PER_MONTH` | `10` | Counted in Supabase per UTC month; the code ceiling is 100 |
| `PLACES_FIELD_TIER` | `ids_only` | See above |

The server also refuses a search when:
- any of these settings is missing or invalid;
- the usage database can't be read;
- searches are paused on the dashboard;
- the request isn't explicitly confirmed;
- more than 3 searches have been made in the last minute.

A failed request still counts toward the monthly limit, because Google may bill it.

These limits only cover this app. They can't see other apps or projects on the
same billing account.

## Supabase setup

1. **Keep it free.** Use the **Free** plan. If the organization is on a paid
   plan, keep the Spend Cap on. Free projects pause after about a week without
   activity; restore them from the dashboard.
2. **Fill in keys.** Put the project URL, publishable key and **secret** key
   (`sb_secret_...`) in `.env.local`. The secret key bypasses all access rules:
   never share it, commit it, or give it a `NEXT_PUBLIC_` prefix.
3. **Run the migrations.** Open the SQL Editor and run each file in
   `supabase/migrations/` once, in order (001 to 010). The first,
   `001_initial.sql`, creates the
   tables `usage_events`, `app_settings` and `leads` plus two counter
   functions. It drops nothing.
4. **Access model.** RLS is on for every table, with no policies, and anon and
   authenticated roles have no grants. The publishable key can therefore read
   or write nothing. Only the app's server (with the secret key) can.

The usage counter lives in Supabase. The limit check and the request record
happen in one database function, so simultaneous searches cannot both pass. If
Supabase is unreachable, the app refuses searches.

## Outreach queue, templates and pipeline

- **Outreach** (`/queue`): one business at a time with the draft ready. You
  open WhatsApp or your mail app, send it yourself, then press **Sent → next**.
  That saves the lead, marks it contacted and sets the follow-up reminder. The
  app never sends anything. `DAILY_OUTREACH_LIMIT` (default 20, max 50) caps
  first messages per day; follow-ups don't count. The queue leaves out chains,
  opted-out leads, and any place sharing a phone number with a lead already
  contacted.
- **Templates** (`/templates`): edit every paragraph of the drafts, in English
  and Arabic, plus a pitch per category (e.g. QR menus for restaurants). They
  are stored in `app_settings`; no migration is needed.
- **Pipeline** (`/pipeline`): leads that replied, then Meeting → Proposal sent
  → Won / Lost, with deal values in SAR. Needs
  `supabase/migrations/010_deals.sql`.

## Phone access (login)

Without login settings the app only answers on `localhost`. To use it from
your phone on the same Wi-Fi:

1. Run `npm run auth:setup`, choose a password (10+ characters), and paste
   the three printed lines into `.env.local`: `APP_PASSWORD_HASH`,
   `SESSION_SECRET`, `APP_ALLOWED_HOSTS` (your PC's home-network IP).
2. Restart `npm run dev`. Every page now asks for the password, on the PC too.
   A session lasts 30 days; **Log out** is in the header. Changing
   `SESSION_SECRET` signs out every device.
3. On the phone, open `http://<PC IP>:3000`. The first time, Windows may ask
   whether Node.js may use the network: allow **private** networks only.

The PC must be on and running the app. This is plain http on your own Wi-Fi,
so don't do this on public Wi-Fi. The router may also give the PC a new IP;
rerun the setup (or reserve the IP in the router) if the phone stops
connecting.

Hosting it online instead: Vercel's free Hobby plan is for **non-commercial use
only**, and a tool used to win clients counts as commercial, so it isn't an
option. Choose a host whose free plan allows commercial use, and serve it over
https only.

## Open places data (Overture Maps)

The map uses open data from [Overture Maps](https://docs.overturemaps.org/guides/places/),
not Google. Downloading it is free and needs no account.

1. Run `supabase/migrations/002_places.sql` once in the SQL Editor.
2. Preview an import without writing anything:
   `npm run import:places -- --area jeddah --dry-run`
3. Import: `npm run import:places -- --area jeddah`. Re-running updates rows
   by Overture ID. Jeddah is about 24,000 places.
4. Other cities: add them to `src/lib/places/areas.ts`, or pass
   `--bbox west,south,east,north --name "City"` (at most 1 degree each way).

**Foursquare (optional second source).** With `FOURSQUARE_PLACES_TOKEN` from
the Foursquare Places Portal in `.env.local`, run migration
`007_foursquare_and_refresh.sql`, then
`npm run import:foursquare -- --area jeddah` (add `--dry-run` to preview). It
adds open business places updated since 2024 that are not already on the map,
and Instagram handles for matching places. Takes about a minute for Jeddah.

**Website unknown vs no website listed.** Foursquare rarely records websites,
so its places with nothing listed are labelled "Website unknown" (lower
score). "No website listed" is kept for Overture, which is more reliable. If
Google Maps shows a business already has a site, use "Has a website" in the
place panel to hide it. After changing `LEAD_TARGET_CATEGORIES` or running a
migration, recompute scores with `npm run rescore:places -- --area jeddah`.

**Monthly refresh.** `npm run refresh:places` imports the newest Overture
release and Foursquare for every area, removes places that disappeared (never
saved leads; skipped if an import looks too small), and rescores. To run it
automatically on the 5th of each month at 03:00 while you are logged in:
`powershell -ExecutionPolicy Bypass -File scripts\register-refresh-task.ps1`.
Output goes to `logs\refresh.log`. Remove the task with
`schtasks /Delete /TN "HuntPin monthly places refresh" /F`.

**Google listing.** The place panel's "Find on Google Maps" searches Google Maps
by business name and city (Maps URLs: no API key, no billing account, no
cost), which usually opens their listing with rating, reviews and photos.

**Licences and attribution.** Each record keeps its source datasets and
licences: CDLA-Permissive-2.0 (Meta, Microsoft and others), Apache-2.0
(Foursquare: "Copyright 2024 Foursquare Labs, Inc. All rights reserved.") and
CC0-1.0 (AllThePlaces). Credit Overture Maps Foundation and those sources where
the data is shown. See the [Overture attribution page](https://docs.overturemaps.org/attribution/).

**Limits of the data.** The web-presence labels describe what the data lists.
Most records come from Facebook pages, so "social only" usually means a Facebook
page without a website listed. Some places are stale; use the confidence score
to filter. Phone numbers are business listings. Use them only for respectful,
low-volume outreach that follows local privacy and anti-spam rules.

## 3. Google Cloud setup (do this before enabling search)

1. **Use a dedicated project.** Create a new Google Cloud project for this app.
   Check which other projects share its billing account, because free caps and
   charges are tracked at the billing-account level.
2. **Enable only Places API (New).** Don't enable the legacy Places API or other
   Maps APIs.
3. **Create a restricted API key.** Under *APIs & Services → Credentials*,
   restrict the key to **Places API (New)** only. Put it in `.env.local` as
   `GOOGLE_MAPS_API_KEY`. Never commit it or give it a `NEXT_PUBLIC_` prefix.
4. **Set a hard quota.** Under *APIs & Services → Places API (New) → Quotas &
   System Limits*, lower the Text Search request quota. Google's guidance:
   "To put a hard cap on usage of an API, lower its per-day quota." Set it to
   something like 10 a day. If only a per-minute quota is listed for Text
   Search, set it to 1. Note that 1 a minute still allows about 43,000 a
   month, so it is not a full cap; keep `PLACES_FIELD_TIER=ids_only` until you
   have a daily cap.
5. **Add a budget alert** of $1 on the billing account. This only sends you an
   email; it does not stop spending.

## 4. First real search (later milestone)

1. Finish step 3, then set `PLACES_SEARCH_ENABLED=true` and add the key.
2. Run one search with `ids_only`. The dashboard asks for confirmation first.
3. The next day, check *Billing → Reports* filtered to Places API (New). Confirm
   the SKU is "Text Search Essentials (IDs Only)" and the cost is $0.

## Data storage

Google's [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies)
let you store place IDs indefinitely. Other Places content (names, addresses,
website URLs) must not be cached or stored beyond the allowed exceptions. The
app saves only place IDs and app-created data. Review the Maps Service Specific
Terms before changing this.

In the `leads` table, `label`, `operator_notes` and `website_url` are entered by
you, not copied from Google responses. `search_niche` and `search_location` are
your own search inputs.
