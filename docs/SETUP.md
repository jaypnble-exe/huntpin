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
| `MAX_PLACES_REQUESTS_PER_MONTH` | `10` | Counted in the local DB per UTC month; the code ceiling is 100 |
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
