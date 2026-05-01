-- Run this once in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

create table if not exists bookings (
  id          bigint generated always as identity primary key,
  client      text not null,
  service     text not null,
  date        text not null,
  time        text not null,
  status      text not null default 'pending',
  phone       text not null,
  email       text,
  notes       text,
  source      text not null default 'website',
  duration    int  not null default 1,
  created_at  timestamptz default now()
);

-- Allow anyone to read and write (your app is the only access point)
alter table bookings enable row level security;

create policy "allow_all" on bookings
  for all using (true) with check (true);
