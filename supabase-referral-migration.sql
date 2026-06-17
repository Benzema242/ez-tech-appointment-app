-- Add Referral Program Columns

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS referral_credit NUMERIC DEFAULT 0;

-- Index for fast referral code lookups
CREATE INDEX IF NOT EXISTS subscriptions_referral_code_idx ON subscriptions(referral_code);
CREATE INDEX IF NOT EXISTS subscriptions_referred_by_idx ON subscriptions(referred_by);
