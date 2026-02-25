/**
 * GhostScan OS — Chart Configuration
 * ═══════════════════════════════════════
 *
 * WHAT: Shared constants for all Recharts and custom SVG chart components.
 * WHY:  Centralizes visual config so all 26 chart components render
 *       consistently within the GhostScan OS aesthetic (Plan Section 16).
 * HOW:  Colors migrated from old hex palette to OKLCH CSS variables.
 *       Fonts updated to JetBrains Mono (data) and Pixelify Sans (system).
 *       All tooltip/legend/axis styling matches the retro OS design.
 *
 * MIGRATION from old palette:
 *   #1A1A2E → var(--gs-black)        Primary data series
 *   #E94560 → var(--gs-fuchsia)      Accent / Chloé
 *   #06D6A0 → var(--gs-terminal)     Healthy / positive
 *   #FFD166 → var(--gs-warning)      Warning / caution
 *   #94A3B8 → var(--gs-mid-light)    Neutral / secondary
 *   #7C3AED → var(--gs-cyan)         Ghost accent
 *   #EF476F → var(--gs-critical)     Critical / error
 */

/* ── Dimensions & Aspect Ratios (unchanged) ────────────────── */

export const CHART_ASPECTS = {
  wide: 3,        // 3:1 — sparklines, trend lines
  landscape: 2,   // 2:1 — bar charts, area charts
  standard: 1.6,  // 16:10 — general purpose
  square: 1,      // 1:1 — scatter plots, quadrants
  portrait: 0.75, // 3:4 — vertical bar charts on mobile
} as const;

export const CHART_HEIGHTS = {
  bentoSmall: 200,
  bentoWide: 240,
  bentoTall: 400,
  bentoFeature: 360,
  reportFull: 400,
  reportHalf: 300,
  printA4Full: 500,
  printA4Half: 340,
} as const;

/* ── Tooltip Styling (OKLCH migrated) ──────────────────────── */

export const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--gs-black)',
  border: '2px solid var(--gs-mid)',
  borderRadius: '0px', /* Retro — no rounded corners */
  padding: '8px 12px',
  boxShadow: '2px 2px 0 var(--gs-mid-dark)',
};

export const TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: 'var(--gs-near-white)',
  fontFamily: 'var(--font-data)',
  fontWeight: 700,
  fontSize: '13px',
  marginBottom: '4px',
};

export const TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: 'var(--gs-mid-light)',
  fontFamily: 'var(--font-data)',
  fontSize: '12px',
  padding: '2px 0',
};

/* ── Legend Configuration (OKLCH migrated) ──────────────────── */

export const LEGEND_CONFIG = {
  verticalAlign: 'bottom' as const,
  align: 'center' as const,
  iconType: 'circle' as const,
  iconSize: 8,
  wrapperStyle: {
    fontFamily: 'var(--font-data)',
    fontSize: '12px',
    color: 'var(--gs-mid-dark)',
    paddingTop: '16px',
  },
};

export const LEGEND_RIGHT_CONFIG = {
  ...LEGEND_CONFIG,
  verticalAlign: 'middle' as const,
  align: 'right' as const,
  layout: 'vertical' as const,
  wrapperStyle: {
    ...LEGEND_CONFIG.wrapperStyle,
    paddingLeft: '24px',
    paddingTop: '0',
  },
};

/* ── Axis Styling (OKLCH migrated) ─────────────────────────── */

export const AXIS_STYLE = {
  tick: {
    fontFamily: 'var(--font-data)',
    fontSize: 12,
    fill: 'var(--gs-mid)',
  },
  axisLine: {
    stroke: 'var(--gs-mid-light)',
    strokeWidth: 1,
  },
  tickLine: false as const,
};

export const GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: 'var(--gs-mid-light)',
  vertical: false,
};

/* ── Number Formatters (unchanged) ─────────────────────────── */

export const formatters = {
  thousands: (value: number) =>
    value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value),
  millions: (value: number) =>
    value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(1)}M`
      : formatters.thousands(value),
  currency: (value: number) => `$${formatters.thousands(value)}`,
  percent: (value: number) => `${value}%`,
  ms: (value: number) => `${value}ms`,
  bytes: (value: number) => {
    if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)}MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)}KB`;
    return `${value}B`;
  },
};

