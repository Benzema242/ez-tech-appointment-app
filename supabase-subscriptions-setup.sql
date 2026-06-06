-- EZ Tech Appointments -- Subscriptions & Payments Setup
-- Run once in Supabase: Dashboard -> SQL Editor -> New Query
-- Safe to re-run (all statements use IF NOT EXISTS guards)

-- =========================================================
-- SUBSCRIPTIONS
-- =========================================================
create table if not exists subscriptions (
  id               bigint      generated always as identity primary key,
  name             text        not null,
  phone            text,
  email            text,
  plan             text        not null check (plan in ('IPTV', 'Movies & TV')),
  duration_months  integer     not null default 1,
  price            integer     not null,
  devices          integer     not null default 1,
  payment_method   text        not null default 'Bank Transfer',
  username         text,
  password         text,
  start_date       date        not null default current_date,
  expiration       timestamptz not null,
  status           text        not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  reminded_7d      boolean     not null default false,
  reminded_2d      boolean     not null default false,
  reminded_expired boolean     not null default false,
  notes            text,
  created_at       timestamptz not null default now()
);

create index if not exists subscriptions_expiration_idx on subscriptions (expiration);
create index if not exists subscriptions_status_idx     on subscriptions (status);

alter table subscriptions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'subscriptions' and policyname = 'allow_all'
  ) then
    create policy "allow_all" on subscriptions for all using (true) with check (true);
  end if;
end $$;

-- =========================================================
-- PAYMENTS (subscription payment log)
-- =========================================================
create table if not exists payments (
  id              bigint      generated always as identity primary key,
  subscription_id bigint      references subscriptions(id) on delete cascade,
  amount          integer     not null default 0,
  payment_method  text,
  note            text,
  paid_at         timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

alter table payments enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'payments' and policyname = 'allow_all'
  ) then
    create policy "allow_all" on payments for all using (true) with check (true);
  end if;
end $$;
