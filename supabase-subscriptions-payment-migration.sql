-- Run in Supabase SQL Editor
-- Adds payment_method column to subscriptions table

alter table subscriptions
  add column if not exists payment_method text not null default 'Bank Transfer';
