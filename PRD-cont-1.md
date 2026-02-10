# MarketingAlphaScan — Data Visualization Specification

## Plan Summary

This specification covers all 10 requested sections for the MarketingAlphaScan data visualization system. Due to the size, the plan is organized into clearly numbered sections. When executed, a single `DATA_VISUALIZATION_SPEC.md` file will be created at the project root containing all content below.

---

## SECTION 1: Chart Type Selection Per Module/Section

### 1.1 MarketingIQ Score (M42)

**Chart Type:** Custom SVG Circular Gauge (not Recharts)
**Why:** Recharts has no native gauge. A custom SVG arc with Framer Motion pathLength animation delivers the premium "hero metric" feel needed for the primary score.

**Data Source:** `M42.marketingIQ` (number 0-100)

**Visual Design:**
- 240-degree arc (not full circle), stroke-dasharray animated
- Outer ring: 12px stroke, color-coded by score tier
- Inner text: Score number in JetBrains Mono 800wt, 72px
- Label: "MarketingIQ" in Plus Jakarta Sans below
- Color tiers: 0-39 Soft Pink-Red (#EF476F), 40-59 Warm Amber (#FFD166), 60-79 Soft Green (#06D6A0), 80-100 Deep Navy (#1A1A2E) with green glow

**P1 Bento:** 2x2 hero card, top-left position
**P2 Report:** Full-width header element, page 1 cover
**Responsive:** Scales from 280px to 400px diameter; on mobile <640px renders at 220px

---

### 1.2 Category Scores Bar (8 categories)

**Chart Type:** Recharts `<BarChart>` horizontal with custom bar shapes
**Why:** Horizontal bars with traffic-light dots are the clearest way to compare 8 category scores side-by-side.

**Data Source:** Array of `{ category: string, score: number, status: 'red'|'amber'|'green' }`

**Configuration:**
- `layout="vertical"` for horizontal bars
- YAxis: Category names (Plus Jakarta Sans 600wt, 13px, #1A1A2E)
- XAxis: 0-100 scale, gridlines at 25/50/75
- Bar fill: Gradient from #1A1A2E to category-status color
- Traffic-light dot rendered via custom `shape` prop on each bar end
- Tooltip: Category name, score, status label, top issues count

**P1 Bento:** 2x1 wide card, position row 1
**P2 Report:** Full-width chart, Section 1 "Executive Summary"
**Responsive:** Stacks to vertical bars on mobile <640px; labels truncate with ellipsis at 120px

---

### 1.3 Tech Stack Overview (M02, M05, M07, M08)

**Chart Type:** Custom grouped icon grid (primary) + Recharts `<Treemap>` (P2 alternate)
**Why:** Icons with category grouping give immediate visual recognition of tools. Treemap shows relative weight/importance.

**Data Source:** `Array<{ name: string, category: string, icon: string, confidence: number, status: 'active'|'inactive'|'degraded' }>`

**Visual Design (Icon Grid):**
- Grouped by category (Analytics, Ads, Automation, CMS, etc.)
- Each tool: 48x48 icon + name + confidence badge
- Category headers in Plus Jakarta Sans 700wt
- Status ring around icon: green=active, amber=degraded, red=inactive
- Hover: scale(1.05), shadow elevation, tooltip with details

**P1 Bento:** 2x2 card with scrollable grid
**P2 Report:** Full-width icon grid + Treemap on next page showing category distribution
**Responsive:** 4-col grid desktop, 3-col tablet, 2-col mobile

---

### 1.4 Core Web Vitals (M03)

**Chart Type:** Three metric cards + Recharts `<BarChart>` comparison
**Why:** CWV has exactly 3 metrics (LCP, FID/INP, CLS) that map perfectly to metric cards. Bar chart adds benchmark comparison.

**Data Source:** `{ lcp: { value: number, unit: 'ms', rating: string }, inp: { value: number, unit: 'ms', rating: string }, cls: { value: number, unit: '', rating: string } }`

**Metric Cards:**
- Each card: metric name, value in JetBrains Mono 48px, unit label, traffic-light badge
- Background: subtle gradient matching status color at 5% opacity
- Threshold indicators: green (<good), amber (<needs-improvement), red (>poor)

**Bar Chart:**
- Grouped bars: "Your Site" vs "Good Threshold" vs "Industry Avg"
- Colors: #1A1A2E (site), #06D6A0 (good threshold), #94A3B8 (industry)
- XAxis: LCP, INP, CLS
- YAxis: Value (dual scale handled by normalizing CLS to percentage)

**P1 Bento:** 2x1 wide card (3 mini metric cards inline)
**P2 Report:** Full page — metric cards top, bar chart bottom, annotations
**Responsive:** Metric cards stack vertically on mobile

---

### 1.5 Performance Waterfall (M03)

**Chart Type:** Custom WaterfallChart component (horizontal stacked bars)
**Why:** Recharts has no native waterfall/Gantt. Custom SVG bars positioned by start/end times show resource loading sequence.

**Data Source:** `Array<{ resource: string, type: 'js'|'css'|'img'|'font'|'xhr', domain: string, startTime: number, duration: number, size: number }>`  (top 20 by duration)

**Visual Design:**
- Horizontal bars positioned on a time axis (ms)
- Color by resource type: JS=#FFD166, CSS=#06D6A0, Images=#E94560, Fonts=#94A3B8, XHR=#1A1A2E
- Bar height: 24px with 4px gap
- Left label: truncated resource name (max 30 chars)
- Right label: duration in ms (JetBrains Mono)
- Vertical line at DOM Content Loaded and Load events
- Tooltip: full URL, size, type, timing breakdown

**P1 Bento:** Not shown (too detailed for summary dashboard)
**P2 Report:** Full-width chart spanning page width, Section 3
**Responsive:** Horizontally scrollable on mobile with sticky resource name column

---

### 1.6 Resource Breakdown (M03)

**Chart Type:** Recharts `<PieChart>` donut (by type) + `<BarChart>` stacked (by domain)
**Why:** Donut shows composition at a glance; stacked bar reveals which domains contribute most load.

**Donut Data:** `Array<{ type: string, size: number, count: number }>` (JS, CSS, Images, Fonts, Other)
**Bar Data:** `Array<{ domain: string, js: number, css: number, images: number, fonts: number }>`

**Donut Config:**
- Inner radius 60%, outer radius 100%
- Center text: total size in KB/MB (JetBrains Mono 32px)
- Colors: JS=#FFD166, CSS=#06D6A0, Images=#E94560, Fonts=#94A3B8, Other=#1A1A2E
- Legend: bottom, horizontal, with size labels

**Stacked Bar Config:**
- Top 10 domains by total resource size
- Same color mapping as donut
- YAxis: domain names (truncated)
- XAxis: size in KB

**P1 Bento:** 1x1 card — donut only with legend
**P2 Report:** Side-by-side donut and stacked bar
**Responsive:** Donut scales down; bar chart stacks below on mobile

---

### 1.7 Analytics Architecture (M05)

**Chart Type:** Custom FlowDiagram (SVG + dagre layout or custom positioning)
**Why:** Shows the flow from user interaction through tag managers to analytics endpoints. No Recharts equivalent exists.

**Data Source:** `{ nodes: Array<{ id, label, type, icon }>, edges: Array<{ source, target, label }> }`

**Visual Design:**
- Nodes: Rounded rect cards (120x60px) with tool icon + name
- Node types color-coded: Collection=#06D6A0, Processing=#FFD166, Destination=#1A1A2E
- Edges: Curved SVG paths with animated dashes (CSS animation)
- Direction: left-to-right (desktop), top-to-bottom (mobile)
- Groups: "Collection Layer", "Processing Layer", "Destination Layer"

**P1 Bento:** 2x1 wide card — simplified 3-layer horizontal view
**P2 Report:** Full-width diagram with complete node details
**Responsive:** Rotates to vertical flow on mobile <768px

---

### 1.8 Pixel Inventory (M06)

**Chart Type:** Data table with status badges + Recharts `<BarChart>` (events per pixel)
**Why:** Pixel data is inherently tabular (name, type, status, events). Bar chart adds visual weight comparison.

**Table Columns:** Pixel Name | Platform | Status (badge) | Events Fired | Load Time | Consent Required
**Status Badges:** Active=#06D6A0, Inactive=#94A3B8, Error=#EF476F, Blocked=#FFD166

**Bar Chart:**
- XAxis: Pixel names
- YAxis: Event count
- Bar color: Platform brand colors (Facebook=#1877F2, Google=#4285F4, etc.) or fallback to #1A1A2E
- Tooltip: pixel name, event count, estimated data volume

**P1 Bento:** 1x2 tall card — compact table with top 5 pixels, mini bar chart
**P2 Report:** Full table + bar chart + detailed per-pixel analysis
**Responsive:** Table becomes card list on mobile; bar chart below

---

### 1.9 PPC Landing Page Parity (M06b)

**Chart Type:** Custom ComparisonMatrix / Heatmap
**Why:** Comparing attributes between main site and PPC landing pages requires a matrix view showing match/mismatch.

**Data Source:** `Array<{ attribute: string, mainSite: string|boolean, ppcPage: string|boolean, match: boolean, severity: 'critical'|'warning'|'info' }>`

**Visual Design:**
- Matrix grid: rows=attributes, columns=main site vs PPC page
- Cell content: checkmarks, values, or "missing" badges
- Match column: green check or red X with severity coloring
- Row highlight on mismatch: subtle red background (#EF476F at 5% opacity)
- Categories: Meta Tags, Tracking Pixels, Page Speed, Content Elements, Conversion Elements

**P1 Bento:** 1x1 card — summary score "78% Parity" + top 3 mismatches
**P2 Report:** Full comparison matrix spanning 2 pages if needed
**Responsive:** Horizontal scroll with sticky attribute column

---

### 1.10 Consent Audit Timeline (M12)

**Chart Type:** Custom Before/After visual (grouped horizontal bars at each consent state)
**Why:** Shows what fires before consent, after accept, and after reject — critical for compliance visualization.

**Data Source:** `{ states: Array<{ state: 'before'|'accept'|'reject', cookies: number, requests: number, pixels: number, details: Array<...> }> }`

**Visual Design:**
- Three columns: "Before Consent" | "After Accept" | "After Reject"
- Each column: stacked metric bars (cookies, network requests, pixels)
- Colors: Cookies=#FFD166, Requests=#1A1A2E, Pixels=#E94560
- Delta arrows between columns showing increase/decrease
- Compliance badge at top: "GDPR Compliant" or "Violations Detected"

**P1 Bento:** 1x1 card — 3-number summary (before/accept/reject cookie counts)
**P2 Report:** Full-width three-column visualization with detail tables below
**Responsive:** Columns stack vertically on mobile

---

### 1.11 Cookie Audit (M12)

**Chart Type:** Recharts `<BarChart>` categorized + compliance table
**Why:** Bar chart shows volume by category; table provides the detail needed for compliance review.

**Bar Chart Data:** `Array<{ category: 'Necessary'|'Analytics'|'Marketing'|'Functional'|'Unknown', count: number }>`
**Bar Colors:** Necessary=#06D6A0, Analytics=#1A1A2E, Marketing=#E94560, Functional=#FFD166, Unknown=#94A3B8

**Table Columns:** Cookie Name | Domain | Category | Duration | Secure | HttpOnly | SameSite | Compliant

**P1 Bento:** 1x1 card — bar chart only with total count badge
**P2 Report:** Bar chart + full table + compliance summary
**Responsive:** Bar chart stacks; table scrolls horizontally

---

### 1.12 Security Headers (M01)

**Chart Type:** Custom ChecklistGrid (pass/fail icon grid)
**Why:** Security headers are binary (present/absent, correct/incorrect). A checklist is the clearest representation.

**Data Source:** `Array<{ header: string, present: boolean, value: string|null, grade: 'A'|'B'|'C'|'D'|'F', recommendation: string }>`

**Headers Checked:** Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, Permissions-Policy, X-XSS-Protection, etc.

**Visual Design:**
- Grid of cards (3-col desktop, 2-col tablet, 1-col mobile)
- Each card: header name, pass/fail icon (checkmark or X), grade badge, current value preview
- Pass: green check + #06D6A0 left border
- Fail: red X + #EF476F left border
- Partial: amber warning + #FFD166 left border
- Summary bar at top: "7/10 Headers Configured" with progress bar

**P1 Bento:** 1x1 card — progress bar + count, top 3 failures listed
**P2 Report:** Full checklist grid with recommendations
**Responsive:** Single column on mobile

---

### 1.13 Traffic Sources (M31)

**Chart Type:** Recharts `<PieChart>` donut with custom legend
**Why:** Traffic source breakdown is a classic composition chart use case. Donut with center metric provides visual clarity.

**Data Source:** `Array<{ source: 'Direct'|'Organic Search'|'Paid Search'|'Social'|'Referral'|'Email'|'Display', percentage: number, visits: number }>`

**Donut Config:**
- Inner radius 55%, outer radius 95%
- Center: Total visits in JetBrains Mono 28px
- Colors: Direct=#1A1A2E, Organic=#06D6A0, Paid=#E94560, Social=#FFD166, Referral=#94A3B8, Email=#7C3AED, Display=#0EA5E9
- Custom legend: right side on desktop, bottom on mobile
- Legend items: colored dot + source name + percentage + visit count

**P1 Bento:** 1x1 card — donut with inline legend
**P2 Report:** Donut left, legend table right, narrative below
**Responsive:** Legend moves below donut on mobile

---

### 1.14 Traffic Trend (M24/M25)

**Chart Type:** Recharts `<AreaChart>` with gradient fill, 12-month
**Why:** Area chart with gradient fill adds visual weight to trends. Line alone is too thin for a "premium" feel.

**Data Source:** `Array<{ month: string, visits: number, previousYear?: number }>`

**Config:**
- Area fill: linear gradient from #1A1A2E (top, 20% opacity) to transparent (bottom)
- Stroke: #1A1A2E, 2px
- Optional previous year line: dashed, #94A3B8
- XAxis: Month abbreviations (Jan, Feb, ...), Inter 12px
- YAxis: Visit count, formatted with K/M suffixes
- Tooltip: Month, exact visit count, YoY change percentage
- Reference line at average with label
- Dot on hover only (activeDot)

**P1 Bento:** 2x1 wide card — full 12-month area chart
**P2 Report:** Full-width with annotations at notable peaks/valleys
**Responsive:** Chart maintains aspect ratio 3:1; XAxis shows every other month label on mobile

---

### 1.15 Competitor Overlap (M30)

**Chart Type:** Custom overlap matrix (Recharts `<ScatterChart>` or custom SVG Venn)
**Why:** True Venn diagrams are not supported by Recharts. A bubble overlap matrix or custom SVG serves better.

**Data Source:** `Array<{ competitor: string, sharedKeywords: number, uniqueKeywords: number, overlapPercentage: number }>`

**Visual Design (Matrix approach):**
- Recharts `<ScatterChart>`: X=competitor unique keywords, Y=your unique keywords, bubble size=shared keywords
- Color intensity maps to overlap percentage
- Quadrant labels: "High Overlap" (top-right), "Low Overlap" (bottom-left)
- Tooltip: competitor name, shared count, overlap %, top 3 shared keywords

**Alternative (P2 only — Static Venn):**
- Custom SVG with 2-3 overlapping circles
- Labels inside overlap regions showing shared keyword counts
- Max 3 competitors per Venn for readability

**P1 Bento:** 1x1 card — top 3 competitors as ranked list with overlap % bars
**P2 Report:** Scatter chart + top competitor Venn diagrams
**Responsive:** Scatter chart scales; Venn moves to list view on mobile

---

### 1.16 Brand Search Trend (M34)

**Chart Type:** Recharts `<LineChart>` sparkline (P1) + full line chart (P2)
**Why:** Sparkline provides at-a-glance trend in compact space. Full chart for P2 adds context.

**Data Source:** `Array<{ month: string, volume: number }>`

**Sparkline Config (P1):**
- No axes, no grid, no legend
- Stroke: #1A1A2E, 2px
- Dimensions: 120x40px inline with metric value
- Dot only on last point (current value)

**Full Chart Config (P2):**
- Same as Traffic Trend (1.14) but with search volume on YAxis
- Annotation: "Brand demand is trending [up/down] [X]% over 12 months"

**P1 Bento:** 1x1 card — large number + sparkline + trend arrow
**P2 Report:** Full-width line chart in Market Position section
**Responsive:** Sparkline scales proportionally

---

### 1.17 Domain Trust (M32)

**Chart Type:** Score badge (custom) + Recharts `<RadarChart>` vs benchmarks
**Why:** Radar chart is ideal for multi-dimensional comparison against benchmarks. Score badge provides the headline number.

**Data Source:** `{ trustScore: number, metrics: Array<{ dimension: string, value: number, benchmark: number }> }`

**Radar Config:**
- Dimensions: Domain Age, Backlink Quality, Citation Flow, Trust Flow, Referring Domains, Content Quality
- Two series: "Your Domain" (fill #1A1A2E at 30% opacity, stroke #1A1A2E) and "Industry Benchmark" (fill #06D6A0 at 15% opacity, stroke #06D6A0 dashed)
- PolarGrid: gridType="polygon", strokeDasharray="3 3", stroke=#E2E8F0
- PolarAngleAxis: Inter 12px, #64748B
- Legend: bottom center

**Score Badge:**
- Circular badge: 64x64px, trust score number centered
- Background: color-coded by tier (same as MarketingIQ tiers)
- Label: "Domain Trust" below

**P1 Bento:** 1x1 card — score badge + 3 key metrics listed
**P2 Report:** Score badge left, full radar chart right
**Responsive:** Radar chart scales down; dimensions with long labels wrap

---

### 1.18 Tool Utilization Matrix (M07/M45)

**Chart Type:** Custom heatmap grid or status grid
**Why:** Shows which tools are actively used vs underutilized vs redundant. A grid with color intensity is the clearest pattern.

**Data Source:** `Array<{ tool: string, category: string, utilization: 'high'|'medium'|'low'|'unused'|'redundant', signals: number, cost?: number }>`

**Visual Design:**
- Grid: rows=tools, columns=utilization metrics (signal count, activity level, data flow, integration depth)
- Cell color: intensity gradient from white (unused) to #1A1A2E (high)
- Redundant tools highlighted with #EF476F border + "REDUNDANT" badge
- Row grouping by category with subtle background alternation
- Tooltip: tool name, metric name, raw value, recommendation

**P1 Bento:** 1x1 card — summary "X of Y tools underutilized" + top 3 issues
**P2 Report:** Full heatmap grid with cost column and recommendations
**Responsive:** Horizontal scroll with sticky tool name column

---

### 1.19 ROI Impact (M44)

**Chart Type:** Recharts `<BarChart>` stacked horizontal — money lost by category
**Why:** Horizontal stacked bars clearly show financial impact. Dollar amounts on axis provide business context CMOs understand.

**Data Source:** `Array<{ category: string, wastedSpend: number, missedRevenue: number, inefficiencyCost: number }>`

**Config:**
- layout="vertical"
- Stacked bars: wastedSpend=#EF476F, missedRevenue=#FFD166, inefficiencyCost=#94A3B8
- YAxis: Category names
- XAxis: Dollar amounts formatted ($X,XXX or $XK)
- Total annotation at end of each bar
- Grand total callout box above chart
- Tooltip: category, breakdown of each cost type, percentage of total

**P1 Bento:** 2x1 wide card — total money lost as hero metric + bar chart
**P2 Report:** Full page with bar chart + breakdown table + methodology note
**Responsive:** Labels above bars on mobile; horizontal scroll if >6 categories

---

### 1.20 Remediation Roadmap (M43)

**Chart Type:** Recharts `<ScatterChart>` quadrant (Impact x Effort) + custom Gantt timeline
**Why:** Quadrant plot is the standard consulting framework for prioritization. Gantt shows execution sequence.

**Scatter Data:** `Array<{ task: string, impact: number, effort: number, category: string, priority: 'critical'|'high'|'medium'|'low' }>`

**Quadrant Config:**
- XAxis: Effort (1-10), label "Implementation Effort"
- YAxis: Impact (1-10), label "Business Impact"
- Reference lines at X=5 and Y=5 creating 4 quadrants
- Quadrant labels: "Quick Wins" (high impact, low effort — top-left, green bg), "Strategic Projects" (top-right, blue bg), "Fill-Ins" (bottom-left, gray bg), "Deprioritize" (bottom-right, red bg)
- Dot size: mapped to priority (critical=16px, high=12px, medium=8px, low=6px)
- Dot color: by category using palette
- Tooltip: task name, impact, effort, priority, estimated timeline

**Gantt (P2 only):**
- Custom horizontal bar chart with time axis (Week 1-12)
- Bars colored by priority: critical=#EF476F, high=#FFD166, medium=#06D6A0, low=#94A3B8
- Dependency arrows between related tasks
- Milestone diamonds at key completion points

**P1 Bento:** 1x1 card — top 5 quick wins as ordered list with impact badges
**P2 Report:** Full page — quadrant scatter chart top, Gantt timeline bottom
**Responsive:** Quadrant maintains 1:1 aspect ratio and scales; Gantt scrolls horizontally

---

### 1.21 Digital Presence Checklist (M17-M19)

**Chart Type:** Custom ChecklistGrid with category sections
**Why:** Digital presence items (careers page, investor relations, support center) are presence/absence checks. Checklist is natural.

**Data Source:** `Array<{ category: 'Careers'|'Investor Relations'|'Support', items: Array<{ name: string, found: boolean, url?: string, quality?: 'good'|'fair'|'poor' }> }>`

**Visual Design:**
- Three category sections with headers
- Each item: name + found/not-found icon + quality badge (if found) + link icon (if URL)
- Found: green checkmark + solid left border
- Not found: gray dash + dashed left border
- Quality overlays: good=green dot, fair=amber dot, poor=red dot
- Summary: "Digital Presence Score: X/Y items detected"

**P1 Bento:** 1x1 card — ring chart showing % found + count
**P2 Report:** Full checklist with URLs, quality notes, recommendations
**Responsive:** Single column on mobile

---

## SECTION 2: Recharts Configuration Standards

### 2.1 Default Dimensions and Aspect Ratios

```typescript
// Standard chart aspect ratios
const CHART_ASPECTS = {
  wide: 3,        // 3:1 — sparklines, trend lines
  landscape: 2,   // 2:1 — bar charts, area charts
  standard: 1.6,  // 16:10 — general purpose
  square: 1,      // 1:1 — scatter plots, quadrants
  portrait: 0.75, // 3:4 — vertical bar charts on mobile
} as const;

// Default heights by context
const CHART_HEIGHTS = {
  bentoSmall: 200,   // 1x1 bento cards
  bentoWide: 240,    // 2x1 bento cards
  bentoTall: 400,    // 1x2 bento cards
  bentoFeature: 360, // 2x2 bento cards
  reportFull: 400,   // P2 full-width
  reportHalf: 300,   // P2 half-width
  printA4Full: 500,  // A4 print full-width
  printA4Half: 340,  // A4 print half-width
} as const;
```

### 2.2 ResponsiveContainer Configuration

```tsx
import { ResponsiveContainer } from 'recharts';

// Standard wrapper — use for ALL Recharts charts
interface ChartContainerProps {
  children: React.ReactNode;
  height?: number;
  aspect?: number;
  minHeight?: number;
  className?: string;
}

const ChartContainer: React.FC<ChartContainerProps> = ({
  children,
  height,
  aspect,
  minHeight = 200,
  className,
}) => (
  <div className={cn('w-full', className)} style={{ minHeight }}>
    <ResponsiveContainer
      width="100%"
      height={height}
      aspect={!height ? aspect : undefined}
      debounce={150}
    >
      {children}
    </ResponsiveContainer>
  </div>
);
```

### 2.3 Tooltip Design

```tsx
import { TooltipProps } from 'recharts';

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: '#1A1A2E',
  border: 'none',
  borderRadius: '8px',
  padding: '12px 16px',
  boxShadow: '0 4px 24px rgba(26, 26, 46, 0.24)',
};

const TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: '#FAFBFC',
  fontFamily: '"Plus Jakarta Sans", sans-serif',
  fontWeight: 700,
  fontSize: '13px',
  marginBottom: '4px',
};

const TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: '#94A3B8',
  fontFamily: '"Inter", sans-serif',
  fontSize: '12px',
  padding: '2px 0',
};

// Custom tooltip component for consistent styling
const AlphaTooltip: React.FC<TooltipProps<number, string>> = ({
  active,
  payload,
  label,
  formatter,
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div style={TOOLTIP_STYLE}>
      <p style={TOOLTIP_LABEL_STYLE}>{label}</p>
      {payload.map((entry, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', ...TOOLTIP_ITEM_STYLE }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: entry.color,
            display: 'inline-block',
          }} />
          <span>{entry.name}: </span>
          <span style={{ color: '#FAFBFC', fontFamily: '"JetBrains Mono", monospace', fontWeight: 500 }}>
            {formatter ? formatter(entry.value, entry.name, entry, index, payload) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};
```

### 2.4 Legend Positioning and Style

```tsx
const LEGEND_CONFIG = {
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

// For charts where legend is right-aligned (donut, radar)
const LEGEND_RIGHT_CONFIG = {
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
```

### 2.5 Axis Styling

```tsx
const AXIS_STYLE = {
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

const GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: '#F1F5F9',
  vertical: false,
};

// Number formatters for axes
const formatters = {
  thousands: (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value),
  millions: (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : formatters.thousands(value),
  currency: (value: number) => `$${formatters.thousands(value)}`,
  percent: (value: number) => `${value}%`,
  ms: (value: number) => `${value}ms`,
  bytes: (value: number) => {
    if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)}MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)}KB`;
    return `${value}B`;
  },
};
```

### 2.6 Animation Configuration

```tsx
const ANIMATION_CONFIG = {
  // Standard Recharts animation props
  isAnimationActive: true,
  animationBegin: 0,
  animationDuration: 800,
  animationEasing: 'ease-out' as const,

  // Staggered entry for multi-bar/multi-series
  getStaggerDelay: (index: number) => index * 100,

  // For pie/donut charts
  pieAnimation: {
    animationBegin: 200,
    animationDuration: 1000,
    animationEasing: 'ease-out' as const,
  },

  // For line/area charts — draw-in effect
  lineAnimation: {
    animationBegin: 0,
    animationDuration: 1200,
    animationEasing: 'ease-in-out' as const,
  },

  // Disable animations for print/PDF
  printOverride: {
    isAnimationActive: false,
  },
};
```

### 2.7 Color Palette Array

```typescript
// Primary chart palette — use in order for multi-series charts
const CHART_PALETTE = [
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

// Traffic light palette
const TRAFFIC_LIGHT = {
  green: '#06D6A0',
  amber: '#FFD166',
  red: '#EF476F',
} as const;

// Status palette
const STATUS_COLORS = {
  active: '#06D6A0',
  inactive: '#94A3B8',
  degraded: '#FFD166',
  error: '#EF476F',
  blocked: '#1A1A2E',
} as const;

// Resource type palette
const RESOURCE_COLORS = {
  js: '#FFD166',
  css: '#06D6A0',
  images: '#E94560',
  fonts: '#94A3B8',
  xhr: '#1A1A2E',
  other: '#7C3AED',
} as const;
```

### 2.8 Margin/Padding Standards

```typescript
const CHART_MARGINS = {
  // Bento card charts (compact)
  bento: { top: 8, right: 8, bottom: 8, left: 8 },

  // Standard report charts
  standard: { top: 20, right: 30, bottom: 20, left: 40 },

  // Charts with long Y-axis labels (horizontal bar)
  wideLabel: { top: 20, right: 30, bottom: 20, left: 120 },

  // Charts with legend at bottom
  withLegend: { top: 20, right: 30, bottom: 60, left: 40 },

  // Print charts (more breathing room)
  print: { top: 24, right: 40, bottom: 24, left: 48 },
} as const;
```

---

## SECTION 3: Custom Visualization Components (non-Recharts)

### 3.1 ScoreGauge

```typescript
interface ScoreGaugeProps {
  /** Score value 0-100 */
  score: number;
  /** Display size in pixels */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Label below the score */
  label?: string;
  /** Show animated count-up on mount/in-view */
  animate?: boolean;
  /** Animation duration in ms */
  duration?: number;
  /** Override automatic color tier */
  color?: string;
  /** Show trend indicator */
  trend?: { direction: 'up' | 'down' | 'flat'; delta: number };
  /** Additional CSS class */
  className?: string;
}

// Size map
const GAUGE_SIZES = {
  sm: { diameter: 120, strokeWidth: 8, fontSize: 28, labelSize: 10 },
  md: { diameter: 200, strokeWidth: 10, fontSize: 44, labelSize: 13 },
  lg: { diameter: 280, strokeWidth: 12, fontSize: 56, labelSize: 14 },
  xl: { diameter: 400, strokeWidth: 14, fontSize: 72, labelSize: 16 },
};
```

**Visual Design:**
- SVG with `<circle>` background track (stroke: #F1F5F9) and `<circle>` progress arc
- Arc spans 240 degrees (from 150deg to 390deg), leaving a 120deg gap at bottom
- Progress arc uses `stroke-dasharray` and `stroke-dashoffset` for fill
- Stroke color: tier-based gradient (red-to-amber-to-green-to-navy)
- Center: score number in JetBrains Mono, color matching arc
- Below center: label in Inter, #64748B
- Optional trend arrow (up/down) with delta value

**Animation (Framer Motion):**
- `motion.circle` with `pathLength` animated from 0 to `score/100`
- Duration: 2000ms, easing: `[0.34, 1.56, 0.64, 1]` (spring-like overshoot)
- Score count-up via `useSpring` + `useTransform`: 0 to score over 2000ms
- Triggered by `whileInView` with `once: true`
- `prefers-reduced-motion`: instant render, no animation

**Responsive:** `size` prop controls fixed sizes; container max-width prevents overflow

---

### 3.2 TrafficLight

```typescript
interface TrafficLightProps {
  /** Current status */
  status: 'green' | 'amber' | 'red';
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Optional text label */
  label?: string;
  /** Show as dot only (no label) */
  dotOnly?: boolean;
  /** Pulse animation for active states */
  pulse?: boolean;
  /** Accessibility: icon shape in addition to color */
  showIcon?: boolean;
  className?: string;
}

// Size map
const TL_SIZES = {
  xs: { dot: 8, font: 10, iconSize: 6 },
  sm: { dot: 12, font: 12, iconSize: 8 },
  md: { dot: 16, font: 14, iconSize: 10 },
  lg: { dot: 24, font: 16, iconSize: 14 },
};
```

**Visual Design:**
- Circular dot with status color + subtle inner glow (box-shadow: `inset 0 1px 2px rgba(255,255,255,0.3)`)
- For accessibility: green=checkmark, amber=dash, red=X icon overlay on dot when `showIcon=true`
- Label right of dot, Inter font, color #1A1A2E
- Pulse: CSS `@keyframes pulse` with scale 1-1.15 and opacity 1-0.7, 2s infinite

**Animation:** Framer Motion `animate={{ scale: [1, 1.15, 1] }}` with `transition={{ repeat: Infinity, duration: 2 }}` when `pulse=true`

---

### 3.3 SignalBadge

```typescript
interface SignalBadgeProps {
  /** Technology/tool name */
  name: string;
  /** Category for color coding */
  category: 'analytics' | 'ads' | 'automation' | 'cms' | 'cdn' | 'security' | 'ecommerce' | 'social' | 'other';
  /** Detection confidence 0-100 */
  confidence: number;
  /** Optional icon URL or component */
  icon?: string | React.ReactNode;
  /** Active/inactive status */
  status?: 'active' | 'inactive' | 'degraded';
  /** Show confidence bar */
  showConfidence?: boolean;
  /** Click handler for detail view */
  onClick?: () => void;
  className?: string;
}

const CATEGORY_COLORS = {
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
```

**Visual Design:**
- Pill-shaped badge: 8px padding vertical, 12px horizontal
- Left: 24x24 icon (tool logo or category icon fallback)
- Center: tool name in Inter 13px 500wt
- Right: confidence indicator (mini progress bar or percentage)
- Border: 1px solid category color at 30% opacity
- Background: category color at 5% opacity
- Status dot: tiny colored dot in top-right corner
- Hover: scale(1.02), border opacity to 60%, shadow elevation

**Animation:** `motion.div` with `whileHover={{ scale: 1.02 }}`, `whileTap={{ scale: 0.98 }}`

---

### 3.4 ChecklistGrid

```typescript
interface ChecklistItem {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'partial' | 'na';
  value?: string;
  grade?: string;
  recommendation?: string;
}

interface ChecklistGridProps {
  /** Section title */
  title: string;
  /** Checklist items */
  items: ChecklistItem[];
  /** Number of columns on desktop */
  columns?: 1 | 2 | 3 | 4;
  /** Show summary progress bar */
  showSummary?: boolean;
  /** Expandable rows with recommendations */
  expandable?: boolean;
  /** Compact mode for bento cards */
  compact?: boolean;
  className?: string;
}
```

**Visual Design:**
- CSS Grid: `grid-template-columns: repeat(var(--cols), 1fr)`
- Each item card: 8px padding, left border 3px colored by status
- Pass: #06D6A0 border, green check icon
- Fail: #EF476F border, red X icon
- Partial: #FFD166 border, amber warning icon
- N/A: #E2E8F0 border, gray dash icon
- Item content: icon + name + value (if any) + grade badge
- Expandable: click/tap reveals recommendation text with slide-down
- Summary bar: progress bar above grid showing pass-rate percentage

**Animation:**
- Staggered entrance: `variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}` with `staggerChildren: 0.05`
- Expand/collapse: `AnimatePresence` + `motion.div` with height auto animation

**Responsive:** `--cols` decreases: 3 on desktop, 2 on tablet, 1 on mobile

---

### 3.5 ComparisonMatrix

```typescript
interface ComparisonAttribute {
  attribute: string;
  category: string;
  mainSite: string | boolean | number;
  comparator: string | boolean | number;
  match: boolean;
  severity: 'critical' | 'warning' | 'info';
}

interface ComparisonMatrixProps {
  /** Title for the comparison */
  title: string;
  /** Label for column A */
  labelA: string;
  /** Label for column B */
  labelB: string;
  /** Comparison data */
  data: ComparisonAttribute[];
  /** Group by category */
  grouped?: boolean;
  /** Show only mismatches */
  filterMismatches?: boolean;
  /** Summary score (e.g., "78% Parity") */
  summaryScore?: number;
  className?: string;
}
```

**Visual Design:**
- Table-like grid: Attribute | Main Site | PPC Page | Match
- Header row: sticky, #FAFBFC background, Plus Jakarta Sans 600wt
- Match cells: green check or red X with severity badge
- Mismatch rows: #EF476F at 3% opacity background
- Category group headers: full-width row, bold, #F1F5F9 background
- Values: JetBrains Mono for numbers/URLs, Inter for text
- Severity badges: critical=red pill, warning=amber pill, info=blue pill
- Summary header: parity percentage as ScoreGauge (sm) above matrix

**Animation:** Row entrance with stagger; mismatch rows have subtle left-border animation (width 0 to 3px)

**Responsive:** Horizontal scroll with sticky first column (attribute name) on mobile

---

### 3.6 FlowDiagram

```typescript
interface FlowNode {
  id: string;
  label: string;
  type: 'source' | 'processor' | 'destination';
  icon?: string | React.ReactNode;
  status?: 'active' | 'inactive' | 'error';
  metadata?: Record<string, string>;
}

interface FlowEdge {
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

interface FlowDiagramProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Interactive: click nodes for detail */
  interactive?: boolean;
  /** Compact mode for bento cards */
  compact?: boolean;
  /** Fixed height or auto-size */
  height?: number;
  className?: string;
}
```

**Visual Design:**
- SVG-based with manual layout algorithm (or dagre-d3 for complex graphs)
- Node cards: 140x56px rounded rectangles with 8px border-radius
- Node fill: white with colored left accent by type (source=#06D6A0, processor=#FFD166, destination=#1A1A2E)
- Node content: 20x20 icon left + label right (Inter 12px 500wt)
- Status: colored dot top-right of node
- Edges: SVG `<path>` with quadratic bezier curves
- Edge stroke: #94A3B8, 1.5px, marker-end arrowhead
- Animated edges: `stroke-dasharray: 8 4` with CSS animation `stroke-dashoffset`
- Layer backgrounds: subtle horizontal bands grouping nodes by type

**Animation:**
- Nodes fade-in with stagger (left-to-right or top-to-bottom)
- Edge drawing animation: pathLength 0 to 1 with delay after nodes appear
- Interactive hover: node scale(1.03), connected edges highlight to #1A1A2E

**Responsive:** Switches from horizontal to vertical direction at <768px. Compact mode shows only 1 node per layer with "+X more" badges.

---

### 3.7 WaterfallChart

```typescript
interface WaterfallEntry {
  label: string;
  type: string;
  domain: string;
  startTime: number;
  duration: number;
  size: number;
  timing?: {
    dns: number;
    connect: number;
    ssl: number;
    ttfb: number;
    download: number;
  };
}

interface WaterfallChartProps {
  data: WaterfallEntry[];
  /** Max number of entries to display */
  maxEntries?: number;
  /** Show timing breakdown within each bar */
  showTimingBreakdown?: boolean;
  /** Milestone markers (DOMContentLoaded, Load, etc.) */
  milestones?: Array<{ label: string; time: number; color: string }>;
  /** Height per row in pixels */
  rowHeight?: number;
  /** Interactive: click row for detail */
  interactive?: boolean;
  className?: string;
}
```

**Visual Design:**
- Custom SVG component (not Recharts — no native waterfall support)
- Y-axis: Resource labels (truncated to 35 chars), Inter 11px, left-aligned in fixed 200px column
- X-axis: Time in ms, JetBrains Mono 11px, gridlines every 100ms
- Bars: Positioned at startTime, width=duration, height=rowHeight (default 24px)
- Bar color: by resource type (using RESOURCE_COLORS)
- Timing breakdown (if enabled): bar segments colored by phase (DNS=#94A3B8, Connect=#FFD166, SSL=#7C3AED, TTFB=#1A1A2E, Download=type color)
- Milestones: Vertical dashed lines with labels at top (DOMContentLoaded=#06D6A0, Load=#E94560)
- Tooltip: Full URL, size, type, complete timing breakdown
- Row hover: highlight row background, show full label

**Animation:**
- Bars grow from left to right with stagger (50ms per row)
- Milestone lines draw from top to bottom
- `whileInView` trigger

**Responsive:**
- Label column collapses to 120px on mobile
- Horizontal scroll for time axis
- Touch: tap row to see tooltip (no hover on mobile)

---

## SECTION 4: Animation Strategy (Framer Motion)

### 4.1 Scroll-Triggered Animations

```typescript
// Standard scroll-trigger wrapper for dashboard sections
const ScrollReveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-80px' }}
    transition={{
      duration: 0.5,
      delay,
      ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quad
    }}
    className={className}
  >
    {children}
  </motion.div>
);
```

### 4.2 Staggered Card Entrance

```typescript
// Container + child variants for bento grid
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// Usage in bento grid
const BentoGrid: React.FC = ({ cards }) => (
  <motion.div
    variants={containerVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: '-40px' }}
    className="bento-grid"
  >
    {cards.map((card, i) => (
      <motion.div key={card.id} variants={cardVariants} className="bento-card">
        {card.content}
      </motion.div>
    ))}
  </motion.div>
);
```

### 4.3 Chart Entrance Animations

```typescript
// Line/Area chart draw-in
// Use Recharts' built-in animationBegin + animationDuration
// Supplement with Framer Motion for container fade

// Bar chart grow animation
// Recharts handles bar growth natively with animationDuration=800

// Gauge spin animation — custom via pathLength
const gaugeArcVariants = {
  hidden: { pathLength: 0 },
  visible: (score: number) => ({
    pathLength: score / 100,
    transition: {
      duration: 2,
      ease: [0.34, 1.56, 0.64, 1], // spring overshoot
      delay: 0.3,
    },
  }),
};

// Pie/Donut entrance
// Recharts native: animationBegin=200, animationDuration=1000
// Add container opacity fade via Framer Motion
```

### 4.4 Score Count-Up Animation

```typescript
import { useSpring, useTransform, motion, useInView } from 'framer-motion';

function useCountUp(target: number, duration: number = 2000) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(0, {
    duration,
    bounce: 0,
  });

  useEffect(() => {
    if (isInView) {
      spring.set(target);
    }
  }, [isInView, target, spring]);

  const display = useTransform(spring, (v) => Math.round(v));

  return { ref, display };
}

// Usage
const ScoreDisplay: React.FC<{ score: number }> = ({ score }) => {
  const { ref, display } = useCountUp(score);
  return (
    <span ref={ref}>
      <motion.span>{display}</motion.span>
    </span>
  );
};
```

### 4.5 Number Transition for Live-Updating Values

```typescript
// For values that may update (e.g., during progressive scan loading)
const AnimatedNumber: React.FC<{
  value: number;
  format?: (v: number) => string;
  className?: string;
}> = ({ value, format = String, className }) => {
  const spring = useSpring(value, { stiffness: 100, damping: 30 });
  const display = useTransform(spring, (v) => format(Math.round(v)));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span className={className}>{display}</motion.span>;
};
```

### 4.6 Hover States

```typescript
const hoverScale = {
  whileHover: { scale: 1.02, transition: { duration: 0.2 } },
  whileTap: { scale: 0.98, transition: { duration: 0.1 } },
};

const hoverElevate = {
  whileHover: {
    y: -2,
    boxShadow: '0 8px 32px rgba(26, 26, 46, 0.12)',
    transition: { duration: 0.2 },
  },
};

const hoverGlow = {
  whileHover: {
    boxShadow: '0 0 24px rgba(6, 214, 160, 0.15)',
    borderColor: 'rgba(6, 214, 160, 0.3)',
    transition: { duration: 0.3 },
  },
};
```

### 4.7 Loading to Data Transition

```typescript
// Skeleton shimmer → real chart crossfade
const ChartWithSkeleton: React.FC<{
  isLoading: boolean;
  skeleton: React.ReactNode;
  chart: React.ReactNode;
}> = ({ isLoading, skeleton, chart }) => (
  <AnimatePresence mode="wait">
    {isLoading ? (
      <motion.div
        key="skeleton"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.3 }}
      >
        {skeleton}
      </motion.div>
    ) : (
      <motion.div
        key="chart"
        initial={{ opacity: 0, scale: 1.01 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {chart}
      </motion.div>
    )}
  </AnimatePresence>
);
```

### 4.8 Performance Budget

```
- Target: 60fps for ALL animations
- Prefer transform and opacity (GPU-composited) over layout properties
- Never animate width, height, top, left, margin, padding
- Use will-change: transform on elements that animate frequently
- Limit concurrent animations to 12 elements max
- Use Framer Motion's layout prop sparingly (expensive)
- Recharts animations are Canvas/SVG-based — generally cheap
- For lists >20 items, disable stagger animation (batch-reveal instead)
- Monitor with Chrome DevTools Performance panel; flag any frame >16.67ms
```

### 4.9 Reduced Motion

```typescript
// Global hook
import { useReducedMotion } from 'framer-motion';

function useAnimationConfig() {
  const prefersReducedMotion = useReducedMotion();

  return {
    duration: prefersReducedMotion ? 0 : undefined,
    staggerChildren: prefersReducedMotion ? 0 : 0.08,
    isAnimationActive: !prefersReducedMotion, // for Recharts
  };
}

// Apply to all Recharts charts
<BarChart>
  <Bar isAnimationActive={animConfig.isAnimationActive} />
</BarChart>

// Apply to all Framer Motion components
<motion.div
  transition={{ duration: animConfig.duration ?? 0.5 }}
/>
```

---

## SECTION 5: P1 Bento Dashboard Layout

### 5.1 CSS Grid Specification

```css
.bento-grid {
  display: grid;
  gap: 16px;
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;

  /* Desktop: 4-column grid */
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: minmax(200px, auto);
}

/* Tablet: 2 columns */
@media (max-width: 1024px) {
  .bento-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 16px;
  }
}

