-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Creates the subscriptions table for IPTV & Movies/TV subscription management

create table if not exists subscriptions (
  id               bigint generated always as identity primary key,
  name             text not null,
  phone            text,
  email            text,
  plan             text not null check (plan in ('IPTV', 'Movies & TV')),
  duration_months  integer not null default 1,
  price            integer not null,
  devices          integer not null default 1,
  username         text,
  password         text,
  start_date       date not null default current_date,
  expiration       timestamptz not null,
  status           text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  reminded_7d      boolean not null default false,
  reminded_2d      boolean not null default false,
  reminded_expired boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now()
);

-- Indexes for the daily cron job (reminder checks by expiration date)
create index if not exists subscriptions_expiration_idx on subscriptions (expiration);
create index if not exists subscriptions_status_idx on subscriptions (status);

-- RLS
alter table subscriptions enable row level security;

create policy "allow_all" on subscriptions
  for all using (true) with check (true);
