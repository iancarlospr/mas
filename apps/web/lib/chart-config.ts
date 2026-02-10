/**
 * Chart configuration constants per PRD-cont-1 Section 2.
 * Shared by all Recharts and custom SVG chart components.
 */

// 2.1 Default Dimensions and Aspect Ratios
export const CHART_ASPECTS = {
  wide: 3,        // 3:1 — sparklines, trend lines
  landscape: 2,   // 2:1 — bar charts, area charts
  standard: 1.6,  // 16:10 — general purpose
  square: 1,      // 1:1 — scatter plots, quadrants
  portrait: 0.75, // 3:4 — vertical bar charts on mobile
} as const;

export const CHART_HEIGHTS = {
  bentoSmall: 200,   // 1x1 bento cards
  bentoWide: 240,    // 2x1 bento cards
  bentoTall: 400,    // 1x2 bento cards
  bentoFeature: 360, // 2x2 bento cards
  reportFull: 400,   // P2 full-width
  reportHalf: 300,   // P2 half-width
  printA4Full: 500,  // A4 print full-width
  printA4Half: 340,  // A4 print half-width
} as const;

// 2.3 Tooltip styling
export const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: '#1A1A2E',
  border: 'none',
  borderRadius: '8px',
  padding: '12px 16px',
  boxShadow: '0 4px 24px rgba(26, 26, 46, 0.24)',
};

export const TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: '#FAFBFC',
  fontFamily: '"Plus Jakarta Sans", sans-serif',
  fontWeight: 700,
  fontSize: '13px',
  marginBottom: '4px',
};

export const TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: '#94A3B8',
  fontFamily: '"Inter", sans-serif',
  fontSize: '12px',
  padding: '2px 0',
};

// 2.4 Legend configuration
export const LEGEND_CONFIG = {
  verticalAlign: 'bottom' as const,
  align: 'center' as const,
  iconType: 'circle' as const,
  iconSize: 8,
  wrapperStyle: {
    fontFamily: '"Inter", sans-serif',
    fontSize: '12px',
    color: '#64748B',
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

// 2.5 Axis styling
export const AXIS_STYLE = {
  tick: {
    fontFamily: '"Inter", sans-serif',
    fontSize: 12,
    fill: '#64748B',
  },
  axisLine: {
    stroke: '#E2E8F0',
    strokeWidth: 1,
  },
  tickLine: false as const,
};

export const GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: '#F1F5F9',
  vertical: false,
};

// 2.5 Number formatters for axes
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

// 2.6 Animation configuration
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

// 2.7 Color palettes
export const CHART_PALETTE = [
  '#1A1A2E', // Deep Navy — primary series
  '#E94560', // Soft Red — secondary/CTA
  '#06D6A0', // Soft Green — success/positive
  '#FFD166', // Warm Amber — warning/tertiary
  '#94A3B8', // Slate — muted/baseline
  '#7C3AED', // Purple — extended palette
  '#0EA5E9', // Sky — extended palette
  '#F97316', // Orange — extended palette
  '#EC4899', // Pink — extended palette
  '#14B8A6', // Teal — extended palette
] as const;

export const TRAFFIC_LIGHT_COLORS = {
  green: '#06D6A0',
  amber: '#FFD166',
  red: '#EF476F',
} as const;

export const STATUS_COLORS = {
  active: '#06D6A0',
  inactive: '#94A3B8',
  degraded: '#FFD166',
  error: '#EF476F',
  blocked: '#1A1A2E',
} as const;

export const RESOURCE_COLORS = {
  js: '#FFD166',
  css: '#06D6A0',
  images: '#E94560',
  fonts: '#94A3B8',
  xhr: '#1A1A2E',
  other: '#7C3AED',
} as const;

export const CATEGORY_BADGE_COLORS: Record<string, string> = {
  analytics: '#1A1A2E',
  ads: '#E94560',
  automation: '#06D6A0',
  cms: '#FFD166',
  cdn: '#0EA5E9',
  security: '#7C3AED',
  ecommerce: '#F97316',
  social: '#EC4899',
  other: '#94A3B8',
};

// Score tier colors (Section 1.1)
export const SCORE_TIER_COLORS = {
  critical: '#EF476F',  // 0-39
  warning: '#FFD166',   // 40-59
  good: '#06D6A0',      // 60-79
  excellent: '#1A1A2E', // 80-100
} as const;

export function getScoreTierColor(score: number): string {
  if (score >= 80) return SCORE_TIER_COLORS.excellent;
  if (score >= 60) return SCORE_TIER_COLORS.good;
  if (score >= 40) return SCORE_TIER_COLORS.warning;
  return SCORE_TIER_COLORS.critical;
}

// Traffic source colors (Section 1.13)
export const TRAFFIC_SOURCE_COLORS: Record<string, string> = {
  Direct: '#1A1A2E',
  'Organic Search': '#06D6A0',
  'Paid Search': '#E94560',
  Social: '#FFD166',
  Referral: '#94A3B8',
  Email: '#7C3AED',
  Display: '#0EA5E9',
};

// 2.8 Margin/Padding standards
export const CHART_MARGINS = {
  bento: { top: 8, right: 8, bottom: 8, left: 8 },
  standard: { top: 20, right: 30, bottom: 20, left: 40 },
  wideLabel: { top: 20, right: 30, bottom: 20, left: 120 },
  withLegend: { top: 20, right: 30, bottom: 60, left: 40 },
  print: { top: 24, right: 40, bottom: 24, left: 48 },
} as const;

// 6.2 A4 PDF Dimensions
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

// Print B&W-safe palette (Section 6.4)
export const PRINT_PALETTE = [
  '#1A1A2E',
  '#4A4A5E',
  '#7A7A8E',
  '#AAAABC',
  '#D0D0DD',
] as const;
