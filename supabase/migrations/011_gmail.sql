-- 011_gmail.sql
-- Run once in the Supabase SQL Editor after 010_deals.sql.
-- Optional Gmail connection: HuntPin creates drafts in the operator's Gmail
-- (labelled HUNTPIN) and checks those conversations for replies. It never
-- sends email. Adds two new tables; existing data is not changed.

-- The one connected Gmail account. The refresh token is encrypted by the app
-- (AES-256-GCM, key GMAIL_TOKEN_KEY in the server environment, never here).
create table public.gmail_connection (
  id smallint primary key default 1 check (id = 1),
  email text not null check (char_length(email) <= 254),
  refresh_token_enc text not null check (char_length(refresh_token_enc) <= 4096),
  label_id text check (char_length(label_id) <= 200),
  connected_at timestamptz not null default now(),
  last_reply_check_at timestamptz
);

-- Conversations started from a HuntPin draft, by place, for the reply check.
-- Only Gmail ids and dates are stored, never message content.
create table public.gmail_threads (
  thread_id text primary key check (char_length(thread_id) <= 200),
  place_id text not null check (char_length(place_id) <= 200),
  draft_message_id text check (char_length(draft_message_id) <= 200),
  created_at timestamptz not null default now(),
  last_checked_at timestamptz,
  sent_seen_at timestamptz,
  replied_at timestamptz
);

create index gmail_threads_place_idx on public.gmail_threads (place_id);
create index gmail_threads_open_idx on public.gmail_threads (created_at) where replied_at is null;

-- Server-only: RLS on with no policies, so only the secret key can read them.
alter table public.gmail_connection enable row level security;
alter table public.gmail_threads enable row level security;
revoke all on public.gmail_connection from anon, authenticated;
revoke all on public.gmail_threads from anon, authenticated;
