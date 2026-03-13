-- Scan credits — per-user balance for paid scan unlocks
-- Alpha Brief grants 1 credit, Alpha Brief Plus grants 3 credits.
-- Deducting 1 credit upgrades a scan from free to paid tier.

CREATE TABLE IF NOT EXISTS scan_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  remaining INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: users can read their own credits, service role manages writes
ALTER TABLE scan_credits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own scan credits' AND tablename = 'scan_credits'
  ) THEN
    CREATE POLICY "Users see own scan credits" ON scan_credits
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
