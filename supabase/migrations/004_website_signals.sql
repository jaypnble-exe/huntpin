-- 004_website_signals.sql
-- Run once in the Supabase SQL Editor after 003_leads_from_places.sql.
-- Adds one column; changes no existing data.
--
-- Yes/no signals from the manual website review (HTTPS, mobile viewport tag,
-- Arabic content, delivery-app links, ...). Page content is never stored.
-- Shape is defined by WebsiteSignals in src/lib/websiteSignals.ts.

alter table public.leads
  add column website_signals jsonb
    check (website_signals is null or (jsonb_typeof(website_signals) = 'object' and pg_column_size(website_signals) < 4096));

comment on column public.leads.website_signals is
  'Signals from the manual website review. Derived booleans and short labels only; never page content.';
