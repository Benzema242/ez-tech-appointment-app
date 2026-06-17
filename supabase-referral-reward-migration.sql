-- Referral Reward Config Migration
-- Adds per-subscriber reward type, name, and value for customizable referral incentives
-- Run in Supabase SQL Editor

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS referral_reward_name  TEXT    DEFAULT 'Standard Referral';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS referral_reward_type  TEXT    DEFAULT 'flat';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS referral_reward_value NUMERIC DEFAULT 10;
