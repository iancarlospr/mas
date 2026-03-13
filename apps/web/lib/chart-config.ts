/**
 * Chloe's Bedroom OS — Chart Configuration
 * ============================================
 *
 * Palette: Monochromatic Pink (OKLCH hue 340)
 * Charts use pink primary series + functional traffic lights for data.
 */

/* -- Dimensions & Aspect Ratios --------------------------------- */

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

/* -- Tooltip Styling ------------------------------------------- */

export const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'oklch(0.13 0.01 340)',
  border: '1px solid oklch(0.35 0.05 340)',
  borderRadius: '8px',
  padding: '8px 12px',
  boxShadow: '0 4px 16px oklch(0.08 0.01 340 / 0.4)',
};

export const TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: 'oklch(0.96 0.04 340)',
  fontFamily: 'var(--font-data)',
  fontWeight: 700,
  fontSize: '13px',
  marginBottom: '4px',
};

export const TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: 'oklch(0.35 0.05 340)',
  fontFamily: 'var(--font-data)',
  fontSize: '12px',
  padding: '2px 0',
};

/* -- Legend Configuration -------------------------------------- */

export const LEGEND_CONFIG = {
  verticalAlign: 'bottom' as const,
  align: 'center' as const,
  iconType: 'circle' as const,
  iconSize: 8,
  wrapperStyle: {
    fontFamily: 'var(--font-data)',
    fontSize: '12px',
    color: 'var(--gs-mid)',
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

/* -- Axis Styling --------------------------------------------- */

export const AXIS_STYLE = {
  tick: {
    fontFamily: 'var(--font-data)',
    fontSize: 12,
    fill: 'var(--gs-mid)',
  },
  axisLine: {
    stroke: 'var(--gs-mid)',
    strokeWidth: 1,
  },
  tickLine: false as const,
};

export const GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: 'oklch(0.22 0.03 340)',
  vertical: false,
};

/* -- Number Formatters ---------------------------------------- */

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

/* -- Animation Config ---------------------------------------- */

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

/* =================================================================
   Color Palettes — Monochromatic Pink
   ================================================================= */

/**
 * Primary chart palette — 10 colors.
 * Pink primary, then functional + complementary desaturated tones.
 */
export const CHART_PALETTE = [
  'var(--gs-base)',          // Primary data series (pink)
  'var(--gs-bright)',        // Bright pink
  'var(--gs-terminal)',      // Positive / healthy (green)
  'var(--gs-warning)',       // Caution (amber)
  'var(--gs-mid)',           // Neutral / baseline
  'oklch(0.68 0.16 340)',    // Deep pink variant
  'oklch(0.65 0.10 200)',    // Muted teal
  'oklch(0.70 0.10 60)',     // Warm copper
  'oklch(0.60 0.08 300)',    // Dusty plum
  'oklch(0.60 0.08 180)',    // Teal slate
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
  inactive: 'var(--gs-mid)',
  degraded: 'var(--gs-warning)',
  error: 'var(--gs-critical)',
  blocked: 'var(--gs-void)',
} as const;

/** Resource type colors */
export const RESOURCE_COLORS = {
  js: 'var(--gs-warning)',
  css: 'var(--gs-terminal)',
  images: 'var(--gs-base)',
  fonts: 'var(--gs-mid)',
  xhr: 'var(--gs-bright)',
  other: 'oklch(0.60 0.08 180)',
} as const;

/** Category badge accent colors */
export const CATEGORY_BADGE_COLORS: Record<string, string> = {
  analytics: 'var(--gs-base)',
  ads: 'oklch(0.68 0.16 340)',
  automation: 'var(--gs-terminal)',
  cms: 'var(--gs-warning)',
  cdn: 'oklch(0.60 0.08 180)',
  security: 'oklch(0.65 0.10 200)',
  ecommerce: 'oklch(0.70 0.10 60)',
  social: 'oklch(0.60 0.08 300)',
  other: 'var(--gs-mid)',
};

/** Score tier colors */
export const SCORE_TIER_COLORS = {
  critical: 'var(--gs-critical)',
  warning: 'var(--gs-warning)',
  good: 'var(--gs-terminal)',
  excellent: 'var(--gs-base)',
} as const;

export function getScoreTierColor(score: number): string {
  if (score >= 80) return SCORE_TIER_COLORS.excellent;
  if (score >= 60) return SCORE_TIER_COLORS.good;
  if (score >= 40) return SCORE_TIER_COLORS.warning;
  return SCORE_TIER_COLORS.critical;
}

/** Traffic source colors */
export const TRAFFIC_SOURCE_COLORS: Record<string, string> = {
  Direct: 'var(--gs-base)',
  'Organic Search': 'var(--gs-terminal)',
  'Paid Search': 'oklch(0.68 0.16 340)',
  Social: 'var(--gs-warning)',
  Referral: 'var(--gs-mid)',
  Email: 'oklch(0.60 0.08 180)',
  Display: 'oklch(0.65 0.10 200)',
};

/* -- Margins --------------------------------------------------- */

export const CHART_MARGINS = {
  bento: { top: 8, right: 8, bottom: 8, left: 8 },
  standard: { top: 20, right: 30, bottom: 20, left: 40 },
  wideLabel: { top: 20, right: 30, bottom: 20, left: 120 },
  withLegend: { top: 20, right: 30, bottom: 60, left: 40 },
  print: { top: 24, right: 40, bottom: 24, left: 48 },
} as const;

/* -- PDF Dimensions ------------------------------------------- */

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
  'var(--gs-void)',
  'var(--gs-mid)',
  'var(--gs-deep)',
  'var(--gs-base)',
  'var(--gs-light)',
] as const;

/* =================================================================
   Resolved Values for SVG Inline Styles
   ================================================================= */

export const RESOLVED_COLORS = {
  void:        '#080808',
  deep:        '#1A161A',
  mid:         '#4A3844',
  base:        '#FFB2EF',
  bright:      '#FFCAF3',
  light:       '#FFF0FA',
  terminal:    'oklch(0.80 0.25 145)',
  critical:    'oklch(0.55 0.22 25)',
  warning:     'oklch(0.78 0.15 75)',
  /* Backward-compat aliases */
  ink:         '#080808',
  red:         '#FFB2EF',
  redDark:     '#C87ABC',
  chrome:      '#1A161A',
  chromeDark:  '#4A3844',
  chromeLight: '#2E242A',
  paper:       '#FFF0FA',
  muted:       '#4A3844',
  ghost:       '#FFB2EF',
} as const;

/** Cookie category colors */
export const COOKIE_CATEGORY_COLORS: Record<string, string> = {
  essential:   RESOLVED_COLORS.terminal,
  functional:  'oklch(0.60 0.08 180)',
  analytics:   RESOLVED_COLORS.warning,
  advertising: RESOLVED_COLORS.critical,
  unknown:     RESOLVED_COLORS.mid,
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
  none:   RESOLVED_COLORS.deep,
};

/** Flow diagram node colors */
export const FLOW_NODE_COLORS: Record<string, string> = {
  source:   RESOLVED_COLORS.base,
  healthy:  RESOLVED_COLORS.terminal,
  warning:  RESOLVED_COLORS.warning,
  critical: RESOLVED_COLORS.critical,
  neutral:  RESOLVED_COLORS.mid,
};

/** Scatter quadrant colors */
export const QUADRANT_COLORS: Record<string, string> = {
  quickWins:   RESOLVED_COLORS.terminal,
  strategic:   RESOLVED_COLORS.base,
  lowPriority: RESOLVED_COLORS.mid,
  avoid:       RESOLVED_COLORS.critical,
};