/* ── Animation Config (unchanged) ──────────────────────────── */

export const ANIMATION_CONFIG = {
  isAnimationActive: true,
  animationBegin: 0,
  animationDuration: 800,
  animationEasing: 'ease-out' as const,
  getStaggerDelay: (index: number) => index * 100,
  pieAnimation: {
    animationBegin: 200,
    animationDuration: 1000,
    animationEasing: 'ease-out' as const,
  },
  lineAnimation: {
    animationBegin: 0,
    animationDuration: 1200,
    animationEasing: 'ease-in-out' as const,
  },
  printOverride: {
    isAnimationActive: false,
  },
};

/* ═══════════════════════════════════════════════════════════════
   Color Palettes — OKLCH Migrated (Plan Section 16)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Primary chart palette — 10 colors.
 * Uses CSS variables for OKLCH support.
 * NOTE: Recharts requires actual color values in some contexts,
 * not CSS variables. These are the computed OKLCH fallbacks.
 */
export const CHART_PALETTE = [
  'var(--gs-black)',       // Primary data series (warm near-black)
  'var(--gs-fuchsia)',     // Accent / Chloé (laser fuchsia)
  'var(--gs-terminal)',    // Positive / healthy (CRT green)
  'var(--gs-warning)',     // Caution / warning (amber)
  'var(--gs-mid-light)',   // Neutral / baseline (warm gray)
  'var(--gs-cyan)',        // Ghost accent (phosphorescent cyan)
  'oklch(0.70 0.15 230)', // Tertiary (cool blue)
  'oklch(0.72 0.18 50)',  // Quaternary (warm orange)
  'oklch(0.65 0.20 330)', // Quinary (rose)
  'oklch(0.75 0.15 170)', // Senary (seafoam)
] as const;

/** Traffic light — the universal health indicator */
export const TRAFFIC_LIGHT_COLORS = {
  green: 'var(--gs-terminal)',
  amber: 'var(--gs-warning)',
  red: 'var(--gs-critical)',
} as const;

/** Status indicators for tools/services */
export const STATUS_COLORS = {
  active: 'var(--gs-terminal)',
  inactive: 'var(--gs-mid-light)',
  degraded: 'var(--gs-warning)',
  error: 'var(--gs-critical)',
  blocked: 'var(--gs-black)',
} as const;

/** Resource type colors (JS/CSS/images) */
export const RESOURCE_COLORS = {
  js: 'var(--gs-warning)',
  css: 'var(--gs-terminal)',
  images: 'var(--gs-fuchsia)',
  fonts: 'var(--gs-mid-light)',
  xhr: 'var(--gs-black)',
  other: 'var(--gs-cyan)',
} as const;

/** Category badge accent colors */
export const CATEGORY_BADGE_COLORS: Record<string, string> = {
  analytics: 'var(--gs-black)',
  ads: 'var(--gs-fuchsia)',
  automation: 'var(--gs-terminal)',
  cms: 'var(--gs-warning)',
  cdn: 'var(--gs-cyan)',
  security: 'oklch(0.70 0.15 230)',
  ecommerce: 'oklch(0.72 0.18 50)',
  social: 'oklch(0.65 0.20 330)',
  other: 'var(--gs-mid-light)',
};

/** Score tier colors — traffic light mapped to score ranges */
export const SCORE_TIER_COLORS = {
  critical: 'var(--gs-critical)',   // 0-39
  warning: 'var(--gs-warning)',     // 40-59
  good: 'var(--gs-terminal)',       // 60-79
  excellent: 'var(--gs-cyan)',      // 80-100 (Chloé glows for excellence)
} as const;

export function getScoreTierColor(score: number): string {
  if (score >= 80) return SCORE_TIER_COLORS.excellent;
  if (score >= 60) return SCORE_TIER_COLORS.good;
  if (score >= 40) return SCORE_TIER_COLORS.warning;
  return SCORE_TIER_COLORS.critical;
}

/** Traffic source colors */
export const TRAFFIC_SOURCE_COLORS: Record<string, string> = {
  Direct: 'var(--gs-black)',
  'Organic Search': 'var(--gs-terminal)',
  'Paid Search': 'var(--gs-fuchsia)',
  Social: 'var(--gs-warning)',
  Referral: 'var(--gs-mid-light)',
  Email: 'var(--gs-cyan)',
  Display: 'oklch(0.70 0.15 230)',
};

