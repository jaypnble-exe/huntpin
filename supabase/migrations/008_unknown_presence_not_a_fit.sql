-- 008_unknown_presence_not_a_fit.sql
-- Run once in the Supabase SQL Editor after 007_foursquare_and_refresh.sql.
-- Then rescore: npm run rescore:places -- --area jeddah
--
-- 1. New web presence "unknown": Foursquare rarely records websites, so a
--    Foursquare place with nothing listed is "website unknown", not
--    "no website listed". Overture places keep "no_website_listed".
-- 2. New lead status "not_a_fit": e.g. the business already has a website
--    (found on Google Maps). Hidden from the map; no drafts or reminders.

do $$
declare r record;
begin
  -- Drop the existing check constraints on these columns, whatever their names.
  for r in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and ((conrelid = 'public.places'::regclass and pg_get_constraintdef(oid) like '%web_presence%')
        or (conrelid = 'public.leads'::regclass and pg_get_constraintdef(oid) like '%lead_status%'))
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.places add constraint places_web_presence_check check (
  web_presence in ('website_listed', 'social_only', 'no_website_listed', 'unknown', 'possibly_closed')
);

alter table public.leads add constraint leads_lead_status_check check (
  lead_status in ('new', 'reviewed', 'contacted', 'replied', 'follow_up', 'not_interested', 'do_not_contact', 'not_a_fit')
);

update public.places
set web_presence = 'unknown'
where source = 'foursquare' and web_presence = 'no_website_listed';

create index places_area_source_idx on public.places (area, source);