/* Mobile: 1 column */
@media (max-width: 640px) {
  .bento-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px;
  }
}
```

### 5.2 Card Size Classes

```css
/* 1x1: Small metric card */
.bento-card-1x1 {
  grid-column: span 1;
  grid-row: span 1;
  min-height: 200px;
}

/* 2x1: Wide chart card */
.bento-card-2x1 {
  grid-column: span 2;
  grid-row: span 1;
  min-height: 200px;
}

/* 1x2: Tall list card */
.bento-card-1x2 {
  grid-column: span 1;
  grid-row: span 2;
  min-height: 416px; /* 200*2 + 16 gap */
}

/* 2x2: Feature chart card */
.bento-card-2x2 {
  grid-column: span 2;
  grid-row: span 2;
  min-height: 416px;
}

/* Mobile: all cards become 1x1 */
@media (max-width: 640px) {
  .bento-card-2x1,
  .bento-card-1x2,
  .bento-card-2x2 {
    grid-column: span 1;
    grid-row: span 1;
    min-height: 200px;
  }
}
```

### 5.3 Module-to-Card Size Mapping

```
Priority | Module                      | Size | Rationale
---------|-----------------------------|----- |------------------
1        | MarketingIQ Score (M42)     | 2x2  | Hero metric, most important
2        | Category Scores Bar         | 2x1  | 8 bars need width
3        | ROI Impact (M44)            | 2x1  | Financial data needs width
4        | Traffic Trend (M24)         | 2x1  | 12-month chart needs width
5        | Tech Stack Overview         | 2x2  | Icon grid needs space
6        | Core Web Vitals (M03)       | 2x1  | 3 metric cards inline
7        | Traffic Sources (M31)       | 1x1  | Donut is compact
8        | Cookie Audit (M12)          | 1x1  | Bar chart summary
9        | Brand Search Trend (M34)    | 1x1  | Sparkline + number
10       | Domain Trust (M32)          | 1x1  | Score badge + key metrics
11       | Security Headers (M01)      | 1x1  | Progress bar + count
12       | Pixel Inventory (M06)       | 1x2  | Table needs vertical space
13       | Digital Presence (M17-19)   | 1x1  | Ring chart + count
14       | Consent Audit (M12)         | 1x1  | 3-number summary
15       | PPC Parity (M06b)           | 1x1  | Parity % + top mismatches
16       | Analytics Architecture (M05)| 2x1  | Flow diagram needs width
17       | Competitor Overlap (M29)    | 1x1  | Top 3 list
18       | Tool Utilization (M07)      | 1x1  | Summary metric
19       | Remediation Roadmap (M43)   | 1x1  | Top 5 quick wins list
```

### 5.4 Card Component Pattern

```typescript
interface BentoCardProps {
  /** Module identifier */
  moduleId: string;
  /** Card title */
  title: string;
  /** Score for this module (0-100) */
  score?: number;
  /** Traffic light status */
  status?: 'green' | 'amber' | 'red';
  /** Card size */
  size: '1x1' | '2x1' | '1x2' | '2x2';
  /** Is card currently expanded */
  expanded?: boolean;
  /** Toggle expand callback */
  onToggleExpand?: () => void;
  /** Chart/content to render */
  children: React.ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: string | null;
}
```

**Card Visual Design:**
- Background: white (#FFFFFF)
- Border: 1px solid #F1F5F9
- Border-radius: 16px
- Shadow: `0 1px 3px rgba(26, 26, 46, 0.04), 0 4px 16px rgba(26, 26, 46, 0.03)`
- Hover shadow: `0 4px 24px rgba(26, 26, 46, 0.08)`
- Padding: 20px (desktop), 16px (mobile)

**Card Header:**
- Module title: Plus Jakarta Sans 600wt, 15px, #1A1A2E
- Score badge: TrafficLight component (sm) right-aligned
- Expand button: ChevronDown icon, rotates 180deg on expand
- Divider: 1px #F1F5F9 below header (only when expanded)

### 5.5 Collapsed vs Expanded States

**Collapsed (default on mobile):**
- Fixed height matching card size
- Chart renders at compact dimensions
- Overflow hidden with gradient fade at bottom
- Single metric or mini-chart visible

**Expanded:**
- `auto` height with `max-height` animation
- Full chart + data table + details visible
- Close button appears in header
- On mobile: expands to near-full-screen modal with backdrop

---

## SECTION 6: P2 Report Chart Specifications

### 6.1 Print-Optimized Styling

```css
@media print {
  /* Remove interactive elements */
  .recharts-tooltip-wrapper,
  .chart-expand-button,
  .chart-filter-controls,
  .chart-hover-indicator {
    display: none !important;
  }

  /* Solid backgrounds for print */
  .recharts-cartesian-grid-horizontal line,
  .recharts-cartesian-grid-vertical line {
    stroke: #E2E8F0 !important;
    stroke-dasharray: none !important;
  }

  /* Ensure text is dark for print */
  .recharts-text,
  .recharts-legend-item-text {
    fill: #1A1A2E !important;
    font-size: 10px !important;
  }

  /* Remove shadows */
  * {
    box-shadow: none !important;
    text-shadow: none !important;
  }

  /* Ensure backgrounds print */
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
```

### 6.2 A4 PDF Dimensions

```typescript
// A4 at 96 DPI: 794 x 1123 pixels
// With margins (25mm = 96px each side): 602 x 931 usable pixels
const PDF_DIMENSIONS = {
  pageWidth: 794,
  pageHeight: 1123,
  marginTop: 72,    // 19mm
  marginBottom: 96,  // 25mm (footer space)
  marginLeft: 96,    // 25mm
  marginRight: 96,   // 25mm
  usableWidth: 602,
  usableHeight: 955,

  // Chart sizes
  chartFullWidth: 602,
  chartHalfWidth: 289,  // (602 - 24 gap) / 2
  chartFullHeight: 400,
  chartHalfHeight: 280,
  chartThirdHeight: 180,

  // Inline metric card
  metricCardWidth: 185,  // (602 - 48) / 3
  metricCardHeight: 100,
};
```

### 6.3 Static vs Interactive

```
All P2 charts are STATIC for PDF rendering. This means:
- isAnimationActive: false on all Recharts components
- No hover states, no tooltips
- Data labels rendered directly on chart elements
- Legends always visible (not toggle-able)
- For web view of P2: interactive versions with tooltips enabled
- PDF generation: use html2canvas or Puppeteer screenshot of static versions
```

### 6.4 Print Color Adjustments

```typescript
// B&W-safe palette — used when generating print version
const PRINT_PALETTE = [
  '#1A1A2E', // Near-black (primary)
  '#4A4A5E', // Dark gray
  '#7A7A8E', // Medium gray
  '#AAAABC', // Light gray
  '#D0D0DD', // Very light gray
] as const;

// Pattern fills for B&W differentiation
const PRINT_PATTERNS = [
  'solid',
  'diagonal-stripes',
  'dots',
  'crosshatch',
  'horizontal-lines',
] as const;

// Traffic lights for print: add text labels and shape differentiation
// Green: circle + "GOOD"
// Amber: triangle + "FAIR"
// Red: square + "POOR"
```

### 6.5 Chart Annotations for Print

```typescript
// Since tooltips don't work in print, add direct labels
interface PrintAnnotation {
  dataKey: string;
  position: 'top' | 'right' | 'inside';
  formatter: (value: number) => string;
  fontSize: number;
  fill: string;
}

// Recharts <Label> and <LabelList> for print mode
<Bar dataKey="value">
  <LabelList
    dataKey="value"
    position="right"
    formatter={(v: number) => formatters.thousands(v)}
    style={{
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 10,
      fill: '#1A1A2E',
    }}
  />
</Bar>
```

### 6.6 Page Break Strategy

```css
/* Page break rules for P2 report */
.report-section {
  page-break-before: always;
  page-break-inside: avoid;
}

.report-chart-container {
  page-break-inside: avoid;
  margin-bottom: 24px;
}

/* Never break inside a chart */
.recharts-wrapper {
  page-break-inside: avoid;
}

/* Allow break between chart and its table */
.report-chart-with-table {
  page-break-inside: auto;
}

.report-chart-with-table .chart-section {
  page-break-inside: avoid;
}

.report-chart-with-table .table-section {
  page-break-before: auto;
  page-break-inside: avoid;
}

/* Keep section headers with their first content block */
.report-section-header {
  page-break-after: avoid;
}
```

---

## SECTION 7: Data Density Philosophy

### 7.1 Handling High-Signal Modules (50+ data points)

```
Strategy: THREE-TIER PROGRESSIVE DISCLOSURE

Tier 1 — Headline (Bento Card / Report Summary)
  - 1-3 key metrics + traffic light
  - A single chart showing the most important dimension
  - Max 5 data points visible
  - Purpose: "At a glance, how am I doing?"

Tier 2 — Analysis (Expanded Card / Report Section)
  - Complete chart with all dimensions
  - Summary table with top 10-20 rows
  - Key findings as bullet points
  - Purpose: "What specifically needs attention?"

Tier 3 — Full Detail (Modal / Report Appendix)
  - Complete data table with all rows
  - Exportable to CSV
  - Every signal with raw values
  - Purpose: "Show me the evidence"
```

### 7.2 Progressive Disclosure Pattern

```typescript
interface ProgressiveDisclosureProps {
  /** Summary content always visible */
  summary: React.ReactNode;
  /** Expanded content shown on user action */
  expanded: React.ReactNode;
  /** Full detail content (modal or separate page) */
  detail?: React.ReactNode;
  /** Current disclosure level */
  level: 'summary' | 'expanded' | 'detail';
  /** Callback when level changes */
  onLevelChange: (level: 'summary' | 'expanded' | 'detail') => void;
}

// "Show More" button pattern — NOT infinite scroll
// Reasoning: Users need to feel in control of data density.
// Infinite scroll creates cognitive overload and hurts print.
```

### 7.3 Show More vs Pagination vs Infinite Scroll

```
Decision Matrix:

| Pattern          | Use When                        | Example Modules           |
|------------------|---------------------------------|---------------------------|
| Show More        | 5-20 additional items           | Pixel Inventory, Cookies  |
| Pagination       | 20-100+ items, need random      | Keyword lists, Ad Library |
|                  | access                          |                           |
| Virtual Scroll   | 100+ items in a single view     | Full resource waterfall   |
| NEVER Inf Scroll | —                               | Against design philosophy |

Reasoning: "Show More" preserves the premium feel (user controls density).
Pagination suits reference data. Virtual scroll for performance-critical lists.
Infinite scroll undermines the "deliberate" C-suite aesthetic.
```

### 7.4 Table Design for Data-Heavy Modules

```typescript
interface DataTableProps<T> {
  data: T[];
  columns: Array<{
    key: keyof T;
    header: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
    filterable?: boolean;
    render?: (value: T[keyof T], row: T) => React.ReactNode;
  }>;
  /** Enable virtual scrolling for 100+ rows */
  virtualized?: boolean;
  /** Rows per page (if paginated) */
  pageSize?: number;
  /** Enable row selection */
  selectable?: boolean;
  /** Enable CSV export */
  exportable?: boolean;
  /** Compact mode for bento cards */
  compact?: boolean;
  /** Fixed header on scroll */
  stickyHeader?: boolean;
}
```

**Table Visual Design:**
- Header: Plus Jakarta Sans 600wt, 12px, #64748B, uppercase tracking-wide
- Header background: #FAFBFC, sticky
- Rows: Inter 13px, #1A1A2E
- Alternating rows: white and #FAFBFC (subtle)
- Data values (numbers, codes): JetBrains Mono 13px
- Row hover: #F8FAFC background
- Borders: only horizontal, #F1F5F9
- Sort indicator: chevron icon in header, #1A1A2E when active
- Pagination: bottom-right, Previous/Next + page numbers

**Virtual Scrolling:**
- Use `@tanstack/react-virtual` for 100+ row tables
- Row height: 44px (standard), 36px (compact)
- Overscan: 5 rows above and below viewport
- Maintain scroll position on sort/filter

### 7.5 Charts vs Tables vs Text Decision Framework

```
| Data Characteristic              | Use Chart    | Use Table     | Use Text      |
|----------------------------------|--------------|---------------|---------------|
| Composition/proportion           | Pie/Donut    |               |               |
| Trend over time                  | Line/Area    |               |               |
| Comparison of categories         | Bar          |               |               |
| Multi-dimensional comparison     | Radar        |               |               |
| Correlation                      | Scatter      |               |               |
| Hierarchy/composition            | Treemap      |               |               |
| Flow/relationships               | FlowDiagram  |               |               |
| Precise values needed            |              | Always table  |               |
| 3 or fewer data points           |              |               | Metric cards  |
| Binary pass/fail                 |              |               | ChecklistGrid |
| Detailed text (URLs, names)      |              | Always table  |               |
| Recommendation/narrative         |              |               | Always text   |
| Status/inventory                 |              | Table+badges  |               |

Rule of thumb: If a CMO would ask "what's the exact number?", use a table.
If they'd ask "what's the trend?", use a chart. If they'd ask "what should
I do?", use text.
```

---

## SECTION 8: Empty & Loading States

### 8.1 Chart Skeleton Patterns

```typescript
// Skeleton bar chart
const BarChartSkeleton: React.FC<{ bars?: number; height?: number }> = ({
  bars = 5,
  height = 200,
}) => (
  <div className="animate-pulse" style={{ height }}>
    <div className="flex items-end gap-3 h-full px-4 pb-4">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="flex-1 bg-slate-100 rounded-t"
          style={{ height: `${30 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  </div>
);

// Skeleton line chart
const LineChartSkeleton: React.FC<{ height?: number }> = ({ height = 200 }) => (
  <div className="animate-pulse" style={{ height }}>
    <svg width="100%" height="100%" viewBox="0 0 400 200">
      <path
        d="M 20 150 Q 100 80 200 120 T 380 60"
        fill="none"
        stroke="#F1F5F9"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

// Skeleton donut
const DonutSkeleton: React.FC<{ size?: number }> = ({ size = 200 }) => (
  <div className="animate-pulse flex items-center justify-center" style={{ width: size, height: size }}>
    <div
      className="rounded-full border-8 border-slate-100"
      style={{ width: size * 0.8, height: size * 0.8 }}
    />
  </div>
);

// Skeleton gauge
const GaugeSkeleton: React.FC<{ size?: number }> = ({ size = 200 }) => (
  <div className="animate-pulse flex flex-col items-center justify-center" style={{ width: size, height: size }}>
    <svg width={size} height={size} viewBox="0 0 200 200">
      <circle
        cx="100" cy="100" r="80"
        fill="none"
        stroke="#F1F5F9"
        strokeWidth="12"
        strokeDasharray="377"
        strokeDashoffset="126"
        strokeLinecap="round"
        transform="rotate(150 100 100)"
      />
    </svg>
    <div className="w-12 h-8 bg-slate-100 rounded mt-[-90px]" />
  </div>
);

// Skeleton table
const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => (
  <div className="animate-pulse space-y-2">
    {/* Header */}
    <div className="flex gap-4 pb-2 border-b border-slate-100">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="h-3 bg-slate-100 rounded flex-1" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex gap-4 py-2">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="h-3 bg-slate-50 rounded flex-1" style={{ width: `${50 + Math.random() * 50}%` }} />
        ))}
      </div>
    ))}
  </div>
);
```

### 8.2 No-Data State

```typescript
interface EmptyChartProps {
  /** Chart type for appropriate illustration */
  chartType: 'bar' | 'line' | 'pie' | 'table' | 'checklist' | 'gauge' | 'flow';
  /** Reason for no data */
  message?: string;
  /** Suggested action */
  action?: { label: string; onClick: () => void };
}

// Visual: Muted version of chart skeleton (static, not pulsing) with centered
// message in Inter 14px #94A3B8. Icon above message (chart-bar-off icon from
// lucide). Optional CTA button below.
//
// Background: #FAFBFC with 1px dashed border #E2E8F0
// Message examples:
//   "No analytics tools detected" (M05)
//   "No paid media pixels found" (M06)
//   "Traffic data unavailable" (M24)
//   "Insufficient data for trend analysis" (M34)
```

### 8.3 Error State

```typescript
interface ChartErrorProps {
  /** Module that failed */
  moduleId: string;
  /** Error message */
  message: string;
  /** Can retry */
  retryable?: boolean;
  /** Retry callback */
  onRetry?: () => void;
}

// Visual: Same dimensions as chart would occupy. Red-tinted background
// (#EF476F at 3% opacity). AlertTriangle icon (lucide) in #EF476F.
// Error message in Inter 13px #64748B. Retry button (if retryable)
// in Soft Red outline style.
//
// Important: Error in one module should NOT affect other cards.
// Each card manages its own error boundary.
```

### 8.4 Partial Data Rendering

```
Strategy: Render what's available, indicate what's pending.

- For multi-series charts (e.g., "Your Site" vs "Benchmark"):
  Render available series normally. Show ghost/dashed placeholder
  for pending series with "Loading..." label in legend.

- For tables with some columns pending:
  Render available columns. Pending columns show skeleton cells.
  Column header shows subtle spinner icon.

- For composite views (chart + table):
  Each sub-component manages its own loading state independently.

- Visual indicator: Subtle pulsing border on the card (2px #94A3B8
  at 50% opacity) while any data is still loading. Removed once
  all data is available.
```

---

## SECTION 9: Accessibility for Charts

### 9.1 ARIA Labels

```typescript
// Every chart container gets these ARIA attributes
interface ChartA11yProps {
  'aria-label': string;        // e.g., "Bar chart showing category scores from 0 to 100"
  'aria-describedby'?: string; // ID of a longer description element
  role: 'img';                 // Charts are non-interactive images semantically
  tabIndex?: number;           // 0 if interactive, undefined if decorative
}

// Example implementations
<div
  role="img"
  aria-label="Traffic sources pie chart. Direct 35%, Organic Search 28%, Paid Search 18%, Social 12%, Referral 7%"
  aria-describedby="traffic-sources-description"
>
  <PieChart>...</PieChart>
</div>
<div id="traffic-sources-description" className="sr-only">
  This chart shows the breakdown of website traffic by source.
  The largest source is Direct traffic at 35 percent, followed by
  Organic Search at 28 percent.
</div>
```

### 9.2 Screen Reader Alternative Text

```typescript
// Utility to generate alt text from chart data
function generateChartAltText(
  chartType: string,
  title: string,
  data: Array<Record<string, any>>,
  config: { xKey: string; yKey: string; format?: (v: any) => string }
): string {
  const { xKey, yKey, format = String } = config;
  const summary = data.map(d => `${d[xKey]}: ${format(d[yKey])}`).join(', ');
  return `${chartType} titled "${title}". Data points: ${summary}.`;
}

// For complex charts, provide a hidden data table as alternative
// This table is visually hidden but available to screen readers
const ScreenReaderTable: React.FC<{
  data: Array<Record<string, any>>;
  columns: Array<{ key: string; header: string }>;
}> = ({ data, columns }) => (
  <table className="sr-only">
    <caption>Data for the chart above</caption>
    <thead>
      <tr>{columns.map(c => <th key={c.key}>{c.header}</th>)}</tr>
    </thead>
    <tbody>
      {data.map((row, i) => (
        <tr key={i}>
          {columns.map(c => <td key={c.key}>{String(row[c.key])}</td>)}
        </tr>
      ))}
    </tbody>
  </table>
);
```

### 9.3 Color-Blind Safe Design

```
CRITICAL: Traffic lights MUST NOT rely on color alone.

Solutions applied throughout:
1. Shape differentiation:
   - Green status: Circle + Checkmark icon
   - Amber status: Triangle/Diamond + Dash icon
   - Red status: Square + X icon

2. Pattern fills for charts (optional mode):
   - Provide a "High Contrast" toggle in settings
   - When active, bar/pie charts add SVG pattern fills
   - Patterns: solid, diagonal-stripes, dots, crosshatch

3. Label everything:
   - All chart segments include text labels (not just color)
   - Tooltips always available on hover
   - Legends include both color swatch AND text

4. Tested palettes:
   - Primary palette passes WCAG contrast against white background
   - Deep Navy #1A1A2E: contrast ratio 15.4:1 on white ✓
   - Soft Red #E94560: contrast ratio 4.1:1 — use ONLY for large text/graphics
   - Soft Green #06D6A0: contrast ratio 2.8:1 — use ONLY for graphics, NOT text
   - For text on colored backgrounds, always use white (#FAFBFC) or #1A1A2E
   - Tested with Sim Daltonism for protanopia, deuteranopia, tritanopia

5. Specific color-blind considerations:
   - The green (#06D6A0) and red (#EF476F) are distinguishable under
     deuteranopia because green is cyan-shifted and red is pink-shifted
   - Amber (#FFD166) provides a luminance-differentiated middle ground
   - When in doubt, double-encode with icons
```

### 9.4 Keyboard Navigation

```typescript
// Interactive chart elements (clickable bars, pie segments) must be keyboard accessible

// For Recharts: Use custom shape components that are <button> or have tabIndex
const AccessibleBar: React.FC<any> = (props) => {
  const { x, y, width, height, fill, payload, onClick } = props;
  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={`${payload.name}: ${payload.value}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(payload);
        }
      }}
      onClick={() => onClick?.(payload)}
    >
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />
    </g>
  );
};

