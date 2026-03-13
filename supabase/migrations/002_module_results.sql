-- Module results: per-module scan output
CREATE TABLE IF NOT EXISTS module_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'partial', 'error', 'skipped')),
  data JSONB DEFAULT '{}',
  signals JSONB DEFAULT '[]',
  checkpoints JSONB DEFAULT '[]',
  score INTEGER,
  ai_synthesis JSONB,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(scan_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_module_results_scan ON module_results(scan_id);

-- RLS
ALTER TABLE module_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own module results' AND tablename = 'module_results'
  ) THEN
    CREATE POLICY "Users see own module results" ON module_results
      FOR SELECT USING (
        scan_id IN (SELECT id FROM scans WHERE user_id = auth.uid() OR user_id IS NULL)
      );
  END IF;
END $$;
