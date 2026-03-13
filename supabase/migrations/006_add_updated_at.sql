-- Add updated_at column and auto-update trigger

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at to scans
ALTER TABLE scans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER scans_updated_at
  BEFORE UPDATE ON scans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add service role UPDATE policy for engine writes
CREATE POLICY "Service role can update scans" ON scans
  FOR UPDATE USING (auth.role() = 'service_role');
