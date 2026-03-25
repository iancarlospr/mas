-- Beta invite system — unique codes for beta testers
-- Each code grants bonus scan + chat credits on signup redemption.
-- Flow: invite URL → cookie → signup → POST /api/beta/redeem → credits granted.

CREATE TABLE IF NOT EXISTS beta_invites (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('standard', 'power')),
  scan_credits INTEGER NOT NULL DEFAULT 2,
  chat_credits INTEGER NOT NULL DEFAULT 25,
  max_uses INTEGER NOT NULL DEFAULT 1,
  times_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Redemption tracking (supports multi-use codes if needed in future)
CREATE TABLE IF NOT EXISTS beta_invite_redemptions (
  id BIGSERIAL PRIMARY KEY,
  invite_code TEXT NOT NULL REFERENCES beta_invites(code),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  redeemed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(invite_code, user_id)
);

-- RLS: service role only (no public access)
ALTER TABLE beta_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_invite_redemptions ENABLE ROW LEVEL SECURITY;

-- Seed all invite codes (standard tier: 2 scans, 25 chat credits)
INSERT INTO beta_invites (code, name, tier, scan_credits, chat_credits, max_uses) VALUES
  ('juanita-a7x3',      'Juanita',        'standard', 2, 25, 1),
  ('jorge-k9m2',        'Jorge',          'standard', 2, 25, 1),
  ('xavier-p4w8',       'Xavier',         'standard', 2, 25, 1),
  ('hernan-d6j5',       'Hernan',         'standard', 2, 25, 1),
  ('alex-r3n7',         'Alex',           'standard', 2, 25, 1),
  ('brendan-v8c1',      'Brendan',        'standard', 2, 25, 1),
  ('humberto-f2q9',     'Humberto',       'standard', 2, 25, 1),
  ('kris-t5h4',         'Kris',           'standard', 2, 25, 1),
  ('rubi-m7x6',         'Rubi',           'standard', 2, 25, 1),
  ('jl-w3k8',           'JL',             'standard', 2, 25, 1),
  ('aileen-g9p2',       'Aileen',         'standard', 2, 25, 1),
  ('pedro-n4v7',        'Pedro',          'standard', 2, 25, 1),
  ('adam-c8f3',         'Adam',           'standard', 2, 25, 1),
  ('popular-bank-h6r1', 'Popular Bank',   'standard', 2, 25, 1),
  ('senzary-j2m9',      'Senzary',        'standard', 2, 25, 1),
  ('santander-q5w4',    'Santander USA',  'standard', 2, 25, 1),
  ('ryder-b7t6',        'Ryder',          'standard', 2, 25, 1),
  ('investpr-x3k8',     'InvestPR',       'standard', 2, 25, 1),
  ('torlanco-f9n2',     'Torlanco',       'standard', 2, 25, 1),
  ('beta-guest-a4d7',   'Guest Invite 1', 'standard', 2, 25, 1),
  ('beta-guest-m8p3',   'Guest Invite 2', 'standard', 2, 25, 1),
  ('beta-guest-r6w1',   'Guest Invite 3', 'standard', 2, 25, 1)
ON CONFLICT (code) DO NOTHING;