/* ── Margins (unchanged) ───────────────────────────────────── */

export const CHART_MARGINS = {
  bento: { top: 8, right: 8, bottom: 8, left: 8 },
  standard: { top: 20, right: 30, bottom: 20, left: 40 },
  wideLabel: { top: 20, right: 30, bottom: 20, left: 120 },
  withLegend: { top: 20, right: 30, bottom: 60, left: 40 },
  print: { top: 24, right: 40, bottom: 24, left: 48 },
} as const;

/* ── PDF Dimensions (unchanged) ────────────────────────────── */

export const PDF_DIMENSIONS = {
  pageWidth: 794,
  pageHeight: 1123,
  marginTop: 72,
  marginBottom: 96,
  marginLeft: 96,
  marginRight: 96,
  usableWidth: 602,
  usableHeight: 955,
  chartFullWidth: 602,
  chartHalfWidth: 289,
  chartFullHeight: 400,
  chartHalfHeight: 280,
  chartThirdHeight: 180,
  metricCardWidth: 185,
  metricCardHeight: 100,
} as const;

/** Print-safe monochrome palette (B&W-friendly) */
export const PRINT_PALETTE = [
  'var(--gs-black)',
  'var(--gs-mid-dark)',
  'var(--gs-mid)',
  'var(--gs-mid-light)',
  'var(--gs-light)',
] as const;

/* ═══════════════════════════════════════════════════════════════
   Resolved OKLCH Values for SVG Inline Styles
   ═══════════════════════════════════════════════════════════════
   Recharts/SVG elements use inline `fill` and `stroke` attributes.
   CSS var() doesn't resolve inside SVG fill="..." attributes in all
   contexts (esp. tooltips, custom labels, gradients). These are the
   resolved OKLCH equivalents for direct use in inline styles.
*/

export const OKLCH = {
  black:     'oklch(0.15 0.01 80)',
  dark:      'oklch(0.25 0.01 80)',
  midDark:   'oklch(0.35 0.01 80)',
  mid:       'oklch(0.50 0.01 80)',
  midLight:  'oklch(0.65 0.01 80)',
  light:     'oklch(0.80 0.01 80)',
  nearWhite: 'oklch(0.93 0.01 80)',
  white:     'oklch(0.97 0.005 80)',
  cyan:      'oklch(0.82 0.18 192)',
  fuchsia:   'oklch(0.65 0.28 350)',
  terminal:  'oklch(0.80 0.25 145)',
  critical:  'oklch(0.55 0.22 25)',
  warning:   'oklch(0.78 0.15 75)',
} as const;

/** Cookie category colors — extracted from cookie-audit-bar.tsx */
export const COOKIE_CATEGORY_COLORS: Record<string, string> = {
  essential:   OKLCH.terminal,
  functional:  OKLCH.cyan,
  analytics:   OKLCH.warning,
  advertising: OKLCH.critical,
  unknown:     OKLCH.midLight,
};

/** CWV rating colors — extracted from cwv-metrics.tsx */
export const CWV_RATING_COLORS: Record<string, string> = {
  good:                  OKLCH.terminal,
  'needs-improvement':   OKLCH.warning,
  poor:                  OKLCH.critical,
};

/** Tool utilization heat levels — extracted from tool-utilization-heatmap.tsx */
export const UTILIZATION_COLORS: Record<string, string> = {
  high:   OKLCH.terminal,
  medium: OKLCH.warning,
  low:    OKLCH.critical,
  none:   OKLCH.light,
};

/** Flow diagram node colors — extracted from flow-diagram.tsx */
export const FLOW_NODE_COLORS: Record<string, string> = {
  source:   OKLCH.cyan,
  healthy:  OKLCH.terminal,
  warning:  OKLCH.warning,
  critical: OKLCH.critical,
  neutral:  OKLCH.midLight,
};

/** Scatter quadrant colors — extracted from remediation-scatter.tsx */
export const QUADRANT_COLORS: Record<string, string> = {
  quickWins:   OKLCH.terminal,
  strategic:   OKLCH.cyan,
  lowPriority: OKLCH.midLight,
  avoid:       OKLCH.critical,
};
