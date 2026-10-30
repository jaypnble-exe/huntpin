-- 002_places.sql
-- Run once in the Supabase SQL Editor after 001_initial.sql. Creates new tables
-- only; drops nothing.
--
-- Stores open places data imported from Overture Maps (licensed per source:
-- CDLA-Permissive-2.0, Apache-2.0 for Foursquare, CC0-1.0 for AllThePlaces).
-- Unlike Google Places content, this data may be stored, with attribution.
-- Each row keeps its source datasets and licenses so attribution stays correct.
--
-- Access: same model as 001. RLS on, no policies, no anon/authenticated grants.

create table public.places (
  -- Overture GERS ID.
  id text primary key check (char_length(id) between 1 and 100),
  source text not null default 'overture' check (source in ('overture')),
  source_release text not null,
  area text not null check (char_length(area) between 1 and 80),
  name text,
  basic_category text,
  taxonomy_primary text,
  websites text[] not null default '{}',
  socials text[] not null default '{}',
  phones text[] not null default '{}',
  -- Derived at import by src/lib/places/webPresence.ts. Describes what the data
  -- lists, not whether the business truly has a website.
  web_presence text not null check (
    web_presence in ('website_listed', 'social_only', 'no_website_listed', 'possibly_closed')
  ),
  has_instagram boolean not null default false,
  -- Overture existence confidence, 0 to 1.
  confidence double precision check (confidence between 0 and 1),
  operating_status text,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  source_datasets text[] not null default '{}',
  source_licenses text[] not null default '{}',
  imported_at timestamptz not null default now()
);
create index places_lat_lon_idx on public.places (lat, lon);
create index places_area_presence_idx on public.places (area, web_presence);
create index places_basic_category_idx on public.places (basic_category);

create table public.place_imports (
  id bigint generated always as identity primary key,
  source text not null,
  source_release text not null,
  area text not null,
  -- [west, south, east, north]
  bbox double precision[] not null check (array_length(bbox, 1) = 4),
  row_count integer,
  status text not null check (status in ('running', 'success', 'failure')),
  error_category text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.places enable row level security;
alter table public.place_imports enable row level security;

revoke all on table public.places, public.place_imports from anon, authenticated;
