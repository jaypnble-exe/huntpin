-- 009_place_emails.sql
-- Run once in the Supabase SQL Editor after 008_unknown_presence_not_a_fit.sql.
-- Adds one column with a default; changes no existing data. Then re-import to
-- fill it: npm run import:places -- --area jeddah, then
-- npm run import:foursquare -- --area jeddah.
--
-- Business emails listed in the open data (Overture "emails", Foursquare
-- "email"). Many are personal inboxes from Facebook pages: contact one
-- business at a time, manually, and honour "do not contact".

alter table public.places
  add column emails text[] not null default '{}' check (cardinality(emails) <= 5);
