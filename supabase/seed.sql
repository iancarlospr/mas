-- Seed data for local development ONLY
-- Apply with: supabase db reset

-- Insert test scan data for UI development
INSERT INTO scans (id, user_id, url, domain, tier, status, marketing_iq, created_at, completed_at)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   NULL,
   'https://stripe.com', 'stripe.com', 'full', 'complete', 87, now() - interval '2 days', now() - interval '2 days' + interval '90 seconds'),
  ('00000000-0000-0000-0000-000000000002',
   NULL,
   'https://vercel.com', 'vercel.com', 'peek', 'passive', NULL, now() - interval '5 minutes', NULL),
  ('00000000-0000-0000-0000-000000000003',
   NULL,
   'https://linear.app', 'linear.app', 'full', 'complete', 72, now() - interval '1 day', now() - interval '1 day' + interval '75 seconds');

-- Stable completed scan for E2E tests (referenced by visual-regression and anonymous-scan specs)
INSERT INTO scans (id, user_id, url, domain, tier, status, marketing_iq, created_at, completed_at)
VALUES
  ('test-completed-scan-id', NULL,
   'https://example.com', 'example.com', 'full', 'complete', 72,
   now() - interval '1 hour', now() - interval '1 hour' + interval '60 seconds')
ON CONFLICT (id) DO NOTHING;

-- Module results for the E2E test scan
INSERT INTO module_results (scan_id, module_id, status, data, created_at)
VALUES
  ('test-completed-scan-id', 'M01', 'success', '{"spf":{"exists":true}}'::jsonb, now()),
  ('test-completed-scan-id', 'M02', 'success', '{"cms":"WordPress"}'::jsonb, now())
ON CONFLICT (scan_id, module_id) DO NOTHING;