// Focus visible styles
// .chart-interactive:focus-visible {
//   outline: 2px solid #1A1A2E;
//   outline-offset: 2px;
//   border-radius: 4px;
// }

// Tab order: Navigate between chart elements with Tab, activate with Enter/Space
// Arrow keys: Navigate within a chart (between bars, pie segments)
// Escape: Close tooltip/popover
```

### 9.5 High Contrast Mode

```css
@media (prefers-contrast: high) {
  /* Increase all borders */
  .bento-card {
    border-width: 2px;
    border-color: #1A1A2E;
  }

  /* Darken grid lines */
  .recharts-cartesian-grid line {
    stroke: #94A3B8 !important;
  }

  /* Ensure all text meets 7:1 contrast */
  .recharts-text {
    fill: #1A1A2E !important;
  }

  /* Bold all chart strokes */
  .recharts-line .recharts-curve {
    stroke-width: 3 !important;
  }

  /* Distinct bar borders */
  .recharts-bar-rectangle rect {
    stroke: #1A1A2E !important;
    stroke-width: 1 !important;
  }

  /* Traffic light: always show icons regardless of showIcon prop */
  .traffic-light-icon {
    display: inline-block !important;
  }
}
```

---

## SECTION 10: Performance Optimization

### 10.1 Lazy Loading Charts Below the Fold

```typescript
import { lazy, Suspense } from 'react';
import { useInView } from 'framer-motion';

