/**
 * GhostScan OS — Scan Sequence Timing Map
 * ═══════════════════════════════════════════
 *
 * WHAT: Maps SSE scan phases to animation phases and defines the
 *       choreography for the Hollywood Hack loading sequence.
 * WHY:  The 90-second scan wait is the single most important moment
 *       in the product. This timing map orchestrates the entire
 *       theatrical experience (Plan Section 5, Section 20).
 * HOW:  Each SSE phase (passive, browser, ghostscan, external, synthesis)
 *       maps to an animation phase (0-3). The timing map defines
 *       transitions, ASCII movie selection, and skip behavior.
 *
 * The sequence:
 *   Phase 0 (0-3s)   → Matrix intro text + Chloé reveal
 *   Phase 1 (3-15s)  → Terminal boot (synced to passive modules)
 *   Phase 2 (15-60s) → ASCII movie (Rick Roll / Chloé animation)
 *   Phase 3 (60-90s) → Final synthesis + desktop boot reveal
 */

/* ── SSE Scan Statuses (from engine) ───────────────────────── */

export type ScanStatus =
  | 'queued'
  | 'passive'
  | 'browser'
  | 'ghostscan'
  | 'external'
  | 'paid-media'
  | 'synthesis'
  | 'complete'
  | 'failed'
  | 'cancelled';

/* ── Animation Phases ──────────────────────────────────────── */

export type AnimationPhase = 0 | 1 | 2 | 3 | 'complete' | 'skipped';

export interface PhaseConfig {
  /** Phase number */
  phase: AnimationPhase;
  /** Human-readable name */
  label: string;
  /** Minimum duration (ms) — phase won't advance before this */
  minDurationMs: number;
  /** Maximum duration (ms) — force-advance if SSE is slow */
  maxDurationMs: number;
  /** What content to show */
  content: 'matrix-intro' | 'terminal-boot' | 'ascii-movie' | 'synthesis-reveal';
  /** Background color */
  background: 'black' | 'terminal' | 'desktop';
}

/** The 4-phase animation sequence */
export const PHASE_CONFIGS: Record<0 | 1 | 2 | 3, PhaseConfig> = {
  0: {
    phase: 0,
    label: 'Initiation',
    minDurationMs: 5000,
    maxDurationMs: 7000,
    content: 'matrix-intro',
    background: 'black',
  },
  1: {
    phase: 1,
    label: 'Terminal Boot',
    minDurationMs: 8000,
    maxDurationMs: 15000,
    content: 'terminal-boot',
    background: 'terminal',
  },
  2: {
    phase: 2,
    label: 'Scanning',
    minDurationMs: 20000,
    maxDurationMs: 60000,
    content: 'ascii-movie',
    background: 'terminal',
  },
  3: {
    phase: 3,
    label: 'Synthesis',
    minDurationMs: 5000,
    maxDurationMs: 30000,
    content: 'synthesis-reveal',
    background: 'terminal',
  },
};

/* ── SSE Status → Animation Phase Mapping ──────────────────── */

/**
 * Maps the real scan status from SSE to the animation phase
 * that should be active. The animation can be AHEAD of the scan
 * (showing terminal boot while scan is still in passive) but
 * should never show "complete" before the scan actually finishes.
 */
export function scanStatusToAnimationPhase(status: ScanStatus): AnimationPhase {
  switch (status) {
    case 'queued':
      return 0;
    case 'passive':
      return 1;
    case 'browser':
    case 'ghostscan':
      return 2;
    case 'external':
    case 'paid-media':
      return 2;
    case 'synthesis':
      return 3;
    case 'complete':
      return 'complete';
    case 'failed':
    case 'cancelled':
      return 'complete'; // Will show error state, not celebration
  }
}

/* ── ASCII Movie Selection ─────────────────────────────────── */

export type AsciiMovieId = 'rick_roll' | 'a24_intro' | 'chloe_animation' | 'moonlight';

export interface AsciiMovieConfig {
  id: AsciiMovieId;
  path: string;
  /** Approximate duration in seconds */
  durationSec: number;
  /** Whether this movie loops */
  loop: boolean;
}

export const ASCII_MOVIES: AsciiMovieConfig[] = [
  {
    id: 'rick_roll',
    path: '/ascii/rick_roll.json',
    durationSec: 180,
    loop: true,
  },
  {
    id: 'a24_intro',
    path: '/ascii/a24_intro.json',
    durationSec: 35,
    loop: false,
  },
  {
    id: 'chloe_animation',
    path: '/ascii/chloe_scan.json',
    durationSec: 27,
    loop: true,
  },
  {
    id: 'moonlight',
    path: '/ascii/moonlight.json',
    durationSec: 60,
    loop: true,
  },
];

/**
 * Select which ASCII movie to play.
 * First scan: Rick Roll (the MSCHF move).
 * Subsequent: random rotation.
 */
export function selectAsciiMovie(isFirstScan: boolean): AsciiMovieConfig {
  if (isFirstScan) {
    return ASCII_MOVIES.find((m) => m.id === 'rick_roll')!;
  }
  const index = Math.floor(Math.random() * ASCII_MOVIES.length);
  return ASCII_MOVIES[index]!;
}

