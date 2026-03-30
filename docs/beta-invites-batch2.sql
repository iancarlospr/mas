-- Batch 2: 20 additional guest invite codes (Guest Invite 4–23)
-- Run in Supabase SQL Editor

INSERT INTO beta_invites (code, name, tier, scan_credits, chat_credits, max_uses) VALUES
  ('beta-guest-v3k9',   'Guest Invite 4',  'standard', 3, 25, 1),
  ('beta-guest-h7w2',   'Guest Invite 5',  'standard', 3, 25, 1),
  ('beta-guest-t9f4',   'Guest Invite 6',  'standard', 3, 25, 1),
  ('beta-guest-c2n8',   'Guest Invite 7',  'standard', 3, 25, 1),
  ('beta-guest-p6j1',   'Guest Invite 8',  'standard', 3, 25, 1),
  ('beta-guest-d8m5',   'Guest Invite 9',  'standard', 3, 25, 1),
  ('beta-guest-w4r7',   'Guest Invite 10', 'standard', 3, 25, 1),
  ('beta-guest-g1x6',   'Guest Invite 11', 'standard', 3, 25, 1),
  ('beta-guest-n5q3',   'Guest Invite 12', 'standard', 3, 25, 1),
  ('beta-guest-k8v2',   'Guest Invite 13', 'standard', 3, 25, 1),
  ('beta-guest-f3t9',   'Guest Invite 14', 'standard', 3, 25, 1),
  ('beta-guest-j7d4',   'Guest Invite 15', 'standard', 3, 25, 1),
  ('beta-guest-q2h8',   'Guest Invite 16', 'standard', 3, 25, 1),
  ('beta-guest-x6c1',   'Guest Invite 17', 'standard', 3, 25, 1),
  ('beta-guest-b9p5',   'Guest Invite 18', 'standard', 3, 25, 1),
  ('beta-guest-m1w7',   'Guest Invite 19', 'standard', 3, 25, 1),
  ('beta-guest-r4n6',   'Guest Invite 20', 'standard', 3, 25, 1),
  ('beta-guest-s8f2',   'Guest Invite 21', 'standard', 3, 25, 1),
  ('beta-guest-y5k3',   'Guest Invite 22', 'standard', 3, 25, 1),
  ('beta-guest-e7j9',   'Guest Invite 23', 'standard', 3, 25, 1)
ON CONFLICT (code) DO NOTHING;
