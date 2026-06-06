-- EZ Tech Appointments -- Main Database Setup
-- Run once in Supabase: Dashboard -> SQL Editor -> New Query
-- Safe to re-run (all statements use IF NOT EXISTS / IF NOT EXISTS guards)

-- =========================================================
-- BOOKINGS
-- =========================================================
create table if not exists bookings (
  id             bigint generated always as identity primary key,
  client         text        not null,
  service        text[]      not null,
  date           text        not null,
  time           text        not null,
  status         text        not null default 'pending',
  phone          text        not null,
  email          text,
  notes          text,
  source         text        not null default 'website',
  duration       int         not null default 1,
  price          integer,
  paid           boolean     not null default false,
  reminder_sent  boolean     not null default false,
  deposit_paid   boolean     not null default false,
  deposit_amount integer,
  deposit_date   text,
  deposit_method text,
  deposit_note   text,
  created_at     timestamptz          default now()
);

alter table bookings enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'bookings' and policyname = 'allow_all'
  ) then
    create policy "allow_all" on bookings for all using (true) with check (true);
  end if;
end $$;

-- =========================================================
-- BLACKOUT DATES
-- =========================================================
create table if not exists blackout_dates (
  id         bigint generated always as identity primary key,
  date       text not null,
  reason     text,
  start_time text,
  end_time   text
);

alter table blackout_dates enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'blackout_dates' and policyname = 'allow_all'
  ) then
    create policy "allow_all" on blackout_dates for all using (true) with check (true);
  end if;
end $$;
