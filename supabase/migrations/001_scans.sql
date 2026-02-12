-- Scans table: core scan tracking
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('peek', 'full', 'paid')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'passive', 'browser', 'ghostscan', 'external', 'synthesis', 'complete', 'failed', 'cancelled')),
  marketing_iq INTEGER,
  marketing_iq_result JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  country_code TEXT,
  cache_source UUID REFERENCES scans(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_domain ON scans(domain);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_cache ON scans(domain, tier, status, created_at DESC);

-- RLS
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own scans' AND tablename = 'scans'
  ) THEN
    CREATE POLICY "Users see own scans" ON scans
      FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon can insert scans' AND tablename = 'scans'
  ) THEN
    CREATE POLICY "Anon can insert scans" ON scans
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;
