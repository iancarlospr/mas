/**
 * Builder's Reel v2 — "The marketer who builds"
 *
 * Format: 1920×1080 landscape
 * Duration: ~75 seconds
 * Tone: Upbeat, confident, credibility-first
 * Music: "Upbeat Happy Corporate" by kornevmusic (Pixabay, builder-music.mp3)
 *
 * Structure:
 *   1. GitHub avatar + name intro (3s)
 *   2. Big number hook ($43M) (3s)
 *   3. Career flash — logos + stats cycling (14s)
 *   4. Pivot — "But I've always been a builder" (3s)
 *   5. GitHub evolution — 2→11→76→305 (7s)
 *   6. The Build — Feb 2026 montage (12s)
 *   7. Before/After — animated (8s)
 *   8. Product stats (4s)
 *   9. Statement + CTA (5s)
 */

export const B_WIDTH = 1920;
export const B_HEIGHT = 1080;
export const B_FPS = 30;

export const BC = {
  void: '#0a0a0a',
  deep: '#2A1F27',
  mid: '#4A3844',
  base: '#FFB2EF',
  bright: '#FFC8F4',
  light: '#FFF0FA',
  white: '#FFFFFF',
  terminal: '#00FF88',
  gold: '#FFD700',
} as const;

const p = (name: string) => `progression/${name}`;
const l = (name: string) => `logos/${name}`;

export const LOGOS = {
  canon: l('canon.svg'),
  capitalOne: l('capitalone.svg'),
  amazon: l('amazon.svg'),
  moneyGroup: l('moneygroup.png'),
  compareCredit: l('comparecredit.svg'),
  mskcc: l('mskcc.png'),
  githubAvatar: l('github-avatar.png'),
} as const;

export const IMG = {
  github2015: p('github-2015-2_contributions.jpg'),
  github2018: p('github-2018-11_contributions.jpg'),
  github2024: p('github-2024-76_contributions.jpg'),
  github2026: p('github-2026-305_contributions.jpg'),
  aiApp3: p('AI Apps Inspiration 3.jpg'),
  slideInspo2: p('Presentation Slides Inspiration 2.jpeg'),
  branding: p('Gemini AI Chat Aligment on Branding.jpg'),
  ghost1: p('Ghost Inspiration 1.png'),
  uiInspo1: p('UI inspiration 1.jpg'),
  wip1: p('Presentation Slides WIP 1.png'),
  wip2: p('Presentation Slides WIP 2.png'),
  wip3: p('Presentation Slides WIP 3.png'),
  aiApp1: p('AI Apps Inspiration 1.jpg'),
  ghost3: p('Ghost Inspiration 3.jpeg'),
} as const;

// ── Career entries for the flash ──

export interface CareerEntry {
  logo: string | null;
  logoText?: string;
  company: string;
  role: string;
  stat: string;
  statLabel: string;
}

export const CAREER: CareerEntry[] = [
  {
    logo: LOGOS.moneyGroup,
    company: 'Money Group',
    role: 'Paid Search Manager',
    stat: '$15M+',
    statLabel: 'annual ad spend · Top 5 Google Advertiser',
  },
  {
    logo: LOGOS.capitalOne,
    company: 'Capital One · CreditWise',
    role: 'via Known Global Agency',
    stat: '$2M+',
    statLabel: 'monthly budget · 120+ campaigns',
  },
  {
    logo: LOGOS.compareCredit,
    company: 'CompareCredit',
    role: 'Performance Marketing',
    stat: '#1',
    statLabel: 'US credit card advertiser · 115% ROAS',
  },
  {
    logo: LOGOS.canon,
    company: 'Canon Latin America',
    role: 'Marketing Manager',
    stat: '14',
    statLabel: 'countries · first BI pipeline · 40% agency savings',
  },
  {
    logo: LOGOS.mskcc,
    company: 'Memorial Sloan Kettering',
    role: 'via Known Global Agency',
    stat: '$2M+',
    statLabel: 'monthly · healthcare performance media',
  },
  {
    logo: LOGOS.amazon,
    company: 'Amazon PPC',
    role: 'eCommerce Consultant',
    stat: '$2.5M',
    statLabel: 'in sales revenue · publicly traded clients',
  },
];

// ── Timeline ──

export interface BuilderEntry {
  type: 'text' | 'intro' | 'career' | 'github-flash' | 'image' | 'beforeAfter' | 'stats' | 'beat' | 'outro-particles' | 'outro-signature' | 'outro-tunnel';
  duration: number;
  lines?: Array<{
    text: string;
    size?: number;
    font?: 'display' | 'mono' | 'marker';
    color?: string;
    delay?: number;
  }>;
  src?: string;
  label?: string;
  date?: string;
  zoom?: 'in' | 'out';
  pan?: 'left' | 'right' | 'up' | 'down' | 'none';
  fit?: 'cover' | 'contain';
  before?: string;
  afterType?: 'chloe' | 'scanSequence';
  stats?: string[];
}

