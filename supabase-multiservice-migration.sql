-- ─────────────────────────────────────────────────────────────────────────
-- Run this ONCE in Supabase → SQL Editor → New Query
-- Converts the 'service' column from text to text[] so bookings can have
-- multiple services.  Existing single-service rows are automatically wrapped
-- in an array: "cctv_assess" → {"cctv_assess"}
-- ─────────────────────────────────────────────────────────────────────────

alter table bookings
  alter column service type text[]
  using array[service];