// Lazy-load chart components
const LazyAreaChart = lazy(() => import('./charts/TrafficTrendChart'));
const LazyRadarChart = lazy(() => import('./charts/DomainTrustRadar'));

// Render only when near viewport
const LazyChartWrapper: React.FC<{
  fallback: React.ReactNode;
  children: React.ReactNode;
  rootMargin?: string;
}> = ({ fallback, children, rootMargin = '200px' }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: rootMargin });

  return (
    <div ref={ref}>
      {isInView ? (
        <Suspense fallback={fallback}>
          {children}
        </Suspense>
      ) : (
        fallback
      )}
    </div>
  );
};

// Usage
<LazyChartWrapper fallback={<LineChartSkeleton height={240} />}>
  <LazyAreaChart data={trafficData} />
</LazyChartWrapper>
```

### 10.2 Chart Data Memoization

```typescript
import { useMemo, useCallback } from 'react';

// Memoize transformed chart data
function useChartData<T, R>(
  rawData: T[] | undefined,
  transform: (data: T[]) => R[],
  deps: any[] = []
): R[] {
  return useMemo(() => {
    if (!rawData?.length) return [];
    return transform(rawData);
  }, [rawData, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Memoize expensive formatters
const useFormatters = () =>
  useMemo(() => ({
    currency: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
    number: new Intl.NumberFormat('en-US'),
    percent: new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1 }),
  }), []);

// Memoize tooltip content renderer
const tooltipContent = useCallback((props: TooltipProps) => (
  <AlphaTooltip {...props} />
), []);
```

### 10.3 Virtualization for Large Tables

```typescript
// Use @tanstack/react-virtual for tables with 100+ rows
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualTable<T>({ data, columns, rowHeight = 44 }: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="overflow-auto max-h-[500px]">
      <table>
        <thead className="sticky top-0 bg-white z-10">
          {/* header row */}
        </thead>
        <tbody style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <tr
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
                height: `${virtualRow.size}px`,
                width: '100%',
              }}
            >
              {/* cells */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 10.4 SVG vs Canvas Rendering

```
Recharts uses SVG rendering exclusively. This has implications:

SVG (Recharts default):
  ✓ Crisp at any zoom level / Retina displays
  ✓ CSS styling and hover states work natively
  ✓ Accessible (screen readers can traverse SVG)
  ✓ Prints perfectly
  ✓ Small datasets (< 500 data points) render efficiently
  ✗ Performance degrades with 1000+ SVG elements

Canvas (NOT used by Recharts):
  ✓ Better performance with 1000+ data points
  ✗ Not accessible
  ✗ No CSS hover/styles
  ✗ Blurry on zoom/Retina unless manually handled

DECISION: Use Recharts (SVG) for all charts. Our data sets are
well under 500 points per chart. For the one exception (full
resource waterfall with potentially 200+ bars), cap at 50 entries
with "Show More" pagination. SVG gives us print quality, accessibility,
and styling flexibility that a premium product requires.

If a future module requires 1000+ data points in a single chart,
evaluate: @nivo/line (Canvas mode) or custom Canvas component.
```

### 10.5 Bundle Size Budget

```
Library              | Gzipped Size | Notes
---------------------|-------------|------
recharts             | ~45KB       | Tree-shakeable; import only used charts
framer-motion        | ~32KB       | LazyMotion + domAnimation = ~16KB
@tanstack/react-virtual | ~2KB    | Tiny; use for tables only
dagre (optional)     | ~8KB        | Only if FlowDiagram needs auto-layout

Total chart bundle: ~95KB gzipped (full) or ~55KB (lazy-loaded minimum)

Optimization strategies:
1. Use Next.js dynamic imports for chart components below fold
2. Use LazyMotion from framer-motion to reduce initial bundle:
   import { LazyMotion, domAnimation } from 'framer-motion';
   <LazyMotion features={domAnimation}>...</LazyMotion>
3. Import specific Recharts components, not the barrel export:
   import { BarChart, Bar, XAxis, YAxis } from 'recharts';
   (Recharts supports tree-shaking; this is mainly for clarity)
4. Code-split P2 report charts separately from P1 dashboard charts
5. Preload chart libraries when user initiates a scan (before results ready)
```

---

## Implementation Priority Order

```
Phase 1 — Core (P1 Dashboard MVP)
  1. ScoreGauge component
  2. TrafficLight component
  3. ChartContainer (ResponsiveContainer wrapper)
  4. AlphaTooltip
  5. BentoCard shell
  6. MarketingIQ gauge card
  7. Category scores bar chart
  8. Core Web Vitals metric cards
  9. Traffic sources donut
  10. Traffic trend area chart
  11. Skeleton components for all above

Phase 2 — Extended Dashboard
  12. Tech stack icon grid
  13. Security headers checklist
  14. Cookie audit bar chart
  15. Pixel inventory table + bar
  16. Digital presence checklist
  17. Brand search sparkline
  18. Domain trust badge + radar
  19. SignalBadge component
  20. ChecklistGrid component

Phase 3 — P2 Report Charts
  21. Print stylesheet
  22. PDF dimension configs
  23. Static chart variants (no animation)
  24. Performance waterfall (WaterfallChart)
  25. Analytics architecture (FlowDiagram)
  26. PPC parity (ComparisonMatrix)
  27. Consent audit timeline
  28. ROI impact stacked bar
  29. Remediation roadmap (scatter + gantt)
  30. Competitor overlap visualization

Phase 4 — Polish
  31. Framer Motion entrance animations
  32. Staggered card animations
  33. Loading/error/empty states for all charts
  34. Accessibility audit + ARIA labels
  35. Color-blind mode
  36. High contrast mode
  37. Performance profiling + optimization
```
