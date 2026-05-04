-- Run once in Supabase → SQL Editor → New Query
-- Adds a custom price column to bookings.
-- Null = use catalog estimate. A set value = admin-defined price.

alter table bookings add column if not exists price integer;
