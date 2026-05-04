-- ─────────────────────────────────────────────────────────────────────────
-- Run this ONCE in Supabase → SQL Editor → New Query
-- Sets up the admin password backend (bcrypt via pgcrypto, never in client bundle)
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Enable pgcrypto for bcrypt hashing
create extension if not exists pgcrypto;

-- 2. Admin config table (stores only the bcrypt hash, never the plain password)
create table if not exists admin_config (
  id            int  primary key default 1 check (id = 1),  -- single-row table
  password_hash text not null
);

-- 3. Row-level security: no direct client access
alter table admin_config enable row level security;
-- (no policies added = anon/authenticated roles cannot read or write directly)

-- 4. Verify password RPC — returns true/false, the hash is never sent to the client
create or replace function verify_admin_password(pw text)
returns boolean
language sql security definer
as $$
  select exists (
    select 1 from admin_config
    where id = 1 and password_hash = crypt(pw, password_hash)
  );
$$;

-- 5. Change password RPC — old password required before updating
create or replace function change_admin_password(old_pw text, new_pw text)
returns boolean
language plpgsql security definer
as $$
declare
  rows_updated int;
begin
  update admin_config
  set    password_hash = crypt(new_pw, gen_salt('bf'))
  where  id = 1
  and    password_hash = crypt(old_pw, password_hash);

  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$;

-- 6. Grant execute to the anon role (called by the frontend with the anon key)
grant execute on function verify_admin_password(text)       to anon;
grant execute on function change_admin_password(text, text) to anon;

-- 7. Seed the initial admin password
--    IMPORTANT: replace the placeholder below with your actual password,
--    then run the query.  Do NOT commit this file with a real password in it.
insert into admin_config (id, password_hash)
values (1, crypt('RCNov2821#', gen_salt('bf')))
on conflict (id) do nothing;
