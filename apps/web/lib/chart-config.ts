/**
 * GhostScan OS — Chart Configuration
 * ═══════════════════════════════════════
 *
 * Palette: "Classified File on Gallery Paper"
 * Charts use ink (primary), red (accent), plus functional traffic lights.
 * No cyan/fuchsia — those are dead.
 */

/* ── Dimensions & Aspect Ratios ──────────────────────────────── */

export const CHART_ASPECTS = {
  wide: 3,
  landscape: 2,
  standard: 1.6,
  square: 1,
  portrait: 0.75,
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

/* ── Tooltip Styling ─────────────────────────────────────────── */

export const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--gs-ink)',
  border: '2px solid var(--gs-chrome-dark)',
  borderRadius: '0px',
  padding: '8px 12px',
  boxShadow: '2px 2px 0 var(--gs-chrome-dark)',
};

export const TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: 'var(--gs-paper)',
  fontFamily: 'var(--font-data)',
  fontWeight: 700,
  fontSize: '13px',
  marginBottom: '4px',
};

export const TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: 'var(--gs-chrome)',
  fontFamily: 'var(--font-data)',
  fontSize: '12px',
  padding: '2px 0',
};

/* ── Legend Configuration ─────────────────────────────────────── */

export const LEGEND_CONFIG = {
  verticalAlign: 'bottom' as const,
  align: 'center' as const,
  iconType: 'circle' as const,
  iconSize: 8,
  wrapperStyle: {
    fontFamily: 'var(--font-data)',
    fontSize: '12px',
    color: 'var(--gs-muted)',
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

/* ── Axis Styling ────────────────────────────────────────────── */

export const AXIS_STYLE = {
  tick: {
    fontFamily: 'var(--font-data)',
    fontSize: 12,
    fill: 'var(--gs-muted)',
  },
  axisLine: {
    stroke: 'var(--gs-chrome-dark)',
    strokeWidth: 1,
  },
  tickLine: false as const,
};

export const GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: 'var(--gs-chrome-dark)',
  vertical: false,
};

/* ── Number Formatters ───────────────────────────────────────── */

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

/* ── Animation Config ────────────────────────────────────────── */

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
   Color Palettes — Classified File on Gallery Paper
   ═══════════════════════════════════════════════════════════════ */

/**
 * Primary chart palette — 10 colors.
 * Ink (primary), Red (accent), then functional + warm neutrals.
 */
export const CHART_PALETTE = [
  'var(--gs-ink)',          // Primary data series (near-black)
  'var(--gs-red)',          // Accent (the red)
  'var(--gs-terminal)',     // Positive / healthy (green)
  'var(--gs-warning)',      // Caution (amber)
  'var(--gs-muted)',        // Neutral / baseline
  'var(--gs-red-dark)',     // Dark red variant
  '#5B8A72',               // Tertiary (muted sage)
  '#C17F59',               // Quaternary (warm copper)
  '#7B6B8A',               // Quinary (dusty plum)
  '#5A8F8F',               // Senary (teal slate)
] as const;

/** Traffic light — the universal health indicator */
export const TRAFFIC_LIGHT_COLORS = {
  green: 'var(--gs-terminal)',
  amber: 'var(--gs-warning)',
  red: 'var(--gs-critical)',
} as const;

/** Status indicators */
export const STATUS_COLORS = {
  active: 'var(--gs-terminal)',
  inactive: 'var(--gs-muted)',
  degraded: 'var(--gs-warning)',
  error: 'var(--gs-critical)',
  blocked: 'var(--gs-ink)',
} as const;

/** Resource type colors */
export const RESOURCE_COLORS = {
  js: 'var(--gs-warning)',
  css: 'var(--gs-terminal)',
  images: 'var(--gs-red)',
  fonts: 'var(--gs-muted)',
  xhr: 'var(--gs-ink)',
  other: '#5A8F8F',
} as const;

/** Category badge accent colors */
export const CATEGORY_BADGE_COLORS: Record<string, string> = {
  analytics: 'var(--gs-ink)',
  ads: 'var(--gs-red)',
  automation: 'var(--gs-terminal)',
  cms: 'var(--gs-warning)',
  cdn: '#5A8F8F',
  security: '#5B8A72',
  ecommerce: '#C17F59',
  social: '#7B6B8A',
  other: 'var(--gs-muted)',
};

/** Score tier colors */
export const SCORE_TIER_COLORS = {
  critical: 'var(--gs-critical)',
  warning: 'var(--gs-warning)',
  good: 'var(--gs-terminal)',
  excellent: 'var(--gs-red)',       // Red = excellence in this palette
} as const;

export function getScoreTierColor(score: number): string {
  if (score >= 80) return SCORE_TIER_COLORS.excellent;
  if (score >= 60) return SCORE_TIER_COLORS.good;
  if (score >= 40) return SCORE_TIER_COLORS.warning;
  return SCORE_TIER_COLORS.critical;
}

/** Traffic source colors */
export const TRAFFIC_SOURCE_COLORS: Record<string, string> = {
  Direct: 'var(--gs-ink)',
  'Organic Search': 'var(--gs-terminal)',
  'Paid Search': 'var(--gs-red)',
  Social: 'var(--gs-warning)',
  Referral: 'var(--gs-muted)',
  Email: '#5A8F8F',
  Display: '#5B8A72',
};

/* ── Margins ─────────────────────────────────────────────────── */

export const CHART_MARGINS = {
  bento: { top: 8, right: 8, bottom: 8, left: 8 },
  standard: { top: 20, right: 30, bottom: 20, left: 40 },
  wideLabel: { top: 20, right: 30, bottom: 20, left: 120 },
  withLegend: { top: 20, right: 30, bottom: 60, left: 40 },
  print: { top: 24, right: 40, bottom: 24, left: 48 },
} as const;

/* ── PDF Dimensions ──────────────────────────────────────────── */

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

/** Print-safe monochrome palette */
export const PRINT_PALETTE = [
  'var(--gs-ink)',
  'var(--gs-muted)',
  'var(--gs-chrome-dark)',
  'var(--gs-chrome)',
  'var(--gs-chrome-light)',
] as const;

/* ═══════════════════════════════════════════════════════════════
   Resolved Values for SVG Inline Styles
   ═══════════════════════════════════════════════════════════════ */

export const RESOLVED_COLORS = {
  ink:         '#1A1A1A',
  red:         '#E63946',
  redDark:     '#C1121F',
  chrome:      '#E8E3DB',
  chromeDark:  '#D1CBC1',
  chromeLight: '#F5F0EA',
  paper:       '#FFFBF5',
  muted:       '#8B8680',
  ghost:       '#E0F0FF',
  terminal:    'oklch(0.80 0.25 145)',
  critical:    'oklch(0.55 0.22 25)',
  warning:     'oklch(0.78 0.15 75)',
} as const;

/** Cookie category colors */
export const COOKIE_CATEGORY_COLORS: Record<string, string> = {
  essential:   RESOLVED_COLORS.terminal,
  functional:  '#5A8F8F',
  analytics:   RESOLVED_COLORS.warning,
  advertising: RESOLVED_COLORS.critical,
  unknown:     RESOLVED_COLORS.muted,
};

/** CWV rating colors */
export const CWV_RATING_COLORS: Record<string, string> = {
  good:                  RESOLVED_COLORS.terminal,
  'needs-improvement':   RESOLVED_COLORS.warning,
  poor:                  RESOLVED_COLORS.critical,
};

/** Tool utilization heat levels */
export const UTILIZATION_COLORS: Record<string, string> = {
  high:   RESOLVED_COLORS.terminal,
  medium: RESOLVED_COLORS.warning,
  low:    RESOLVED_COLORS.critical,
  none:   RESOLVED_COLORS.chromeLight,
};

/** Flow diagram node colors */
export const FLOW_NODE_COLORS: Record<string, string> = {
  source:   RESOLVED_COLORS.red,
  healthy:  RESOLVED_COLORS.terminal,
  warning:  RESOLVED_COLORS.warning,
  critical: RESOLVED_COLORS.critical,
  neutral:  RESOLVED_COLORS.muted,
};

/** Scatter quadrant colors */
export const QUADRANT_COLORS: Record<string, string> = {
  quickWins:   RESOLVED_COLORS.terminal,
  strategic:   RESOLVED_COLORS.red,
  lowPriority: RESOLVED_COLORS.muted,
  avoid:       RESOLVED_COLORS.critical,
};
