-- Migration: Remove peek tier
-- All scans now require authentication; peek tier is no longer used.

-- Upgrade existing peek scans to full
UPDATE scans SET tier = 'full' WHERE tier = 'peek';

-- Drop old constraint and add new one allowing only full/paid
ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_tier_check;
ALTER TABLE scans ADD CONSTRAINT scans_tier_check CHECK (tier IN ('full', 'paid'));
