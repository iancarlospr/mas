/**
 * GhostScan OS — Chloé's Personality Copy Library
 * ═══════════════════════════════════════════════════
 *
 * WHAT: All of Chloé's spoken text, organized by context.
 * WHY:  Centralizes the "High-Fashion Cuntiness" voice so it's consistent
 *       across the entire app. Every error, greeting, reaction, and
 *       idle quip comes from here (Plan Sections 4, 17, Target Audience).
 * HOW:  Arrays of strings per context. Components pick randomly from the
 *       array to keep Chloé feeling alive, not scripted.
 *
 * TONE RULES:
 *   - Direct, precise, slightly menacing in a fashionable way
 *   - Never says "Oops!" or "Sorry!" — she's never wrong, never apologetic
 *   - Uses brand vocabulary: Unclockable, Forensic, Receipts, Ground Truth
 *   - BANNED: Hack growth, Crush it, 10x, Synergy, Empower, Seamless, Magic
 */

/** Utility: pick a random item from an array */
export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/* ── Greetings (Login, First Visit, Return Visit) ──────────── */

export const GREETINGS = {
  /** First time user lands on the site */
  firstVisit: [
    "Your MarTech stack is a landfill. Let's run the forensics.",
    'Drop a URL. I handle the rest.',
    "I see everything your analytics can't. Try me.",
    'Ready to find out what your marketing stack is hiding?',
  ],

  /** Returning user */
  returning: [
    "You're back. Smart move.",
    'Miss me? Your competitors sure did.',
    "New day, same broken pixels. Let's check.",
    "Back for more ground truth? I'm flattered.",
  ],

  /** Login page */
  login: [
    'Identify yourself.',
    'Credentials, please.',
    'Back so soon?',
  ],

  /** Register page */
  register: [
    'New operative? Welcome.',
    "Fresh face. Let's see what you're working with.",
    'Welcome to GhostScan. You look like you need this.',
  ],

  /** Email verification */
  verify: [
    'Check your email. I sent something.',
    "Verification incoming. Don't leave me waiting.",
    'I just pinged your inbox. Go.',
  ],
} as const;

/* ── Scan Events ───────────────────────────────────────────── */

export const SCAN_EVENTS = {
  /** Scan starting */
  start: [
    "Initiating protocol. Don't touch anything.",
    'Scanning. This takes 90 seconds. Watch the show.',
    "Running 42 forensic modules. Sit tight, babe.",
    "Let's see what they're hiding.",
  ],

  /** Module completed successfully */
  moduleComplete: [
    'Got it.',
    'Another one.',
    'Extracted.',
    'Clean pull.',
    'Logged.',
  ],

  /** Critical finding discovered */
  criticalFound: [
    'Found something ugly.',
    "Oh. That's not good.",
    "This one's going to hurt.",
    "Receipts acquired. You'll want to see this.",
    "Your {module} has a problem. A big one.",
  ],

  /** Scan complete */
  complete: [
    'Scan complete. {moduleCount} modules. {findingCount} findings. Your move.',
    "Done. MarketingIQ: {score}. Let's talk about what that means.",
    'All modules executed. The ground truth is below.',
    "Sweep complete. I found {criticalCount} things you can't ignore.",
  ],

  /** Scan cached (domain scanned within 24h) */
  cached: [
    "I scanned this domain recently. Here's what I found.",
    "Fresh data from earlier today. No need to re-scan.",
    "Already in the files. Pulling up your results.",
  ],

  /** Scan failed */
  failed: [
    "The scan hit a wall. {domain} is either down or blocking me.",
    "Couldn't reach {domain}. The site might be playing dead.",
    "{domain} isn't cooperating. Retry or try a different URL.",
  ],
} as const;

/* ── Dashboard / Module Events ─────────────────────────────── */

export const DASHBOARD_EVENTS = {
  /** Hovering over a redacted/locked module */
  redactedHover: [
    "That's classified. $9.99 to declassify.",
    'The good stuff is behind the curtain.',
    "You can see the shape of it. Want the details?",
    "I know what's under there. Do you?",
  ],

  /** Module with perfect score */
  perfectScore: [
    'Flawless. Nothing to fix here.',
    "Clean. Whoever set this up knew what they were doing.",
    "Can't find a single issue. Respect.",
  ],

  /** Module with critical score */
  criticalScore: [
    'This needs attention. Now.',
    "Red flag territory. I'd prioritize this.",
    "Your {module} is hemorrhaging. We need to stop the bleeding.",
  ],

  /** GhostScan module (M09-M12) */
  ghostModule: [
    "This is what your analytics can't see.",
    'Hidden signals. Only I can find these.',
    "The invisible layer. You're welcome.",
  ],
} as const;

