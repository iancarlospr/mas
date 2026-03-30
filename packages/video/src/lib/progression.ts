/**
 * Progression Reel v2 — YOUR story
 *
 * Format: 1920×1080 landscape
 * Duration: ~2:22
 * Structure: 2015 → silence → 2018 spark → NYC → 5yr silence → 2024 AI false start → 2026 SHIPS
 */

export const P_WIDTH = 1920;
export const P_HEIGHT = 1080;
export const P_FPS = 30;

export const C = {
  void: '#0a0a0a',
  deep: '#2A1F27',
  mid: '#4A3844',
  base: '#FFB2EF',
  bright: '#FFC8F4',
  light: '#FFF0FA',
  white: '#FFFFFF',
  terminal: '#00FF88',
} as const;

const p = (name: string) => `progression/${name}`;

export const IMG = {
  // GitHub contribution screenshots
  github2015: p('github-2015-2_contributions.jpg'),
  github2018: p('github-2018-11_contributions.jpg'),
  github2024: p('github-2024-76_contributions.jpg'),
  github2026: p('github-2026-305_contributions.jpg'),
  // Inspiration (Feb 7-11)
  aiApp3: p('AI Apps Inspiration 3.jpg'),
  slideInspo2: p('Presentation Slides Inspiration 2.jpeg'),
  slideInspo3: p('Presentation Slides Inspiration 3.jpg'),
  // Identity (Feb 22)
  branding: p('Gemini AI Chat Aligment on Branding.jpg'),
  ghost1: p('Ghost Inspiration 1.png'),
  ghost3: p('Ghost Inspiration 3.jpeg'),
  uiInspo1: p('UI inspiration 1.jpg'),
  uiInspo3: p('UI inspiration 3.jpg'),
  // Building (Mar)
  wip1: p('Presentation Slides WIP 1.png'),
  wip2: p('Presentation Slides WIP 2.png'),
  wip3: p('Presentation Slides WIP 3.png'),
  // Before/after pairs
  aiApp1: p('AI Apps Inspiration 1.jpg'),
} as const;

// ── Timeline ──

export interface TimelineEntry {
  type: 'text' | 'image' | 'github' | 'years' | 'beat' | 'beforeAfter' | 'stats' | 'watershed' | 'shia';
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
  before?: string;
  after?: string | null;
  afterType?: 'chloe' | 'brand';
  stats?: string[];
  yearStart?: number;
  yearEnd?: number;
  // GitHub slide
  githubYear?: string;
  contributions?: string;
  // Image fit
  fit?: 'cover' | 'contain';
}

