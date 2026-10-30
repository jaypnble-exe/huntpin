-- 005_scores_chains_confirmations.sql
-- Run once in the Supabase SQL Editor after 004_website_signals.sql.
-- Adds columns with defaults; changes no existing values. After running it,
-- re-run the import (npm run import:places -- --area jeddah) to fill in
-- scores and chain sizes.

-- How many places in the same area share this name (chain detection), and a
-- 0-100 lead score computed at import by src/lib/places/leadScore.ts.
alter table public.places
  add column chain_size integer not null default 1 check (chain_size >= 1),
  add column lead_score smallint not null default 0 check (lead_score between 0 and 100);

create index places_area_score_idx on public.places (area, lead_score desc);

-- Website-review opportunities the operator confirmed by looking at the site.
-- Only these are added to the personalised outreach draft.
alter table public.leads
  add column confirmed_opportunities text[] not null default '{}'
    check (cardinality(confirmed_opportunities) <= 20);