/* ── Chat Events ───────────────────────────────────────────── */

export const CHAT_EVENTS = {
  /** No credits — activation prompt */
  noCreditGate: [
    "I don't work for free, babe. $1 gets you 15 questions.",
    'Want me to talk? Activate chat first.',
    "My insights aren't free. $1 to start.",
  ],

  /** Credits running low */
  lowCredits: [
    "Running low on questions. {remaining} left.",
    "{remaining} credits remaining. Make them count.",
  ],

  /** Chat greeting (first message) */
  chatGreeting: [
    "What do you want to know about {domain}?",
    "Ask me anything about the scan. I have receipts.",
    "I've analyzed everything. What's on your mind?",
  ],
} as const;

/* ── Payment / Unlock Events ───────────────────────────────── */

export const PAYMENT_EVENTS = {
  /** Pre-purchase nudge */
  declassifyPrompt: [
    "This is the good stuff. Trust me.",
    "Full evidence, recommendations, and the Alpha Brief. $9.99.",
    "42 modules of forensic intelligence. Declassify it.",
  ],

  /** Post-purchase celebration */
  declassified: [
    "DECLASSIFIED. Now you're dangerous.",
    "Full access granted. Go make someone uncomfortable.",
    "Everything's unlocked. The ground truth is yours.",
  ],

  /** Purchase cancelled */
  cancelled: [
    "Your call. The data isn't going anywhere.",
    "No pressure. I'll be here when you're ready.",
    "Cancelled. The intelligence remains classified.",
  ],

  /** Chat activated */
  chatActivated: [
    "Alright, what do you want to know?",
    "15 questions. Make them sharp.",
    "Chat activated. I'm all ears.",
  ],
} as const;

/* ── Idle / Personality Quips ──────────────────────────────── */

export const IDLE_QUIPS = [
  "Your competitors aren't taking breaks.",
  "I've been staring at your tracking pixels. Some of them stared back.",
  "Did you know 73% of marketing stacks have at least 3 abandoned tools?",
  "Fun fact: I can see your Meta pixel from here. It's crying.",
  "Still here? Run another scan. I dare you.",
  "I found a cookie that expired in 2019. It's still loading.",
  "Your CDN is doing its best. Bless its heart.",
  "I wonder what your competitors' MarketingIQ looks like...",
  "The average marketing stack has 91 tools. Yours has...",
  "I don't sleep. I audit.",
] as const;

/* ── Error States (Plan Section 17) ────────────────────────── */

export const ERROR_STATES = {
  /** Rate limited */
  rateLimited: [
    "4 scans a day. You're out. Come back tomorrow, babe.",
    "Daily limit hit. I need to rest too. (I don't. But still.)",
    "Slow down. 4 per day. Rules are rules.",
  ],

  /** Empty state */
  empty: [
    "Nothing here yet. Run a scan to wake me up.",
    "Empty. Drop a URL and give me something to work with.",
    "I'm bored. Scan something.",
  ],

  /** Partial results */
  partial: [
    "Most of the scan went fine but {count} modules ghosted us. Showing what I found.",
    "{count} modules couldn't extract data. The site might be blocking specific requests.",
    "Partial results. {count} modules hit a wall, but the rest came through clean.",
  ],

  /** Module unavailable */
  moduleUnavailable: [
    "This module couldn't extract data from {domain}. The site might be blocking us.",
    "No data here. {domain} isn't cooperating with this particular check.",
    "Module returned empty. Some sites are better at hiding than others.",
  ],

  /** 404 page */
  notFound: [
    "This page ghosted you harder than your last agency.",
    "404. Even I can't find what's not here.",
    "Nothing at this URL. Kind of like your competitor's conversion tracking.",
  ],

  /** Auth error */
  authError: [
    "Authentication failed. Try again, babe.",
    "Wrong credentials. I don't judge. Try again.",
    "Access denied. Are you sure you're you?",
  ],
} as const;

/* ── Mischief Lines (Idle screenmate behavior) ─────────────── */

export const MISCHIEF_LINES = [
  '*examines desktop icon curiously*',
  '*sits on window edge, legs dangling*',
  '*yawns dramatically*',
  '*pokes at a module window*',
  '*stares at the scan button meaningfully*',
  '*floats upside down briefly*',
  '*taps on the screen from inside*',
] as const;
