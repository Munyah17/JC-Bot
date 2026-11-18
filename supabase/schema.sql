-- JC Insurance WhatsApp Bot — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- Conversation sessions (one row per WhatsApp number)
create table if not exists bot_sessions (
  phone       text primary key,
  state       text not null default 'START',
  data        jsonb not null default '{}'::jsonb,
  handoff     boolean not null default false,
  updated_at  timestamptz not null default now()
);

create index if not exists bot_sessions_updated_at_idx on bot_sessions (updated_at desc);

-- Event ledger: quotes, claims, agent handoffs
create table if not exists bot_events (
  id          bigint generated always as identity primary key,
  type        text not null check (type in ('quote', 'claim', 'handoff')),
  phone       text not null,
  ref_id      text,            -- e.g. QT-123456 or CLM-123456
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists bot_events_phone_idx on bot_events (phone);
create index if not exists bot_events_type_idx  on bot_events (type);
create index if not exists bot_events_ref_idx   on bot_events (ref_id);

-- Row Level Security: the bot uses the service_role key (bypasses RLS).
-- Enable RLS so the anon key (if ever exposed) cannot read customer data.
alter table bot_sessions enable row level security;
alter table bot_events   enable row level security;

-- Tell PostgREST to pick up the new tables immediately (avoids
-- "Could not find the table in the schema cache" on first writes).
notify pgrst, 'reload schema';
