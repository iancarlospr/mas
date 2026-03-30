-- Fix: Beta invites should give 2 PAID scans, not 1 paid + 1 free.
--
-- Root cause: tier logic uses `remaining > 0 ? 'paid' : 'full'` after deduction.
-- With scan_credits=2, the last credit always yields remaining=0 → 'full'.
-- Fix: bump to scan_credits=3 so both intended paid scans leave remaining > 0.
--
-- Three populations to fix:
--   A) Future redeemers: update beta_invites.scan_credits from 2 to 3
--   B) Already-redeemed users: add 1 scan credit to their balance
--   C) Already-run 'full' scans by beta users: upgrade tier to 'paid'

BEGIN;

-- A) Future redeemers
UPDATE beta_invites
SET scan_credits = 3
WHERE scan_credits = 2;

-- B) Already-redeemed users: +1 credit each
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id FROM beta_invite_redemptions
  LOOP
    PERFORM add_scan_credits(r.user_id, 1);
  END LOOP;
END;
$$;

-- C) Upgrade misclassified 'full' scans from beta users to 'paid'.
--    Excludes each user's very first scan (that one correctly used the free signup credit).
UPDATE scans
SET tier = 'paid'
WHERE tier = 'full'
  AND status = 'complete'
  AND user_id IN (SELECT DISTINCT user_id FROM beta_invite_redemptions)
  AND id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM scans
    WHERE user_id IN (SELECT DISTINCT user_id FROM beta_invite_redemptions)
    ORDER BY user_id, created_at ASC
  );

COMMIT;
