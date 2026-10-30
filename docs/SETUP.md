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
3. **Run the migration.** Open the SQL Editor, paste
   `supabase/migrations/001_initial.sql` and run it once. It creates the
   tables `usage_events`, `app_settings` and `leads` plus two counter
   functions. It drops nothing.
4. **Access model.** RLS is on for every table, with no policies, and anon and
   authenticated roles have no grants. The publishable key can therefore read
   or write nothing. Only the app's server (with the secret key) can.

The usage counter lives in Supabase. The limit check and the request record
happen in one database function, so simultaneous searches cannot both pass. If
Supabase is unreachable, the app refuses searches.

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
