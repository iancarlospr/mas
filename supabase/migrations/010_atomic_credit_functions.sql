-- Atomic credit operations — eliminates race conditions in concurrent requests.
-- All functions use SECURITY DEFINER to bypass RLS (called via service role).

-- ═══════════════════════════════════════════════════════════════
-- CHECK constraints — belt-and-suspenders against negative balances
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scan_credits_non_negative'
  ) THEN
    ALTER TABLE scan_credits ADD CONSTRAINT scan_credits_non_negative CHECK (remaining >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_credits_non_negative'
  ) THEN
    ALTER TABLE chat_credits ADD CONSTRAINT chat_credits_non_negative CHECK (remaining >= 0);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- SCAN CREDITS
-- ═══════════════════════════════════════════════════════════════

-- Atomically add scan credits (upsert — creates row if first purchase)
CREATE OR REPLACE FUNCTION add_scan_credits(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_remaining INTEGER;
BEGIN
  INSERT INTO scan_credits (user_id, remaining, updated_at)
  VALUES (p_user_id, p_amount, now())
  ON CONFLICT (user_id) DO UPDATE
    SET remaining = scan_credits.remaining + p_amount,
        updated_at = now()
  RETURNING remaining INTO new_remaining;

  RETURN new_remaining;
END;
$$;

-- Atomically decrement scan credits (fails if insufficient)
CREATE OR REPLACE FUNCTION decrement_scan_credits(p_user_id UUID, p_amount INTEGER DEFAULT 1)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_remaining INTEGER;
BEGIN
  UPDATE scan_credits
  SET remaining = remaining - p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
    AND remaining >= p_amount
  RETURNING remaining INTO new_remaining;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient scan credits';
  END IF;

  RETURN new_remaining;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- CHAT CREDITS
-- ═══════════════════════════════════════════════════════════════

-- Atomically add chat credits (upsert)
CREATE OR REPLACE FUNCTION add_chat_credits(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_remaining INTEGER;
BEGIN
  INSERT INTO chat_credits (user_id, remaining, updated_at)
  VALUES (p_user_id, p_amount, now())
  ON CONFLICT (user_id) DO UPDATE
    SET remaining = chat_credits.remaining + p_amount,
        updated_at = now()
  RETURNING remaining INTO new_remaining;

  RETURN new_remaining;
END;
$$;

-- Atomically decrement chat credits (fails if insufficient)
CREATE OR REPLACE FUNCTION decrement_chat_credits(p_user_id UUID, p_amount INTEGER DEFAULT 1)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_remaining INTEGER;
BEGIN
  UPDATE chat_credits
  SET remaining = remaining - p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
    AND remaining >= p_amount
  RETURNING remaining INTO new_remaining;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient chat credits';
  END IF;

  RETURN new_remaining;
END;
$$;
