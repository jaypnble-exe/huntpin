-- 006_follow_ups.sql
-- Run once in the Supabase SQL Editor after 005_scores_chains_confirmations.sql.
-- Adds two columns, then gives already-contacted leads a reminder date.

-- Next follow-up date (operator's local date). Cleared when a lead replies,
-- declines, or opts out, and after the maximum number of follow-ups.
alter table public.leads
  add column follow_up_on date,
  add column follow_up_count smallint not null default 0 check (follow_up_count between 0 and 10);

create index leads_follow_up_on_idx on public.leads (follow_up_on) where follow_up_on is not null;

-- Backfill: leads contacted before reminders existed get one 4 days after their
-- last contact (Saudi time), matching FOLLOW_UP_AFTER_DAYS in the app.
update public.leads
set follow_up_on = (last_contacted_at at time zone 'Asia/Riyadh')::date + 4
where lead_status in ('contacted', 'follow_up')
  and last_contacted_at is not null
  and follow_up_on is null;
