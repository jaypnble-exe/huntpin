# CLAUDE.md — Google Maps Lead Finder

## Project goal

Build a small, reliable lead-generation dashboard for a freelance web/mobile development business.

The system should help find local businesses, assess whether they may benefit from a website or digital improvement, and prepare personalized outreach drafts. It must be configurable so the user can switch between niches and locations without changing code.

Initial example:
- Niche: restaurants and cafés
- Location: Jeddah, Saudi Arabia
- Initial search batch: no more than 10 businesses while validating the integration
- Main services offered: website development/redesign, custom business systems, mobile apps, and AI automations

**Primary constraint: target $0 in Google API charges during initial development and testing.** Do not assume this is guaranteed just because an API has a free usage cap. Implement safeguards and verify the SKU and current free usage allowance before running real searches.

## Direction update (2026-10-30): open-data map

The owner chose to build a Pindrop-style map (businesses that appear to have no
website, including social/Instagram-only sellers) on **open data** instead of
Google Places. This section takes precedence where it conflicts with the
Google-specific sections below.

- **Primary data: Overture Maps places** (public S3, no account, no cost).
  Licensed per source: CDLA-Permissive-2.0, Apache-2.0 (Foursquare), CC0-1.0
  (AllThePlaces). It may be stored with attribution, so it lives in the Supabase
  `places` table (`supabase/migrations/002_places.sql`). Keep each row's
  `source_datasets` and `source_licenses`.
- **Import:** `npm run import:places -- --area <name> [--dry-run]`
  (`scripts/import-overture.ts`). Areas live in `src/lib/places/areas.ts`; a
  bbox may span at most 1 degree and an import at most 100,000 rows.
- **Web presence labels** (`src/lib/places/webPresence.ts`): `website_listed`,
  `social_only`, `no_website_listed`, `possibly_closed`. They describe what the
  data *lists*. Never present them as proof that a business has no website.
  Most Jeddah records come from Meta, so `social_only` usually means a Facebook
  page with no website listed.
- **Map: MapLibre GL JS with OpenFreeMap tiles** (no key, no account). Show the
  required attribution: Overture Maps Foundation, plus "Copyright 2024
  Foursquare Labs, Inc. All rights reserved." when Foursquare-sourced records
  are shown, and the tile/OpenStreetMap credits.
- **Google Places stays optional** and off by default. All Google safeguards
  below still apply to it. Never mix Google Places content into the `places`
  table.
