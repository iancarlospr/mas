-- Scans table: core scan tracking
CREATE TABLE scans (
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
CREATE INDEX idx_scans_user ON scans(user_id);
CREATE INDEX idx_scans_domain ON scans(domain);
CREATE INDEX idx_scans_status ON scans(status);
CREATE INDEX idx_scans_cache ON scans(domain, tier, status, created_at DESC);

-- RLS
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own scans" ON scans
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anon can insert scans" ON scans
  FOR INSERT WITH CHECK (true);
