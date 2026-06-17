-- Backfill referral codes for existing subscribers that don't have one
-- Run in Supabase SQL Editor

DO $$
DECLARE
  sub    RECORD;
  chars  TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code   TEXT;
BEGIN
  FOR sub IN SELECT id FROM subscriptions WHERE referral_code IS NULL LOOP
    LOOP
      code := 'EZT-';
      FOR i IN 1..6 LOOP
        code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM subscriptions WHERE referral_code = code);
    END LOOP;
    UPDATE subscriptions SET referral_code = code WHERE id = sub.id;
  END LOOP;
END $$;
