-- 003_leads_from_places.sql
-- Run once in the Supabase SQL Editor after 002_places.sql.
-- Lets a lead point at an imported open-data place instead of a Google place.
-- Changes the empty-or-small leads table in place; drops no data.

-- Google place ID becomes optional (Google search is now an optional extra).
alter table public.leads alter column place_id drop not null;

-- Link to the imported place. RESTRICT: a place that has a lead cannot be
-- deleted by a future data refresh, so saved leads never silently disappear.
alter table public.leads
  add column overture_place_id text unique
    references public.places (id) on update cascade on delete restrict;

-- Every lead must point at something.
alter table public.leads
  add constraint leads_has_place check (num_nonnulls(place_id, overture_place_id) >= 1);

create index leads_updated_at_idx on public.leads (updated_at desc);

comment on column public.leads.place_id is 'Google place ID (optional; only from the optional Google search).';
comment on column public.leads.overture_place_id is 'Imported open-data place (public.places.id).';
comment on column public.leads.label is 'Operator label. Defaults to the open-data place name when saved from the map.';