- **Foursquare OS Places** (Apache-2.0, "Copyright 2024 Foursquare Labs, Inc.
  All rights reserved.") is the second source: `npm run import:foursquare --
  --area <name>` with `FOURSQUARE_PLACES_TOKEN` in `.env.local` (never print
  it). It adds open, recently updated business places not already on the
  map (ids prefixed `fsq:`) and Instagram handles for matching Overture
  places. Chain sizes and lead scores are recomputed across all sources by
  `rescoreArea` after every import.
- **Refresh:** `npm run refresh:places` re-imports the newest Overture release
  and Foursquare with pruning. Pruning never removes places saved as leads,
  and is skipped when an import is under half the existing size.
- **Batch website review** is allowed only as an operator-clicked action on
  saved leads: at most 20 per run, one check every 7 seconds, skipping leads
  checked in the last 30 days and opted-out leads. Never schedule it.
- **Never scrape Instagram, Facebook or Google Maps** to find sellers, ratings
  or photos.
- **Google ratings/photos:** only via Maps URLs links ("Find on Google Maps";
  no key, no billing). The owner declined anything that needs a Google billing
  account (Maps Embed API, Places API ratings/photos), even if usage is free.
- Zero cost remains a hard requirement: free tiers only, no paid services.

## Working principles

1. Inspect the existing repository before making changes. Preserve existing conventions and avoid replacing working code without a reason.
2. Work incrementally. Build and test one vertical slice at a time.
3. Do not implement features that incur charges or send external messages without explicit user approval.
4. Never scrape Google Maps webpages or use unofficial techniques to bypass Google's API, quotas, or terms.
5. Do not expose secrets in client-side code, source control, logs, or generated UI.
6. Prefer clear, maintainable TypeScript and accessible UI.
7. Ask before making destructive database changes, changing production infrastructure, or running a large batch job.

## Suggested stack

Use these choices unless the existing repository already has an established equivalent:

- Next.js with App Router and TypeScript
- Tailwind CSS for styling, if already present or easy to add
- Supabase/PostgreSQL for app-owned lead records, settings, search runs, and outreach status
- Google Places API (New) for business discovery
- Server-side Node.js functions for Places requests and website checks
- Vercel for deployment, if appropriate for the existing project
- Optional later: a background job system for larger searches
- Optional later: OpenAI API for drafting messages; initially, use deterministic templates and avoid another paid dependency

Do not add a queue/background-job service in the first milestone unless needed. The initial version should run a small, user-triggered search.

## First milestone: minimum viable lead finder

Implement these features in order:

1. **Search form**
   - Niche / business type
   - City or location
   - Maximum results, hard-limited to 10 during initial testing
   - Search button with loading, success, and error states
   - Show a clear notice that Google API usage may incur charges and that the app has a safety limit

2. **Google Places API (New) integration**
   - Call Places API only from the server.
   - Read the API key from `GOOGLE_MAPS_API_KEY`.
   - Use Text Search (New) with an explicit, minimal field mask. Never request `*`.
   - Start with only fields necessary to identify and deduplicate a result, such as place ID, display name, and formatted address, where supported.
   - Do not request phone numbers, photos, reviews, opening hours, or Place Details unless a later, justified feature requires them.
   - Do not make a second API request per result by default.
   - Do not auto-run searches on page load, on a timer, or when the user changes form inputs.
   - Request no more than the configured hard maximum; initial maximum is 10.
   - Handle pagination carefully. Do not fetch additional pages automatically in the first milestone.
   - Use the official current Google API endpoint, request format, field names, and authentication headers. Verify against current official documentation before coding.

3. **Usage and cost safeguards**
   - Add a server-side kill switch, e.g. `PLACES_SEARCH_ENABLED=false` by default.
   - Require the operator to explicitly enable Places search in environment configuration before making API calls.
   - Add `MAX_RESULTS_PER_SEARCH=10` and enforce it on the server, not just in the UI.
   - Add a server-side monthly request counter for this app and a configurable limit, e.g. `MAX_PLACES_REQUESTS_PER_MONTH=10` during initial testing.
   - Refuse to make a request when the limit is reached or usage tracking is unavailable.
   - Record each attempted request, timestamp, success/failure, and known request count. Never log the API key or full authorization headers.
   - Include a global “Pause searches” setting in the app.
   - Show current app-tracked usage and the remaining app limit in the dashboard.
   - Add a clear confirmation before the first real API search.
   - Treat application limits as a safeguard, not as a guarantee of zero billing. Other apps/projects may use the same billing account, and the app's counter cannot see their usage.
   - Do not claim that a request is free until the current applicable Google SKU, requested field mask, current pricing/free cap, and actual billing report have been checked.
   - Do not create or change Google Cloud billing, quota, or project settings automatically. Provide instructions to the operator instead.
   - Google Cloud budget alerts are notifications, not hard spending caps. Explain this in the UI or setup guide.

4. **Website status checks**
   - In the first milestone, only check a website if its URL is already available from a lawful, permitted source or manually entered by the operator.
   - Do not add a Places field that triggers a higher-priced SKU without explicit approval.
   - Add a “Check website” action that is user-triggered, not automatic for every lead.
   - Validate and normalize URLs; allow only `http:` and `https:`.
   - Protect against SSRF: block localhost, private, link-local, loopback, and reserved IP ranges; re-check DNS resolutions and redirect destinations; set strict timeouts and response-size limits.
   - Do not execute page JavaScript or download large assets. Use lightweight HTTP checks.
   - Store the check timestamp, HTTP status/category, final URL, and error category—not page contents.
   - Label findings carefully: “website URL not listed,” “reachable,” “unreachable,” or “needs manual review.” Do not declare a website “outdated” based only on a simplistic heuristic.
   - Website checking itself must not trigger Google API calls.

5. **Lead dashboard**
   - Table/list columns: business name, address, website status (if known), lead status, last checked, and actions.
   - Filters: niche, location/search run, website status, and outreach status.
   - Lead statuses: `new`, `reviewed`, `contacted`, `replied`, `follow_up`, `not_interested`, `do_not_contact`.
   - Deduplicate using Google place ID where allowed, and avoid repeated processing.
   - Provide CSV export only for data that may lawfully be exported and stored under applicable Google Maps Platform terms. Do not export restricted Places content.
   - Do not treat a missing website listing as proof that the business has no website.

6. **Outreach draft helper**
   - Generate drafts only; never send messages automatically.
   - Default general message:

     > Hi! 👋 I came across your business online and wanted to reach out.
     >
     > I’m a web and mobile app developer, and I help businesses build and improve websites, develop custom systems and mobile applications, and implement AI automations to streamline their operations.
     >
     > I was wondering if you have any digital projects, website improvements, or automation ideas that you’d like to explore. I’d be happy to discuss how I could help!
     >
     > Would you be open to a quick chat? 😊

   - The owner changed "on Google Maps" to "online" on 2026-10-30, because leads now come from open data. An Arabic version lives with the English one in `src/lib/leads/outreach.ts`.
   - Allow the operator to edit and copy the draft.
   - Do not invent business-specific observations. Only mention a website issue if it was actually checked and supported.
   - Track contact date and outcome manually.
   - Include a `do_not_contact` state and never generate follow-up suggestions for those leads.
   - Encourage respectful, low-volume outreach and compliance with applicable local anti-spam, privacy, and platform rules. Do not implement bulk unsolicited WhatsApp or email sending.

## Google Places data and terms

- Use the official Google Places API (New); do not scrape Google Maps pages.
- Review current Google Maps Platform Terms, Places API policies, storage/caching restrictions, attribution requirements, and pricing before implementation and before launch.
- Place IDs have special storage treatment, but do not assume that names, addresses, or other Places content may be retained indefinitely.
- Keep the app's schema designed so restricted API-returned fields can be transient or refreshed/deleted as required by current terms.
- Do not build a permanent database of Places API content unless the planned storage and use are permitted by current terms.
- Separate app-created information (operator notes, contact status, outreach history, manual website-check results) from API-sourced content.
- If the desired long-term storage workflow is not permitted, stop and explain the constraint before implementing it. Do not try to evade policy through third-party scraping.

## Environment configuration

Create `.env.example` with placeholder values only. Never write real credentials into this file.

Suggested variables:

```dotenv
# Server-only secret. Never prefix with NEXT_PUBLIC_.
GOOGLE_MAPS_API_KEY=

# Disabled by default. Set true only after reviewing billing, SKU, and quota.
PLACES_SEARCH_ENABLED=false

# Safety limits for initial testing
MAX_RESULTS_PER_SEARCH=10
MAX_PLACES_REQUESTS_PER_MONTH=10

# Supabase server credentials (only if Supabase is configured)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Rules:
- Keep `.env.local` ignored by Git.
- Never expose `GOOGLE_MAPS_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to browser bundles.
- Validate environment variables at server startup or at the point of use.
- Fail closed if required safety settings are missing.
- If Supabase is not yet configured, use a temporary local-only development store only for non-sensitive test data; do not silently add a paid dependency.

## Suggested data model

Adapt to the existing database and current Google policy before creating migrations.

### `search_runs`
- `id`
- `query_niche`
- `query_location`
- `requested_limit`
- `status`
- `places_request_count`
- `started_at`
- `completed_at`
- `error_category`

### `leads`
- `id`
- `place_id` (when allowed under current Google policy)
- `business_name` (store only as permitted; otherwise transient/refreshable)
- `formatted_address` (store only as permitted; otherwise transient/refreshable)
- `website_url` (source and retention must be documented)
- `website_status`
- `website_checked_at`
- `lead_status`
- `operator_notes`
- `first_contacted_at`
- `last_contacted_at`
- `created_at`
- `updated_at`

### `usage_events`
- `id`
- `event_type`
- `request_count`
- `sku_if_known`
- `success`
- `created_at`
- `error_category`

Do not create migrations until the current repository and existing database have been inspected. Use row-level security if Supabase is used. Never expose the service-role key to clients.

## Security and reliability requirements

- Validate all inputs on the server.
- Restrict query length and result limit; reject malformed or unexpectedly large requests.
- Add rate limiting to search endpoints.
- Handle API quota errors, timeouts, network failures, and malformed responses safely.
- Do not retry failed Places calls automatically in the first milestone; retries can cause extra requests.
- Do not log secrets or unnecessary personal data.
- Protect all dashboard routes and mutation endpoints with authentication before deployment to a public URL.
- Use safe URL handling and SSRF protections for website checks.
- Keep dependency count small and explain any new dependency.
- Add unit tests for usage limits, kill switch, input validation, duplicate handling, and website URL safety.
- Add an integration test with mocked Google responses so tests do not spend API quota.
- No production API calls in CI.

## UI expectations

Keep the interface simple and usable:
- Clean dashboard layout
- Search form at the top
- Usage indicator and search pause state visible
- Results table with clear website and outreach statuses
- Empty, loading, error, and quota-reached states
- Confirmation dialog before real API calls
- Responsive layout and accessible form labels
- Never display fake sample businesses as real search results; mark fixtures as demo data

## Definition of done for the first milestone

- The project runs locally using documented commands.
- No Google request is made when `PLACES_SEARCH_ENABLED=false`.
- The server rejects searches over the configured result limit.
- The server refuses requests when the app's monthly counter reaches its limit or cannot be checked.
- One explicitly approved test search can run with no automatic pagination or per-result detail requests.
- The requested field mask is minimal and documented.
- Search results are displayed with errors handled gracefully.
- The app does not claim the search is free until its applicable SKU and current billing status are verified.
- Website checks are manual, lightweight, and SSRF-protected.
- Outreach drafts are editable and copyable, never auto-sent.
- Google Maps Platform data retention rules have been reviewed before persisting/exporting API-sourced business fields.
- Tests cover safety controls and use mocked API responses.

## Instructions for Claude Code

At the start of work:

1. Inspect the repository structure, package manager, scripts, current framework, and existing database/auth setup.
2. Summarize the current architecture and identify what already exists.
3. Propose a short implementation plan for the first milestone.
4. Implement only the first small slice; do not scaffold the entire product blindly.
5. Run available lint, type-check, and test commands.
6. Report changed files, commands run, test results, any manual setup required, and any unresolved billing/policy risks.
7. If a requirement conflicts with the current repository or Google policy, explain the conflict and propose the safest compliant option before proceeding.

**First task:** inspect the existing repository and report the current structure. Do not make Google Places API calls yet. Then propose the first implementation step.
