-- Add Referral Reward Config Columns

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS referral_reward_name  TEXT    DEFAULT 'Standard Referral';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS referral_reward_type  TEXT    DEFAULT 'flat';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS referral_reward_value NUMERIC DEFAULT 10;
