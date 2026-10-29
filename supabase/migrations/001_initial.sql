-- 001_initial.sql
-- Run once in the Supabase SQL Editor. Creates new tables only; drops nothing.
--
-- Stores app-owned data only. Leads keep the Google place ID (which Google
-- allows to be stored indefinitely) plus operator-entered data. No Google
-- Places names or addresses are stored.
--
-- Access: RLS is enabled on every table with no policies, and table grants are
-- revoked from anon/authenticated, so the publishable key can read or write
-- nothing. The app's server uses the secret key, which bypasses RLS.

-- Usage tracking -------------------------------------------------------------

create table public.usage_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  request_count integer not null check (request_count > 0),
  sku_if_known text,
  status text not null check (status in ('reserved', 'success', 'failure')),
  error_category text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index usage_events_created_at_idx on public.usage_events (created_at);

-- Requests counted in the current UTC calendar month.
create function public.places_requests_this_month()
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(request_count), 0)::integer
  from public.usage_events
  where created_at >= (date_trunc('month', now() at time zone 'UTC') at time zone 'UTC');
$$;

-- Checks the monthly limit and records one attempted request in a single
-- transaction. Returns the new event id, or null when the limit is reached.
-- Reserved rows count even if the request later fails (it may still be billed).
create function public.reserve_places_request(p_limit integer, p_sku text, p_event_type text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
begin
  -- Serialize reservations so concurrent searches cannot both pass the check.
  perform pg_advisory_xact_lock(hashtext('reserve_places_request'));
  if public.places_requests_this_month() + 1 > p_limit then
    return null;
  end if;
  insert into public.usage_events (event_type, request_count, sku_if_known, status)
  values (p_event_type, 1, p_sku, 'reserved')
  returning id into v_id;
  return v_id;
end;
$$;

-- Settings -------------------------------------------------------------------

create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Leads ----------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique check (char_length(place_id) between 1 and 300),
  -- Operator-entered, not copied from Places API responses.
  label text check (char_length(label) <= 120),
  operator_notes text check (char_length(operator_notes) <= 2000),
  search_niche text check (char_length(search_niche) <= 60),
  search_location text check (char_length(search_location) <= 80),
  lead_status text not null default 'new' check (
    lead_status in ('new', 'reviewed', 'contacted', 'replied', 'follow_up', 'not_interested', 'do_not_contact')
  ),
  -- Entered manually by the operator (source documented in docs/SETUP.md).
  website_url text check (website_url ~* '^https?://' and char_length(website_url) <= 2048),
  website_status text check (
    website_status in ('not_listed', 'reachable', 'unreachable', 'needs_manual_review')
  ),
  website_http_status integer,
  website_final_url text check (char_length(website_final_url) <= 2048),
  website_error_category text,
  website_checked_at timestamptz,
  first_contacted_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_lead_status_idx on public.leads (lead_status);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

-- Access control -------------------------------------------------------------

alter table public.usage_events enable row level security;
alter table public.app_settings enable row level security;
alter table public.leads enable row level security;

revoke all on table public.usage_events, public.app_settings, public.leads from anon, authenticated;

revoke execute on function public.places_requests_this_month() from public, anon, authenticated;
revoke execute on function public.reserve_places_request(integer, text, text) from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.places_requests_this_month() to service_role;
grant execute on function public.reserve_places_request(integer, text, text) to service_role;
