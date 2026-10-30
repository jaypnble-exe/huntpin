-- 010_deals.sql
-- Run once in the Supabase SQL Editor after 009_place_emails.sql.
-- Adds deal stages after a reply, a deal value, and stage dates. Adds columns
-- and a trigger; existing leads keep their status and data.
--
-- Stages after "replied": meeting -> proposal_sent -> won / lost.

do $$
declare r record;
begin
  -- Drop the existing check constraint on lead_status, whatever its name.
  for r in
    select conname
    from pg_constraint
    where contype = 'c'
      and conrelid = 'public.leads'::regclass
      and pg_get_constraintdef(oid) like '%lead_status%'
  loop
    execute format('alter table public.leads drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.leads add constraint leads_lead_status_check check (
  lead_status in (
    'new', 'reviewed', 'contacted', 'replied', 'follow_up',
    'meeting', 'proposal_sent', 'won', 'lost',
    'not_interested', 'do_not_contact', 'not_a_fit'
  )
);

alter table public.leads
  -- Expected or agreed project value, in the app's currency (SAR). Operator-entered.
  add column deal_value numeric(12, 2) check (deal_value >= 0 and deal_value < 10000000),
  -- When the status last changed (for "days in stage").
  add column status_changed_at timestamptz not null default now(),
  -- When the deal was won or lost; cleared if it is reopened.
  add column closed_at timestamptz;

-- Existing leads: best available guess for when their status last changed.
update public.leads set status_changed_at = updated_at;

create index leads_closed_at_idx on public.leads (closed_at) where closed_at is not null;

create function public.set_lead_stage_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lead_status is distinct from old.lead_status then
    new.status_changed_at := now();
    if new.lead_status in ('won', 'lost') then
      new.closed_at := now();
    else
      new.closed_at := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger leads_set_stage_dates
before update on public.leads
for each row execute function public.set_lead_stage_dates();

revoke execute on function public.set_lead_stage_dates() from public, anon, authenticated;