export const BUILDER_TIMELINE: BuilderEntry[] = [

  // ═══════════════════════════════════════════════
  // 1. INTRO — Avatar + name (3s)
  // ═══════════════════════════════════════════════

  { type: 'intro', duration: 90 },

  // ═══════════════════════════════════════════════
  // 2. HOOK — Big number (2.5s)
  // ═══════════════════════════════════════════════

  {
    type: 'text',
    duration: 75,
    lines: [
      { text: '$43M', size: 160, font: 'mono', color: BC.base },
      { text: 'in ad spend managed.', size: 48, font: 'display', color: BC.light, delay: 12 },
    ],
  },

  // ═══════════════════════════════════════════════
  // 3. CAREER FLASH — Logos + stats (14s)
  // ═══════════════════════════════════════════════

  { type: 'career', duration: 420 },

  // ═══════════════════════════════════════════════
  // 4. PIVOT (3s)
  // ═══════════════════════════════════════════════

  {
    type: 'text',
    duration: 90,
    lines: [
      { text: 'But I\'ve always been a builder.', size: 72, font: 'display', color: BC.light },
      { text: '12 years of side projects. Learning to code between campaigns.', size: 36, font: 'display', color: BC.mid, delay: 18 },
    ],
  },

  // ═══════════════════════════════════════════════
  // 5. GITHUB EVOLUTION — 2→11→76→305 (7s)
  // ═══════════════════════════════════════════════

  { type: 'github-flash', duration: 210 },

  // ═══════════════════════════════════════════════
  // 6. THE BUILD — Fast montage (12s)
  // ═══════════════════════════════════════════════

  {
    type: 'text',
    duration: 65,
    lines: [
      { text: 'February 2026', size: 80, font: 'mono', color: BC.base },
      { text: 'One idea. No team. Just AI.', size: 48, font: 'display', color: BC.light, delay: 12 },
    ],
  },

  { type: 'image', duration: 60, src: IMG.aiApp3, label: 'The vision', date: 'FEB 7', zoom: 'in', pan: 'down', fit: 'contain' },
  { type: 'image', duration: 55, src: IMG.ghost1, label: 'Creating the mascot', zoom: 'in', pan: 'none', fit: 'contain' },
  { type: 'image', duration: 55, src: IMG.wip2, label: 'First working build', date: 'MAR 4', zoom: 'in', pan: 'none', fit: 'contain' },
  { type: 'image', duration: 65, src: IMG.wip1, label: '42 modules. Live.', date: 'MAR 7', zoom: 'in', pan: 'none', fit: 'contain' },

  // ═══════════════════════════════════════════════
  // 7. BEFORE/AFTER — Animated (8s)
  // ═══════════════════════════════════════════════

  { type: 'beforeAfter', duration: 120, before: IMG.aiApp1, afterType: 'scanSequence' },
  { type: 'beforeAfter', duration: 120, before: IMG.ghost3, afterType: 'chloe' },

  // ═══════════════════════════════════════════════
  // 8. PRODUCT STATS (4s)
  // ═══════════════════════════════════════════════

  {
    type: 'stats',
    duration: 120,
    stats: [
      '42 intelligence modules',
      '5 forensic scan phases',
      'AI-powered synthesis',
      'Built solo in 6 weeks.',
    ],
  },

  // ═══════════════════════════════════════════════
  // 9. STATEMENT (3s) — still in dark universe
  // ═══════════════════════════════════════════════

  {
    type: 'text',
    duration: 75,
    lines: [
      { text: 'One marketer.', size: 72, font: 'display', color: BC.light },
      { text: 'Full-stack audit platform.', size: 72, font: 'display', color: BC.base, delay: 12 },
    ],
  },

  // ═══════════════════════════════════════════════
  // 10. CINEMATIC OUTRO — 3 scenes, 1 sentence:
  //     "IMAGINE / WHAT I CAN BUILD / FOR YOUR TEAM."
  // ═══════════════════════════════════════════════

  { type: 'outro-particles', duration: 180 },   // 6.0s — Palantir tactical terrain map + "IMAGINE"
  { type: 'outro-signature', duration: 210 },    // 7.0s — Navier-Stokes fluid ink + "WHAT I CAN BUILD"
  { type: 'outro-tunnel', duration: 224 },       // 7.47s — Keynote Stage + "FOR YOUR TEAM."
];

export const B_TOTAL = BUILDER_TIMELINE.reduce((acc, e) => acc + e.duration, 0);
