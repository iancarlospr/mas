-- Auto-grant 1 free scan credit on user signup.
-- Uses a Postgres trigger on auth.users so it can't be skipped by application code.
-- The scan_credits table + decrement_scan_credits RPC handle all authorization.

-- Trigger function: insert scan_credits(user_id, remaining=1) on new user
CREATE OR REPLACE FUNCTION grant_free_scan_credit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.scan_credits (user_id, remaining, updated_at)
  VALUES (NEW.id, 1, now())
  ON CONFLICT (user_id) DO NOTHING;  -- idempotent: don't overwrite if row exists
  RETURN NEW;
END;
$$;

-- Attach to auth.users insert (fires after signup)
DROP TRIGGER IF EXISTS on_user_created_grant_scan_credit ON auth.users;
CREATE TRIGGER on_user_created_grant_scan_credit
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION grant_free_scan_credit();

-- Backfill: grant 1 free credit to existing users who have no scan_credits row.
-- Users who already purchased (and have credits) are unaffected due to ON CONFLICT DO NOTHING.
INSERT INTO scan_credits (user_id, remaining, updated_at)
SELECT id, 1, now()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM scan_credits)
ON CONFLICT (user_id) DO NOTHING;