/* ── Terminal Boot Lines ───────────────────────────────────── */

export type BootLineType = 'ok' | 'info' | 'ghost' | 'scan' | 'error';

export interface BootLine {
  type: BootLineType;
  text: string;
  /** Delay before showing this line (ms from phase start) */
  delayMs: number;
}

/**
 * Generate the fake terminal boot lines for Phase 1.
 * Some lines are static (always appear), some are triggered
 * by real SSE module completion events.
 */
export function generateBootLines(targetDomain: string): BootLine[] {
  return [
    { type: 'info', text: `GhostScan OS v2.0.26 — Forensic Marketing Intelligence`, delayMs: 0 },
    { type: 'info', text: `Copyright (c) 2026 AlphaScan. All rights reserved.`, delayMs: 200 },
    { type: 'info', text: ``, delayMs: 400 },
    { type: 'scan', text: `Target acquired: ${targetDomain}`, delayMs: 800 },
    { type: 'info', text: `Resolving DNS...`, delayMs: 1200 },
    { type: 'ok', text: `DNS resolution complete`, delayMs: 1800 },
    { type: 'ok', text: `Loading forensic module array (42 modules)`, delayMs: 2200 },
    { type: 'ghost', text: `Ghost detection array: ARMED`, delayMs: 2800 },
    { type: 'ok', text: `Security header scanners: ONLINE`, delayMs: 3200 },
    { type: 'ok', text: `Meta tag extraction pipeline: READY`, delayMs: 3600 },
    { type: 'ok', text: `CMS fingerprinting engine: LOADED`, delayMs: 4000 },
    { type: 'ok', text: `Analytics architecture scanner: ACTIVE`, delayMs: 4400 },
    { type: 'ok', text: `MarTech orchestration detector: ARMED`, delayMs: 4800 },
    { type: 'ghost', text: `Behavioral intelligence: GHOSTING`, delayMs: 5200 },
    { type: 'ok', text: `Compliance & legal scanner: READY`, delayMs: 5600 },
    { type: 'ok', text: `Performance profiler: CALIBRATED`, delayMs: 6000 },
    { type: 'scan', text: `Initiating passive reconnaissance...`, delayMs: 6500 },
    { type: 'ok', text: `HTTP headers captured`, delayMs: 7200 },
    { type: 'ok', text: `TLS/SSL certificate analyzed`, delayMs: 7800 },
    { type: 'ok', text: `robots.txt parsed`, delayMs: 8200 },
    { type: 'ok', text: `Sitemap discovered`, delayMs: 8600 },
    { type: 'scan', text: `Passive phase complete. Launching browser...`, delayMs: 9200 },
    { type: 'ghost', text: `Stealth profile loaded. Google referrer set.`, delayMs: 9800 },
    { type: 'ok', text: `Bot wall detection: MONITORING`, delayMs: 10200 },
    { type: 'scan', text: `Rendering ${targetDomain}...`, delayMs: 10800 },
  ];
}

/**
 * Generate a dynamic boot line when a real module completes via SSE.
 */
export function moduleCompleteBootLine(moduleId: string, moduleName: string): BootLine {
  return {
    type: 'ok',
    text: `${moduleId} ${moduleName}: EXTRACTED`,
    delayMs: 0, // Immediate — triggered by SSE event
  };
}

/**
 * Generate the final synthesis lines for Phase 3.
 */
export function generateSynthesisLines(
  moduleCount: number,
  score: number,
  scoreLabel: string,
): BootLine[] {
  return [
    { type: 'scan', text: `Cross-referencing market intelligence...`, delayMs: 0 },
    { type: 'ok', text: `DataForSEO API: ${moduleCount - 20} external modules extracted`, delayMs: 1500 },
    { type: 'scan', text: `Compiling forensic findings...`, delayMs: 3000 },
    { type: 'ghost', text: `Chloé is analyzing the data...`, delayMs: 4500 },
    { type: 'scan', text: `Calculating MarketingIQ™...`, delayMs: 6000 },
    { type: 'info', text: ``, delayMs: 7000 },
    { type: 'ok', text: `Scan complete. ${moduleCount} modules executed.`, delayMs: 7500 },
    { type: 'ok', text: `MarketingIQ™: ${score} — "${scoreLabel}"`, delayMs: 8500 },
    { type: 'info', text: ``, delayMs: 9500 },
    { type: 'scan', text: `> booting desktop...`, delayMs: 10000 },
  ];
}

/* ── Cached Scan (Skip Full Sequence) ──────────────────────── */

/**
 * For cached scans (domain scanned within 24h), we skip the full
 * Hollywood Hack and show a brief 3-second boot.
 */
export function generateCachedBootLines(targetDomain: string, score: number): BootLine[] {
  return [
    { type: 'info', text: `GhostScan OS v2.0.26`, delayMs: 0 },
    { type: 'ok', text: `Cache hit: ${targetDomain}`, delayMs: 500 },
    { type: 'ok', text: `Fresh data available (scanned < 24h ago)`, delayMs: 1000 },
    { type: 'ok', text: `MarketingIQ™: ${score}`, delayMs: 1500 },
    { type: 'scan', text: `> booting desktop...`, delayMs: 2000 },
  ];
}
