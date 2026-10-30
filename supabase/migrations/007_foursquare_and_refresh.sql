-- 007_foursquare_and_refresh.sql
-- Run once in the Supabase SQL Editor after 006_follow_ups.sql.
-- Allows Foursquare places, adds a "last updated" date, and adds two
-- server-only functions used by the import and refresh scripts.

-- Foursquare OS Places (Apache-2.0) as a second source. Foursquare rows use
-- ids prefixed with "fsq:" so they never collide with Overture ids.
alter table public.places drop constraint places_source_check;
alter table public.places add constraint places_source_check check (source in ('overture', 'foursquare'));

-- When the source last updated the place (Foursquare date_refreshed).
alter table public.places add column refreshed_on date;

-- Bulk update of chain sizes and lead scores after an import (one call per
-- batch instead of one request per row). Returns the number of rows changed.
create function public.apply_place_scores(p_rows jsonb)
returns integer
language sql
set search_path = ''
as $$
  with input as (
    select * from jsonb_to_recordset(p_rows) as x(id text, chain_size integer, lead_score smallint)
  ), changed as (
    update public.places p
    set chain_size = input.chain_size, lead_score = input.lead_score
    from input
    where p.id = input.id
      and (p.chain_size is distinct from input.chain_size or p.lead_score is distinct from input.lead_score)
    returning 1
  )
  select count(*)::integer from changed;
$$;

-- Data refresh: removes places of one source and area that are no longer in
-- the latest release. Places saved as leads are always kept.
create function public.prune_places(p_area text, p_source text, p_keep_release text)
returns integer
language sql
set search_path = ''
as $$
  with removed as (
    delete from public.places p
    where p.area = p_area
      and p.source = p_source
      and p.source_release <> p_keep_release
      and not exists (select 1 from public.leads l where l.overture_place_id = p.id)
    returning 1
  )
  select count(*)::integer from removed;
$$;

revoke execute on function public.apply_place_scores(jsonb) from public, anon, authenticated;
revoke execute on function public.prune_places(text, text, text) from public, anon, authenticated;
grant execute on function public.apply_place_scores(jsonb) to service_role;
grant execute on function public.prune_places(text, text, text) to service_role;