export const TIMELINE: TimelineEntry[] = [

  // ═══════════════════════════════════════════════
  // ACT 1: THE BEGINNING (2015)
  // ═══════════════════════════════════════════════

  {
    type: 'text',
    duration: 105,
    lines: [{ text: '2015', size: 96, font: 'mono', color: C.mid }],
  },
  {
    type: 'text',
    duration: 120,
    lines: [
      { text: 'Joined GitHub. FreeCodeCamp.', size: 64, font: 'display' },
      { text: 'HTML. CSS. The basics.', size: 56, font: 'display', color: C.mid, delay: 18 },
    ],
  },
  {
    type: 'github',
    duration: 100,
    src: IMG.github2015,
    githubYear: 'GitHub — 2015',
    contributions: '2',
  },
  {
    type: 'text',
    duration: 120,
    lines: [
      { text: 'Christmas 2015', size: 64, font: 'display' },
      { text: 'My first portfolio. My first real project.', size: 56, font: 'display', color: C.base, delay: 15 },
    ],
  },

  // ═══════════════════════════════════════════════
  // ACT 2: THE FIRST SILENCE (2016-2017)
  // ═══════════════════════════════════════════════

  {
    type: 'text',
    duration: 120,
    lines: [
      { text: '2016', size: 88, font: 'mono', color: C.mid },
      { text: '2017', size: 88, font: 'mono', color: C.mid, delay: 25 },
      { text: 'Nothing', size: 64, font: 'display', color: C.mid, delay: 55 },
    ],
  },

  // ═══════════════════════════════════════════════
  // ACT 3: THE SPARK (2018)
  // ═══════════════════════════════════════════════

  {
    type: 'text',
    duration: 90,
    lines: [{ text: '2018', size: 96, font: 'mono', color: C.light }],
  },
  {
    type: 'text',
    duration: 135,
    lines: [
      { text: 'Instagram bots.', size: 64, font: 'display' },
      { text: 'A side project with friends.', size: 56, font: 'display', color: C.mid, delay: 15 },
    ],
  },
  {
    type: 'text',
    duration: 120,
    lines: [
      { text: 'Ruby on Rails. Michael Hartl.', size: 60, font: 'display' },
      { text: 'Weeks of late nights. Completed it.', size: 56, font: 'display', color: C.base, delay: 18 },
    ],
  },
  {
    type: 'github',
    duration: 100,
    src: IMG.github2018,
    githubYear: 'GitHub — 2018',
    contributions: '11',
  },
  {
    type: 'text',
    duration: 120,
    lines: [
      { text: 'Then I moved to New York.', size: 64, font: 'display' },
      { text: 'Big corporation.', size: 56, font: 'display', color: C.mid, delay: 20 },
    ],
  },
  {
    type: 'text',
    duration: 105,
    lines: [
      { text: 'No time. No code.', size: 72, font: 'display', color: C.mid },
    ],
  },

  // ═══════════════════════════════════════════════
  // ACT 4: THE LONG SILENCE (2019-2023)
  // ═══════════════════════════════════════════════

  {
    type: 'years',
    duration: 75,
    yearStart: 2019,
    yearEnd: 2023,
  },
  {
    type: 'text',
    duration: 135,
    lines: [
      { text: 'Five years', size: 96, font: 'display' },
      { text: 'The dream on pause', size: 68, font: 'display', color: C.mid, delay: 20 },
    ],
  },

  // ═══════════════════════════════════════════════
  // ACT 5: THE FALSE START (2024)
  // ═══════════════════════════════════════════════

  {
    type: 'text',
    duration: 135,
    lines: [
      { text: '2024', size: 80, font: 'mono', color: C.light },
      { text: 'Got back in — this time with AI.', size: 60, font: 'display', delay: 18 },
    ],
  },
  {
    type: 'github',
    duration: 100,
    src: IMG.github2024,
    githubYear: 'GitHub — 2024',
    contributions: '76',
  },
  {
    type: 'text',
    duration: 120,
    lines: [
      { text: 'The AI wasn\'t ready yet.', size: 64, font: 'display', color: C.mid },
      { text: 'Quit. Again.', size: 72, font: 'display', color: C.base, delay: 22 },
    ],
  },

  // ═══════════════════════════════════════════════
  // ACT 5.5: ANOTHER GAP (2025)
  // ═══════════════════════════════════════════════

  {
    type: 'text',
    duration: 105,
    lines: [
      { text: '2025', size: 110, font: 'mono', color: C.mid },
      { text: 'Nothing', size: 64, font: 'display', color: C.mid, delay: 25 },
    ],
  },

  // ═══════════════════════════════════════════════
  // BEAT — THE DARKNESS BEFORE THE DAWN
  // ═══════════════════════════════════════════════

  { type: 'beat', duration: 50 },

  // ═══════════════════════════════════════════════
  // ACT 6: THE ITCH (January 2026)
  // ═══════════════════════════════════════════════

  {
    type: 'text',
    duration: 90,
    lines: [{ text: 'January 2026', size: 96, font: 'mono', color: C.base }],
  },
  {
    type: 'text',
    duration: 140,
    lines: [
      { text: 'Watching people build', size: 60, font: 'display' },
      { text: 'incredible things with AI.', size: 60, font: 'display', color: C.light, delay: 12 },
    ],
  },
  {
    type: 'text',
    duration: 105,
    lines: [{ text: 'The itch came back.', size: 72, font: 'display', color: C.light }],
  },

  // Shia LaBeouf "JUST DO IT" — the push over the edge (0:38.5–0:58 of the original)
  { type: 'shia', duration: 585 }, // 19.5s

  {
    type: 'text',
    duration: 120,
    lines: [{ text: 'One more time.', size: 96, font: 'marker', color: C.base }],
  },

  // GitHub 2026 — THE EXPLOSION
  {
    type: 'github',
    duration: 110,
    src: IMG.github2026,
    githubYear: 'GitHub — 2026',
    contributions: '305',
  },

  // ═══════════════════════════════════════════════
  // ACT 7: THE BUILD (Feb-Mar 2026)
  // ═══════════════════════════════════════════════

  // Inspiration — what I was reaching for
  { type: 'image', duration: 90, src: IMG.aiApp3, label: 'The dream', date: 'FEB 7', zoom: 'in', pan: 'down', fit: 'contain' },
  { type: 'image', duration: 90, src: IMG.slideInspo2, zoom: 'in', pan: 'none' },
  { type: 'image', duration: 90, src: IMG.slideInspo3, zoom: 'out', pan: 'none', fit: 'contain' },

  // Building the identity
  { type: 'image', duration: 100, src: IMG.branding, label: 'Aligning every decision with AI', date: 'FEB 22', zoom: 'in', pan: 'none', fit: 'contain' },
  { type: 'image', duration: 90, src: IMG.ghost1, label: 'Creating the mascot', zoom: 'in', pan: 'none', fit: 'contain' },
  { type: 'image', duration: 90, src: IMG.uiInspo1, label: 'Finding the aesthetic', zoom: 'in', pan: 'none', fit: 'contain' },
  { type: 'image', duration: 90, src: IMG.uiInspo3, label: 'The concept solidifies', date: 'MAR 1', zoom: 'out', pan: 'none' },

  // Working builds
  { type: 'image', duration: 100, src: IMG.wip2, label: 'First working build', date: 'MAR 4', zoom: 'in', pan: 'none', fit: 'contain' },
  { type: 'image', duration: 90, src: IMG.wip3, label: '42 intelligence modules', date: 'MAR 5', zoom: 'in', pan: 'none', fit: 'contain' },

  // ═══════════════════════════════════════════════
  // ACT 8: THE REVEAL
  // ═══════════════════════════════════════════════

  // Keep refining
  { type: 'image', duration: 150, src: IMG.wip1, label: 'Keep refining. Keep improving.', date: 'MAR 7', zoom: 'in', pan: 'none', fit: 'contain' },

  // Before/after — animated reality, not static screenshots
  { type: 'beforeAfter', duration: 150, before: IMG.aiApp1, after: null, afterType: 'scanSequence' },
  { type: 'beforeAfter', duration: 150, before: IMG.ghost3, after: null, afterType: 'chloe' },

  // Stats
  {
    type: 'stats',
    duration: 135,
    stats: [
      '42 intelligence modules',
      '5 forensic scan phases',
      'AI-powered synthesis',
      'Production. Live. Shipped.',
    ],
  },

  // ═══════════════════════════════════════════════
  // THE WATERSHED MOMENT — 12 years in seconds
  // ═══════════════════════════════════════════════

  { type: 'watershed', duration: 225 }, // 7.5s — years accelerate → 2026 SLAMS → "refusing to let the dream die"

  // ═══════════════════════════════════════════════
  // ACT 9: THE STATEMENT
  // ═══════════════════════════════════════════════

  {
    type: 'text',
    duration: 120,
    lines: [{ text: 'Built by a marketer.', size: 76, font: 'display' }],
  },
  {
    type: 'text',
    duration: 120,
    lines: [{ text: 'Who refused to quit.', size: 88, font: 'marker', color: C.base }],
  },
  {
    type: 'text',
    duration: 135,
    lines: [
      { text: 'marketingalphascan.com', size: 52, font: 'mono', color: C.light },
      { text: '42 modules. AI-powered. Your full MarTech audit.', size: 26, font: 'mono', color: C.mid, delay: 20 },
    ],
  },

  // Fade out
  { type: 'beat', duration: 75 },
];

export const P_TOTAL = TIMELINE.reduce((acc, e) => acc + e.duration, 0);
