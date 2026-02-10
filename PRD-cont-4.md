# P2 McKinsey-Style Report Design Specification — MarketingAlphaScan "Alpha Brief"

> **Document Type:** Implementation Blueprint
> **Version:** 1.0
> **Date:** 2026-02-09
> **Target:** Next.js 15 (Vercel) + React + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion + Recharts
> **Deliverable:** P2 "Alpha Brief" — a paid report ($9.99, anchored $29.99) that must feel like a $50K consulting engagement

---

## Table of Contents

1. [Report Architecture & Navigation](#section-1-report-architecture--navigation)
2. [Cover Page Design](#section-2-cover-page-design)
3. [Executive Summary Section](#section-3-executive-summary-section)
4. [Technology Stack Visualization](#section-4-technology-stack-visualization)
5. [Category Deep-Dive Sections](#section-5-category-deep-dive-sections)
6. [ROI Impact Analysis Section](#section-6-roi-impact-analysis-section)
7. [Remediation Roadmap Section](#section-7-remediation-roadmap-section)
8. [PDF Generation Strategy](#section-8-pdf-generation-strategy)
9. [Report Data Flow & Component Architecture](#section-9-report-data-flow--component-architecture)
10. [Visual Polish & Premium Feel](#section-10-visual-polish--premium-feel)
- [Appendix A: Full ReportData TypeScript Interface](#appendix-a-full-reportdata-typescript-interface)
- [Appendix B: Print CSS](#appendix-b-print-css)
- [Appendix C: Puppeteer PDF Generation](#appendix-c-puppeteer-pdf-generation)
- [Appendix D: Section-to-Module Data Source Mapping](#appendix-d-section-to-module-data-source-mapping)
- [Appendix E: Accessibility](#appendix-e-accessibility)
- [Appendix F: Performance Budget](#appendix-f-performance-budget)

---

## Section 1: Report Architecture & Navigation

### 1.1 Component Hierarchy

```
app/(dashboard)/report/[id]/page.tsx  (Server Component — data fetch)
└── ReportLayout                       (Client Component — scroll, TOC, print)
    ├── CoverSection
    ├── TableOfContentsSection
    ├── ExecutiveSummarySection
    ├── TechStackSection
    ├── CategorySection × 8            (reusable component, different data per category)
    │   ├── AnalyticsSection
    │   ├── PaidMediaSection
    │   ├── PerformanceSection
    │   ├── ComplianceSection
    │   ├── MarTechSection
    │   ├── SEOSection
    │   ├── MarketPositionSection
    │   └── DigitalPresenceSection
    ├── ROISection
    ├── RoadmapSection
    ├── AppendixSection
    ├── MethodologySection
    └── SourcesSection
```

### 1.2 Route Configuration

**Route:** `/report/[id]/page.tsx`

- **Server component** fetches scan + module_results + payment verification
- **Access control:** `scan.tier === 'paid'` required; redirect to upgrade page if not
- **URL params:**
  - `?print=true` — PDF-optimized render (no lazy loading, no animations, all sections expanded)
  - `?share=TOKEN` — shared access (signed JWT, 30-day expiry)

### 1.3 Navigation — Web View

- **Sticky sidebar TOC** (left, 250px wide) with section names and traffic light indicators
- **Current section** highlighted based on scroll position via `IntersectionObserver`
- **Click to jump:** smooth scroll with offset for sticky header
- **Mobile collapse:** sidebar collapses on mobile into a bottom sheet TOC accessible via floating button
- **Top bar:** domain name, MarketingIQ badge, "Download PDF" button, "Share" button

### 1.4 Navigation — Print/PDF View

- No sidebar, no sticky elements
- Page numbers in footer
- Section numbers (1, 2, 3...) in headers
- Explicit "Table of Contents" page with page number references

### 1.5 Share Capability

- **"Share Report"** button generates a signed URL: `/report/[id]?share=JWT_TOKEN`
- **JWT contents:** `{ scanId, expiresAt (30 days), permissions: 'read-only' }`
- **Shared view:** same report layout, no sidebar account nav, "Shared Report" badge displayed, no edit/delete controls

### 1.6 PDF Generation Overview

**Primary approach:** `window.print()` with `@media print` CSS

```css
@page { size: A4; margin: 20mm 15mm 25mm 15mm; }
```

- All lazy-loaded sections pre-rendered
- Animations disabled
- Tooltips hidden, legends shown inline

**Fallback:** Puppeteer on engine droplet

- `GET /report/[id]?print=true` loaded by Puppeteer via `page.pdf()`
- Upload to Supabase Storage bucket `'reports'`
- Filename convention: `MarketingAlphaScan-Report-{{domain}}-{{YYYY-MM-DD}}.pdf`

---

## Section 2: Cover Page Design

### 2.1 Layout Specification

Full-viewport cover (100vh web, exactly 1 A4 page in print):

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  [MarketingAlphaScan Logo — white variant, 140px]           │
│                                                              │
│                                                              │
│                                                              │
│                                                              │
│  MARKETING TECHNOLOGY                                        │
│  AUDIT REPORT                                                │
│  ─────────────────────────────────────────                  │
│                                                              │
│  Plus Jakarta Sans, 800wt, 3.5rem                           │
│  letter-spacing: 0.15em, uppercase                           │
│  color: white                                                │
│                                                              │
│                                                              │
│  {{domain}}                                                  │
│  Plus Jakarta Sans, 700wt, 2rem, color: #E94560             │
│                                                              │
│                                                              │
│  ┌──────────────────┐                                       │
│  │  MarketingIQ      │    ScoreGauge component               │
│  │     {{score}}     │    size: xl (160px)                   │
│  │  {{label}}        │    tier-based color                   │
│  └──────────────────┘                                       │
│                                                              │
│                                                              │
│  Scan Date: {{date}}                                        │
│  Report ID: {{scanId}}   Inter 400wt, 0.875rem, #94A3B8    │
│                                                              │
│  ──────────────────────────                                  │
│  CONFIDENTIAL                                                │
│  Prepared exclusively for {{user_email}}                     │
│  Plus Jakarta Sans, 600wt, 0.75rem, #94A3B8                │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Background: linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)
```

### 2.2 Component Interface

```typescript
interface CoverSectionProps {
  domain: string;
  scanDate: string;
  scanId: string;
  marketingIQ: number;
  marketingIQLabel: string;
  userEmail: string;
}
```

### 2.3 Print Behavior

- Exactly 1 A4 page
- `break-after: always` to force page break after cover
- Background gradient rendered via `print-color-adjust: exact`

---

## Section 3: Executive Summary Section

> The most critical page — a CMO scans this in 60 seconds and decides if the rest is worth reading.

### 3.1 Layout Specification

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  1  EXECUTIVE SUMMARY                                        │
│  ═══════════════════                                         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │              MarketingIQ: {{score}}/100              │     │
│  │                                                      │     │
│  │     [ScoreGauge — xl, centered, with label]         │     │
│  │              "{{marketingIQLabel}}"                  │     │
│  │                                                      │     │
│  │   ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐│     │
│  │   │Anly │Paid │Perf │Comp │MTch │SEO  │Mkt  │Dgtl ││     │
│  │   │ 78  │ 54  │ 82  │ 31  │ 65  │ 71  │ 58  │ 80  ││     │
│  │   │ G   │ Y   │ G   │ R   │ Y   │ G   │ Y   │ G   ││     │
│  │   └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘│     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌── Executive Brief ──────────────────────────────────┐    │
│  │                                                      │    │
│  │  {{executiveBrief — 150-200 words from M42}}        │    │
│  │  Inter 400wt, 1.05rem, 1.7 line-height             │    │
│  │  Background: #F8FAFC, border-left: 3px #0F3460     │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌── Critical Findings ──────────────┐ ┌── Top Opportunities ──────────┐  │
│  │  border-left: 4px #EF476F         │ │  border-left: 4px #06D6A0     │  │
│  │                                    │ │                                │  │
│  │  1. {{finding}} [CRITICAL]        │ │  1. {{opportunity}} [HIGH]     │  │
│  │     Impact: {{impact}}            │ │     Impact: {{impact}}         │  │
│  │                                    │ │                                │  │
│  │  2. {{finding}} [CRITICAL]        │ │  2. {{opportunity}} [HIGH]     │  │
│  │     Impact: {{impact}}            │ │     Impact: {{impact}}         │  │
│  │                                    │ │                                │  │
│  │  3. {{finding}} [WARNING]         │ │  3. {{opportunity}} [MEDIUM]   │  │
│  │     Impact: {{impact}}            │ │     Impact: {{impact}}         │  │
│  └────────────────────────────────────┘ └────────────────────────────────┘  │
│                                                              │
│  ┌── Key Metrics Strip ─────────────────────────────────┐   │
│  │  Monthly Visits │ Bounce Rate │ Tech Stack │ Compliance│   │
│  │   {{124K}}      │  {{42%}}    │  {{23 tools}}│ {{31/100}}│  │
│  │  JetBrains Mono, prominent numbers, labels below    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Component Interface

```typescript
interface ExecutiveSummarySectionProps {
  marketingIQ: number;
  marketingIQLabel: string;
  categoryScores: Array<{
    name: string;
    shortName: string;
    score: number;
    light: 'green' | 'yellow' | 'red';
    weight: number;
  }>;
  executiveBrief: string;           // from M42
  criticalFindings: Array<{
    finding: string;
    severity: 'critical' | 'warning';
    impact: string;
    modules: string[];
  }>;
  topOpportunities: Array<{
    opportunity: string;
    impact: string;
    effort: 'S' | 'M' | 'L' | 'XL';
    modules: string[];
  }>;
  keyMetrics: {
    monthlyVisits?: number;
    bounceRate?: number;
    techStackCount: number;
    complianceScore: number;
  };
}
```

### 3.3 Traffic Light Indicators

Traffic light rendering in the category score strip:

| Score Range | Color | CSS Class | Indicator |
|-------------|-------|-----------|-----------|
| 70-100 | #06D6A0 (Success) | `light-green` | Green circle + check icon |
| 40-69 | #FFD166 (Warning) | `light-yellow` | Yellow triangle + dash icon |
| 0-39 | #EF476F (Error) | `light-red` | Red square + X icon |

Shape + icon used alongside color for color-blind accessibility.

### 3.4 Print Behavior

- Max 2 A4 pages
- Findings and opportunities rendered side-by-side on print
- Key metrics strip always visible on first page

---

## Section 4: Technology Stack Visualization

### 4.1 Layout Specification

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  2  TECHNOLOGY STACK OVERVIEW                                │
│  ════════════════════════════                                │
│                                                              │
│  Stack Health Summary                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │    23     │ │    18    │ │     3    │ │     2    │      │
│  │  Total    │ │  Active  │ │ Inactive │ │Redundant │      │
│  │  Tools    │ │          │ │          │ │  Pairs   │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                              │
│  Your stack uses 23 tools — the average for SaaS is 18.     │
│  (comparison badge/callout)                                  │
│                                                              │
│  ┌── Stack Diagram (grouped by category) ───────────────┐   │
│  │                                                       │   │
│  │  Analytics            Advertising                     │   │
│  │  ┌────┐ ┌────┐      ┌────┐ ┌────┐ ┌────┐           │   │
│  │  │GA4 │ │GTM │      │Meta│ │GAds│ │TikT│           │   │
│  │  └────┘ └────┘      └────┘ └────┘ └────┘           │   │
│  │                                                       │   │
│  │  Automation           CMS & Hosting                   │   │
│  │  ┌────┐ ┌────┐      ┌────┐ ┌────┐ ┌────┐           │   │
│  │  │HubS│ │Klav│      │Next│ │Verc│ │CF  │           │   │
│  │  └────┘ └────┘      └────┘ └────┘ └────┘           │   │
│  │                                                       │   │
│  │  Security             Other                           │   │
│  │  ┌────┐ ┌────┐      ┌────┐ ┌────┐                   │   │
│  │  │CF  │ │Sent│      │Stri│ │Inte│                   │   │
│  │  └────┘ └────┘      └────┘ └────┘                   │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── Category Distribution (Recharts Treemap) ──────────┐   │
│  │  [Treemap showing category sizes by tool count]       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── Detection Table ───────────────────────────────────┐   │
│  │ Tool          │ Category  │ Status │ Source   │ Conf  │   │
│  │───────────────│───────────│────────│──────────│───────│   │
│  │ GA4 G-123456  │ Analytics │ Active │ M05      │  98%  │   │
│  │ GTM GTM-ABC   │ Tag Mgmt  │ Active │ M08      │ 100%  │   │
│  │ Meta Pixel    │ Advertise │ Active │ M06      │  95%  │   │
│  │ Adobe Analyt. │ Analytics │ Unused │ M05      │  70%  │   │
│  │ ...           │           │        │          │       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Tool Icon System

- **Primary:** `simple-icons` npm package for recognized brand icons (GA4, GTM, HubSpot, Meta, Stripe, etc.)
- **Fallback:** first-letter avatar with category color background
- **Icon sizes:** 40x40px in stack diagram, 20x20px in table

### 4.3 Component Interface

```typescript
interface TechStackSectionProps {
  tools: Array<{
    name: string;
    category: string;
    status: 'active' | 'inactive' | 'abandoned';
    confidence: number;
    sourceModules: string[];
    icon?: string;          // simple-icons slug or null
  }>;
  stackHealth: {
    total: number;
    active: number;
    inactive: number;
    redundantPairs: number;
  };
  industryComparison?: {
    industry: string;
    averageToolCount: number;
  };
}
```

### 4.4 Treemap Configuration

Using Recharts `<Treemap>`:

```typescript
const treemapData = tools.reduce((acc, tool) => {
  const existing = acc.find(c => c.name === tool.category);
  if (existing) {
    existing.size++;
    existing.children.push({ name: tool.name, size: 1 });
  } else {
    acc.push({ name: tool.category, size: 1, children: [{ name: tool.name, size: 1 }] });
  }
  return acc;
}, []);
```

Color mapping per category uses the design system palette. Each cell shows the category name and count.

---

## Section 5: Category Deep-Dive Sections

### 5.1 Reusable CategorySection Component

The `CategorySection` is the core reusable component used 8 times (once per scoring category). Each receives category-specific data and a primary visualization.

### 5.2 Component Interface

```typescript
interface CategorySectionProps {
  sectionNumber: number;           // 3-10 (sections 3-10 in report)
  category: {
    name: string;
    shortName: string;
    weight: number;                // 0.04 to 0.20
    score: number;
    light: 'green' | 'yellow' | 'red';
    description: string;           // 1-2 sentence description of what this category measures
  };
  moduleScores: Array<{
    moduleId: string;
    moduleName: string;
    score: number;
    status: 'success' | 'partial' | 'error' | 'skipped';
  }>;
  findings: Array<{
    finding: string;
    severity: 'critical' | 'warning' | 'info' | 'positive';
    evidence: string;
    businessImpact: string;
    sourceModules: string[];
  }>;
  recommendations: Array<{
    action: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    effort: 'S' | 'M' | 'L' | 'XL';
    expectedImpact: string;
  }>;
  primaryVisualization: React.ReactNode;  // category-specific chart
  children?: React.ReactNode;              // additional category-specific content
}
```

### 5.3 CategorySection Layout

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  {{sectionNumber}}  {{CATEGORY NAME}}                        │
│  ════════════════════════════════════                        │
│                                                              │
│  ┌── Score Header ──────────────────────────────────────┐   │
│  │  [ScoreGauge md]  {{score}}/100  {{light}}           │   │
│  │                   Weight: {{weight}}% of MarketingIQ  │   │
│  │                                                       │   │
│  │  Module Breakdown:                                    │   │
│  │  ├─ M05 Analytics Architecture    ████████░░  78/100 │   │
│  │  ├─ M08 Tag Governance            █████░░░░░  54/100 │   │
│  │  └─ M09 Behavioral Intelligence   ████████░░  81/100 │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── Primary Visualization ─────────────────────────────┐   │
│  │  [Category-specific chart — see chart mapping below]  │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── Key Findings ──────────────────────────────────────┐   │
│  │  ┌─ Finding Card ──────────────────────────────────┐ │   │
│  │  │ [CRITICAL] {{finding}}                          │ │   │
│  │  │ Evidence: {{evidence}}                          │ │   │
│  │  │ Impact: {{businessImpact}}            [M05, M08]│ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │  ┌─ Finding Card ──────────────────────────────────┐ │   │
│  │  │ [POSITIVE] {{finding}}                          │ │   │
│  │  │ Evidence: {{evidence}}                [M09]     │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── Recommendations ───────────────────────────────────┐   │
│  │ # │ Action                    │ Priority │ Effort │ Impact │
│  │───│───────────────────────────│──────────│────────│────────│
│  │ 1 │ Enable enhanced convers.  │   P0     │   S    │ +15-30%│
│  │ 2 │ Implement Consent Mode v2 │   P1     │   M    │ Compl. │
│  │ 3 │ Add server-side GTM       │   P2     │   L    │ +10-20%│
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Primary Visualization per Category

| # | Category | Chart Type | Component | Data Source |
|---|----------|-----------|-----------|-------------|
| 1 | Analytics & Data Integrity | Flow diagram: tools to destinations | `FlowDiagram` | M05, M08, M09 |
| 2 | Paid Media & Attribution | Pixel inventory table + PPC parity matrix | `DataTable` + `ComparisonMatrix` | M06, M06b |
| 3 | Performance & UX | CWV dashboard (3 metric cards) + resource waterfall | `MetricCards` + `WaterfallChart` | M03, M13 |
| 4 | Compliance & Security | Consent audit timeline + security headers checklist | `ConsentTimeline` + `ChecklistGrid` | M01, M12 |
| 5 | MarTech Efficiency | Tool utilization heatmap | `UtilizationMatrix` (custom) | M07, M20, M45 |
| 6 | SEO & Content | Metadata scorecard + OG/Twitter card preview | `ChecklistGrid` + `SocialPreview` | M04, M15 |
| 7 | Market Position | Traffic trend AreaChart + sources PieChart + competitor table | Recharts `AreaChart` + `PieChart` + `DataTable` | M24-M35 |
| 8 | Digital Presence | Presence checklist grid | `ChecklistGrid` | M02, M17-M19 |

### 5.5 Finding Severity Badges

| Severity | Background | Text Color | Icon | Label |
|----------|-----------|------------|------|-------|
| critical | #EF476F | white | `AlertTriangle` (lucide) | CRITICAL |
| warning | #FFD166 | #1A1A2E | `AlertCircle` (lucide) | WARNING |
| info | #0F3460 | white | `Info` (lucide) | INFO |
| positive | #06D6A0 | #1A1A2E | `CheckCircle` (lucide) | POSITIVE |

### 5.6 Module Score Progress Bar

Each module within a category gets a horizontal progress bar:

```typescript
interface ModuleScoreBarProps {
  moduleId: string;
  moduleName: string;
  score: number;        // 0-100
  status: 'success' | 'partial' | 'error' | 'skipped';
}
```

- Bar width: proportional to score (0-100%)
- Bar color: follows traffic light system (green >= 70, yellow >= 40, red < 40)
- Skipped modules shown with gray dashed bar and "Skipped" label
- Score number displayed to the right of the bar in JetBrains Mono

### 5.7 Print Behavior

- Each category section starts on a new page (`break-before: always`)
- Charts rendered as static images (no tooltips, no hover states)
- 1-2 A4 pages per category depending on content volume
- Recommendations table never breaks across pages (`break-inside: avoid`)

---

## Section 6: ROI Impact Analysis Section

### 6.1 Layout Specification

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  11  ROI IMPACT ANALYSIS                                     │
│  ═══════════════════════                                     │
│                                                              │
│  ┌── Hero Number ───────────────────────────────────────┐   │
│  │                                                       │   │
│  │  Estimated Monthly Opportunity                        │   │
│  │  $4,200 — $12,800                                    │   │
│  │  JetBrains Mono, 3rem, #1A1A2E                       │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── Impact Cards (5 in a row) ─────────────────────────┐   │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │   │
│  │ │Track │ │Attrib│ │Perf  │ │Compl │ │Tool  │       │   │
│  │ │Gaps  │ │Waste │ │Impact│ │Risk  │ │Redund│       │   │
│  │ │      │ │      │ │      │ │      │ │      │       │   │
│  │ │$1.2K │ │$2.1K │ │$800  │ │ Risk │ │$300  │       │   │
│  │ │-$3.5K│ │-$6K  │ │-$2K  │ │Level │ │-$800 │       │   │
│  │ │      │ │      │ │      │ │      │ │      │       │   │
│  │ │ Med  │ │ High │ │ Med  │ │ Low  │ │ Med  │       │   │
│  │ │conf. │ │conf. │ │conf. │ │conf. │ │conf. │       │   │
│  │ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── Stacked Bar Chart (relative contribution) ─────────┐   │
│  │  [Recharts horizontal stacked BarChart]               │   │
│  │  Tracking ████████████ 35%                           │   │
│  │  Attrib.  ████████████████ 45%                       │   │
│  │  Perf.    █████ 12%                                  │   │
│  │  Tools    ███ 8%                                     │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── Score Improvement Callout ─────────────────────────┐   │
│  │  If you fix all P0 issues:                            │   │
│  │  MarketingIQ: {{current}} → estimated {{target}}     │   │
│  │  [current gauge] ────────→ [target gauge]            │   │
│  │  Background: #F0FFF4 (light green)                    │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── Calculation Details (expandable web, full print) ──┐   │
│  │  Tracking Gap Cost:                                   │   │
│  │  Step 1: Monthly visits (124,000) x conversion rate   │   │
│  │          (2.5%)                                        │   │
│  │  Step 2: ...                                          │   │
│  │  Assumptions: [list]                                  │   │
│  │  Confidence: Medium                                   │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Component Interface

```typescript
interface ROISectionProps {
  totalOpportunity: { low: number; high: number };
  impactAreas: Array<{
    id: string;
    title: string;
    icon: string;
    low: number;
    high: number;
    confidence: 'high' | 'medium' | 'low';
    calculationSteps: string[];
    assumptions: string[];
    sourceModules: string[];
  }>;
  complianceRisk?: {
    annualRange: string;
    riskFactors: string[];
    regulations: string[];
  };
  scoreImprovement: {
    current: number;
    estimated: number;
    label: string;
  };
}
```

### 6.3 Hero Number Formatting

The hero number is the anchor of the ROI section. It must command attention:

- Font: JetBrains Mono, 3rem (48px), weight 700
- Color: #1A1A2E
- Format: `$X,XXX — $XX,XXX` (US dollar format, em-dash separator)
- Label above: "Estimated Monthly Opportunity" in Inter 500wt, 0.875rem, #64748B, uppercase, letter-spacing 0.1em
- Container: centered, 80px top/bottom padding, subtle bottom border `1px solid #E2E8F0`

### 6.4 Impact Cards Grid

Five cards in a responsive row (flex-wrap on mobile to 2-3 per row):

Each card:
- Width: equal flex (1/5 on desktop, 1/2 on mobile)
- Top icon: 24px lucide icon in category color
- Title: Inter 600wt, 0.8rem, uppercase, #64748B
- Dollar range: JetBrains Mono, 1.25rem, #1A1A2E
- Confidence badge: small pill below (see Section 10 confidence badges)
- Border: 1px solid #E2E8F0, border-radius 12px
- Hover (web): subtle shadow elevation

### 6.5 Score Improvement Callout

Green-tinted background box (#F0FFF4) showing before/after:

```
If you fix all P0 issues:
MarketingIQ: 54 → estimated 72
[ScoreGauge sm current] ──────→ [ScoreGauge sm target]
```

- Two `ScoreGauge` components (size `sm`, 48px) connected by a dashed arrow
- Current gauge uses the actual score color; target gauge uses green (#06D6A0)
- Arrow rendered as SVG dashed line with arrowhead

### 6.6 Calculation Details

- **Web view:** collapsed by default with "Show calculation details" toggle (Framer Motion expand)
- **Print view:** always expanded, full details visible
- Each impact area gets its own calculation block:
  - Step-by-step math (numbered list)
  - Assumptions listed in italic
  - Confidence level noted
  - Source modules referenced

### 6.7 Print Behavior

- 1-2 A4 pages
- Hero number and impact cards on first page
- Calculation details on second page if needed
- `break-inside: avoid` on each impact card

---

## Section 7: Remediation Roadmap Section

### 7.1 Layout Specification

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  12  REMEDIATION ROADMAP                                     │
│  ═══════════════════════                                     │
│                                                              │
│  ┌── Impact x Effort Quadrant ──────────────────────────┐   │
│  │              HIGH IMPACT                              │   │
│  │         ┌─────────────┬─────────────┐                │   │
│  │         │  QUICK WINS │   MAJOR     │                │   │
│  │  LOW    │  * WS-01    │  PROJECTS   │  HIGH          │   │
│  │  EFFORT │  * WS-03    │  * WS-02    │  EFFORT        │   │
│  │         │             │  * WS-05    │                │   │
│  │         ├─────────────┼─────────────┤                │   │
│  │         │  FILL-INS   │  THANKLESS  │                │   │
│  │         │  * WS-07    │  TASKS      │                │   │
│  │         │             │  * WS-06    │                │   │
│  │         └─────────────┴─────────────┘                │   │
│  │              LOW IMPACT                               │   │
│  │                                                       │   │
│  │  Recharts ScatterChart with 4 quadrant labels        │   │
│  │  Dots color-coded: P0=#EF476F, P1=#FFD166,          │   │
│  │  P2=#0F3460, P3=#94A3B8                              │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── Timeline (Gantt-style) ────────────────────────────┐   │
│  │         Week 1    Week 2    Weeks 3-4   Month 2   M3+│   │
│  │  WS-01  ████                                         │   │
│  │  WS-02  ██████████████                               │   │
│  │  WS-03           ████                                │   │
│  │  WS-04                     ████████                  │   │
│  │  WS-05                              ████████████     │   │
│  │  Custom SVG horizontal bars with milestone markers   │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── Quick Wins (Top 5) ────────────────────────────────┐   │
│  │  highlight box, green-tinted background               │   │
│  │  1. {{task}} — {{workstream}} — {{impact}} [S effort] │   │
│  │  2. {{task}} — {{workstream}} — {{impact}} [S effort] │   │
│  │  3. ...                                               │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── Workstream Cards ──────────────────────────────────┐   │
│  │  ┌─ WS-01: Restore Revenue Visibility ──────────────┐│   │
│  │  │ Owner: Marketing Ops Manager                      ││   │
│  │  │ Priority: P0  │ Effort: 2-3 weeks │ Tasks: 8     ││   │
│  │  │ Impact: Recover $2K-6K/mo in trackable revenue    ││   │
│  │  │                                                    ││   │
│  │  │ Tasks:                                             ││   │
│  │  │ [ ] WS-01-T01: Enable enhanced conversions... [S] ││   │
│  │  │ [ ] WS-01-T02: Fix consent mode default states [M]││   │
│  │  │ [ ] ...                                            ││   │
│  │  └────────────────────────────────────────────────────┘│   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Component Interface

```typescript
interface RoadmapSectionProps {
  workstreams: Array<{
    id: string;
    name: string;
    ownerRole: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    totalEffort: string;
    businessImpact: string;
    tasks: Array<{
      id: string;
      task: string;
      effort: 'S' | 'M' | 'L' | 'XL';
      dependencies: string[];
      successCriteria: string;
    }>;
  }>;
  timeline: {
    week1: string[];
    week2: string[];
    weeks3_4: string[];
    month2: string[];
    month3plus: string[];
  };
  quickWins: Array<{
    task: string;
    workstream: string;
    impact: string;
  }>;
}
```

### 7.3 Impact x Effort Quadrant Chart

Implementation using Recharts `<ScatterChart>`:

- **X-axis:** Effort (S=1, M=2, L=3, XL=4) — labeled "LOW EFFORT" (left) to "HIGH EFFORT" (right)
- **Y-axis:** Impact (estimated dollar value normalized) — labeled "LOW IMPACT" (bottom) to "HIGH IMPACT" (top)
- **Quadrant lines:** reference lines at x=2.5 and y=midpoint, styled as dashed #E2E8F0
- **Quadrant labels:** positioned in each corner
  - Top-left: "QUICK WINS" (green text)
  - Top-right: "MAJOR PROJECTS" (amber text)
  - Bottom-left: "FILL-INS" (blue text)
  - Bottom-right: "THANKLESS TASKS" (gray text)
- **Dot styling:** by priority — P0=#EF476F (12px), P1=#FFD166 (10px), P2=#0F3460 (8px), P3=#94A3B8 (6px)
- **Tooltip:** workstream name, priority, effort, impact on hover

### 7.4 Gantt Timeline

Custom SVG component (not Recharts — Recharts lacks native Gantt):

```typescript
interface GanttTimelineProps {
  workstreams: Array<{
    id: string;
    name: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    startWeek: number;      // 1-indexed
    durationWeeks: number;
    milestones?: Array<{ week: number; label: string }>;
  }>;
}
```

- **Columns:** Week 1, Week 2, Weeks 3-4, Month 2, Month 3+
- **Bars:** horizontal rectangles colored by priority
- **Bar height:** 24px with 8px gap between rows
- **Milestones:** small diamond markers on the bar
- **Labels:** workstream ID left-aligned, name on hover tooltip
- **Print:** static render, no tooltips

### 7.5 Quick Wins Box

Green-tinted highlight box (#F0FFF4 background, border-left 4px #06D6A0):

- Title: "Quick Wins — Start This Week" in Plus Jakarta Sans 700wt
- List: numbered, each item shows task description, parent workstream, expected impact, effort size badge
- Max 5 items (filtered from all workstream tasks where effort = 'S' and priority in ['P0', 'P1'])

### 7.6 Workstream Cards

Expandable cards (web view: collapsed by default showing header only; print: fully expanded):

**Card header:**
- Workstream ID badge (e.g., "WS-01") in Deep Navy pill
- Workstream name in Plus Jakarta Sans 700wt
- Priority badge (P0/P1/P2/P3 with priority color)
- Effort estimate
- Task count

**Card body (expanded):**
- Owner role
- Business impact statement
- Task checklist (checkbox UI, non-interactive — purely visual)
- Each task: ID, description, effort badge, dependencies (if any), success criteria

### 7.7 Print Behavior

- Quadrant chart and timeline on page 1
- Quick wins box on page 1 (if space) or top of page 2
- Each workstream card fully expanded
- `break-inside: avoid` on individual workstream cards
- Expected: 3-5 A4 pages total for roadmap section

---

## Section 8: PDF Generation Strategy

### 8.1 Primary Approach: `window.print()` + CSS

Complete `@media print` stylesheet:

```css
@media print {
  @page {
    size: A4;
    margin: 20mm 15mm 25mm 15mm;
  }

  /* Hide interactive elements */
  .report-sidebar,
  .report-topbar,
  .share-button,
  .download-button,
  .tooltip,
  .expand-button,
  .collapse-button,
  [data-interactive],
  .hover-overlay { display: none !important; }

  /* Show all content (expand collapsed sections) */
  [data-expandable] {
    max-height: none !important;
    overflow: visible !important;
  }
  [data-collapsed] { display: block !important; }

  /* Page breaks */
  .report-section { break-before: always; }
  .report-section:first-child { break-before: auto; }
  .chart-container, .finding-card, .data-table { break-inside: avoid; }
  .section-header { break-after: avoid; }

  /* Typography adjustments */
  body {
    font-size: 10pt;
    color: #000 !important;
    background: white !important;
  }
  h1 { font-size: 18pt; }
  h2 { font-size: 14pt; }
  h3 { font-size: 12pt; }

  /* Ensure colors print */
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }

  /* Chart adjustments */
  .recharts-tooltip-wrapper { display: none !important; }
  .recharts-legend-wrapper { display: block !important; }
  .chart-container {
    box-shadow: none !important;
    border: 1px solid #E2E8F0;
  }

  /* Watermark */
  .print-watermark {
    display: block !important;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 72pt;
    color: rgba(0, 0, 0, 0.03);
    white-space: nowrap;
    z-index: 9999;
    pointer-events: none;
  }

  /* Page header/footer */
  .print-header {
    display: block !important;
    position: running(header);
  }
  .print-footer {
    display: block !important;
    position: running(footer);
  }
  @page {
    @top-left { content: element(header); }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); }
  }

  /* Content width */
  .report-content { max-width: 100% !important; padding: 0 !important; }
}
```

### 8.2 Puppeteer Fallback (on Engine Droplet)

```typescript
// apps/engine/src/services/pdf-generator.ts

import { chromium } from 'playwright';

export async function generateReportPDF(
  scanId: string,
  reportUrl: string
): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`${reportUrl}?print=true`, {
    waitUntil: 'networkidle'
  });

  // Wait for all charts to render
  await page.waitForSelector('[data-charts-loaded="true"]', {
    timeout: 30000
  });

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: '20mm',
      bottom: '25mm',
      left: '15mm',
      right: '15mm'
    },
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size:8px;width:100%;text-align:left;padding-left:15mm;">
        <span style="color:#94A3B8;">MarketingAlphaScan</span>
      </div>`,
    footerTemplate: `
      <div style="font-size:8px;width:100%;text-align:right;padding-right:15mm;">
        <span style="color:#94A3B8;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </span>
      </div>`,
  });

  await browser.close();
  return Buffer.from(pdf);
}
```

### 8.3 Upload to Supabase Storage

```typescript
async function uploadReportPDF(
  scanId: string,
  pdf: Buffer
): Promise<string> {
  const filename = `reports/${scanId}/MarketingAlphaScan-Report.pdf`;

  const { error } = await supabase.storage
    .from('reports')
    .upload(filename, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) throw error;

  const { data } = await supabase.storage
    .from('reports')
    .createSignedUrl(filename, 60 * 60 * 24); // 24h expiry

  return data.signedUrl;
}
```

### 8.4 Download Button Behavior

1. User clicks "Download PDF"
2. **First attempt:** `window.print()` (instant, zero cost)
3. If user prefers server-generated: "Having trouble? Click here for server-generated PDF" link
4. **Server-generated flow:** `POST /api/reports/generate` -> engine generates -> Supabase Storage -> signed URL -> download

### 8.5 Print Quality Checklist

Before shipping, verify:

- [ ] Cover page renders as exactly 1 A4 page
- [ ] All charts have `print-color-adjust: exact`
- [ ] No blank pages between sections
- [ ] Tables do not break across pages
- [ ] Traffic light colors visible in grayscale (shapes provide redundancy)
- [ ] Page numbers appear in footer
- [ ] Total PDF length: 25-40 pages (depending on findings count)
- [ ] File size: under 5MB
- [ ] Watermark visible but non-distracting

---

## Section 9: Report Data Flow & Component Architecture

### 9.1 Server Component Data Fetching

```typescript
// app/(dashboard)/report/[id]/page.tsx

import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ReportLayout } from '@/components/report/report-layout';
import { transformToReportData } from '@/lib/report/transform';

export default async function ReportPage({
  params, searchParams
}: {
  params: { id: string };
  searchParams: { print?: string; share?: string }
}) {
  const supabase = await createServerClient();

  // Verify access
  const { data: scan } = await supabase
    .from('scans')
    .select('*, module_results(*)')
    .eq('id', params.id)
    .single();

  if (!scan) redirect('/404');

  // Check paid tier (or valid share token)
  if (scan.tier !== 'paid' && !verifyShareToken(searchParams.share, params.id)) {
    redirect(`/scan/${params.id}?upgrade=true`);
  }

  // Transform raw data into report structure
  const reportData = transformToReportData(scan, scan.module_results);

  return (
    <ReportLayout
      data={reportData}
      isPrintMode={searchParams.print === 'true'}
      isShared={!!searchParams.share}
    />
  );
}
```

### 9.2 ReportData Interface (Data Contract)

```typescript
interface ReportData {
  // Metadata
  domain: string;
  scanDate: string;
  scanId: string;
  userEmail: string;

  // Scores
  marketingIQ: number;
  marketingIQLabel: string;
  categoryScores: CategoryScore[];

  // Executive Summary (M42)
  executiveBrief: string;
  criticalFindings: Finding[];
  topOpportunities: Opportunity[];

  // Tech Stack (M02, M05-M09, M20)
  techStack: TechStackData;

  // Category Deep Dives
  categories: {
    analytics: CategoryData;
    paidMedia: CategoryData;
    performance: CategoryData;
    compliance: CategoryData;
    martech: CategoryData;
    seo: CategoryData;
    marketPosition: CategoryData;
    digitalPresence: CategoryData;
  };

  // ROI (M44, M45)
  roi: ROIData;

  // Roadmap (M43)
  roadmap: RoadmapData;

  // Key Metrics
  keyMetrics: {
    monthlyVisits?: number;
    bounceRate?: number;
    techStackCount: number;
    complianceScore: number;
    organicTrafficShare?: number;
    domainRank?: number;
  };

  // Methodology
  methodology: {
    categoryWeights: Array<{ name: string; weight: number }>;
    penaltiesApplied: Array<{ name: string; points: number; reason: string }>;
    bonusesApplied: Array<{ name: string; points: number; reason: string }>;
  };

  // Sources
  sources: Array<{
    moduleId: string;
    moduleName: string;
    dataProvider?: string;
    timestamp: string;
  }>;
}
```

### 9.3 Lazy Loading Strategy

- **Web view:** only `CoverSection` and `ExecutiveSummarySection` load immediately
- **Other sections:** use `IntersectionObserver` (200px root margin) + `React.lazy()`
- **Print mode** (`?print=true`): ALL sections render immediately, no lazy loading
- **Loading state:** section-level skeleton matching final layout shape

```typescript
// components/report/lazy-section.tsx
'use client';

import { useRef, useState, useEffect, lazy, Suspense } from 'react';

interface LazySectionProps {
  isPrintMode: boolean;
  fallback: React.ReactNode;  // skeleton
  children: React.ReactNode;
}

export function LazySection({ isPrintMode, fallback, children }: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(isPrintMode);

  useEffect(() => {
    if (isPrintMode || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isPrintMode]);

  return (
    <div ref={ref}>
      {isVisible ? (
        <Suspense fallback={fallback}>
          {children}
        </Suspense>
      ) : (
        fallback
      )}
    </div>
  );
}
```

### 9.4 Section Skeletons

Each section has a matching skeleton component that mirrors its final layout:

```typescript
// Example: ExecutiveSummarySkeleton
function ExecutiveSummarySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Score gauge placeholder */}
      <div className="flex justify-center">
        <div className="w-40 h-40 rounded-full bg-gray-200" />
      </div>
      {/* Category scores strip */}
      <div className="flex gap-4 justify-center">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-16 h-20 rounded bg-gray-200" />
        ))}
      </div>
      {/* Brief text */}
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
        <div className="h-4 bg-gray-200 rounded w-4/6" />
      </div>
    </div>
  );
}
```

### 9.5 Data Transform Pipeline

The `transformToReportData` function converts raw Supabase data into the `ReportData` contract:

```typescript
// lib/report/transform.ts

export function transformToReportData(
  scan: ScanRecord,
  moduleResults: ModuleResultRecord[]
): ReportData {
  const resultMap = new Map(
    moduleResults.map(r => [r.module_id, r])
  );

  return {
    domain: scan.domain,
    scanDate: scan.created_at,
    scanId: scan.id,
    userEmail: scan.user_email,

    marketingIQ: scan.marketing_iq_score,
    marketingIQLabel: getMarketingIQLabel(scan.marketing_iq_score),
    categoryScores: buildCategoryScores(resultMap),

    executiveBrief: extractField(resultMap, 'M42', 'executive_brief'),
    criticalFindings: extractFindings(resultMap, 'M42', 'critical'),
    topOpportunities: extractOpportunities(resultMap, 'M42'),

    techStack: buildTechStackData(resultMap),
    categories: buildAllCategoryData(resultMap),
    roi: buildROIData(resultMap),
    roadmap: buildRoadmapData(resultMap),

    keyMetrics: buildKeyMetrics(resultMap, scan),
    methodology: buildMethodology(scan),
    sources: buildSources(moduleResults),
  };
}
```

### 9.6 Chart Render Completion Signal

For Puppeteer PDF generation, charts must signal when they have finished rendering:

```typescript
// components/report/report-layout.tsx
'use client';

import { useEffect, useState } from 'react';

export function ReportLayout({ data, isPrintMode, isShared }: ReportLayoutProps) {
  const [chartsLoaded, setChartsLoaded] = useState(false);
  const totalCharts = countCharts(data); // count expected chart instances
  const loadedCharts = useRef(0);

  const onChartReady = useCallback(() => {
    loadedCharts.current++;
    if (loadedCharts.current >= totalCharts) {
      setChartsLoaded(true);
    }
  }, [totalCharts]);

  return (
    <div data-charts-loaded={chartsLoaded}>
      {/* ... sections with onChartReady callback ... */}
    </div>
  );
}
```

---

## Section 10: Visual Polish & Premium Feel

### 10.1 Typography Scale (Report-Specific)

Slightly larger than dashboard for optimal reading experience:

| Element | Font | Size | Weight | Color | Spacing |
|---------|------|------|--------|-------|---------|
| Section title | Plus Jakarta Sans | 2.5rem | 800 | #1A1A2E | letter-spacing: -0.02em |
| Subsection | Plus Jakarta Sans | 1.75rem | 700 | #1A1A2E | letter-spacing: -0.01em |
| Body | Inter | 1.05rem | 400 | #1A1A2E | line-height: 1.7 |
| Small/label | Inter | 0.875rem | 500 | #64748B | letter-spacing: 0.02em |
| Data/number | JetBrains Mono | 1.1rem | 600 | #1A1A2E | -- |
| Quote | Inter | 1.15rem | 400 italic | #0F3460 | line-height: 1.8 |

### 10.2 Section Dividers

Each section starts with a consistent header treatment:

```
┌─ Section number badge ─────────────────────────────────────┐
│ (3) (circled number, 32px, Deep Navy bg, white text)       │
│      EXECUTIVE SUMMARY                                      │
│ ═══════════════════════════════════════════════════════════  │
└────────────────────────────────────────────────────────────┘
```

Implementation:
```typescript
interface SectionHeaderProps {
  number: number;
  title: string;
}

// Circled number: 32px circle, bg #1A1A2E, white text, Plus Jakarta Sans 700wt
// Title: Plus Jakarta Sans 800wt, 2.5rem, uppercase, #1A1A2E
// Divider: 3px solid #1A1A2E, full width, 8px below title
```

### 10.3 Callout Box Variants

```typescript
interface CalloutBoxProps {
  type: 'critical' | 'warning' | 'info' | 'positive';
  title?: string;
  children: React.ReactNode;
}
```

Styling per type:

| Type | Border-Left | Background | Icon |
|------|------------|------------|------|
| critical | 4px #EF476F | #FFF5F7 | AlertTriangle (lucide, #EF476F) |
| warning | 4px #FFD166 | #FFFBEB | AlertCircle (lucide, #FFD166) |
| info | 4px #0F3460 | #F0F4FF | Info (lucide, #0F3460) |
| positive | 4px #06D6A0 | #F0FFF4 | CheckCircle (lucide, #06D6A0) |

All callouts: padding 20px 24px, border-radius 8px (right side only), Inter 400wt body text.

### 10.4 Pull Quotes for Key Findings

```html
<blockquote class="report-pullquote">
  <p>"{{finding}}"</p>
  <cite>-- Source: M05, M08</cite>
</blockquote>
```

Styled:
- Font: Inter italic, 1.15rem, color #0F3460
- Border-left: 3px dashed #94A3B8
- Padding-left: 24px
- Margin: 2rem 0
- Cite: Inter 400wt, 0.8rem, #94A3B8

### 10.5 Page Feel

- **Content max-width:** 900px (narrower than dashboard 1280px, optimized for reading)
- **Section spacing:** 6rem between sections (web), page break between sections (print)
- **Card padding:** 2rem with 12px border-radius
- **Card shadow:** `0 1px 3px rgba(0,0,0,0.04)` (subtle, not distracting)
- **Background:** #FAFBFC body, #FFFFFF surface cards

### 10.6 Confidence Badges

| Level | Style | Icon |
|-------|-------|------|
| high | Green pill (#06D6A0 bg, white text) | CheckCircle (12px) |
| medium | Amber pill (#FFD166 bg, #1A1A2E text) | Info (12px) |
| low | Gray pill (#94A3B8 bg, white text) "Low Confidence -- Estimated" | HelpCircle (12px) |

Badge: inline-flex, padding 2px 10px, border-radius 9999px, Inter 500wt 0.7rem, gap 4px between icon and text.

### 10.7 Table Styling

```css
.report-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  overflow: hidden;
}
.report-table thead th {
  background: #F8FAFC;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748B;
  padding: 12px 16px;
  text-align: left;
  border-bottom: 2px solid #E2E8F0;
  position: sticky;
  top: 0;
}
.report-table tbody tr:nth-child(even) {
  background: #FAFBFC;
}
.report-table tbody td {
  padding: 10px 16px;
  font-size: 0.9rem;
  border-bottom: 1px solid #F1F5F9;
}
.report-table tbody tr:last-child td {
  border-bottom: none;
}
.report-table tbody tr:hover {
  background: #F1F5F9;
}
```

### 10.8 Animations (Web View Only)

Using Framer Motion for premium feel:

```typescript
// Section entrance animation
const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' }
  },
};

// Score counter animation (on first view)
const counterVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.8, ease: 'easeOut' }
  },
};

// Chart entrance (stagger children)
const chartContainerVariants = {
  visible: {
    transition: { staggerChildren: 0.1 }
  },
};
```

All animations disabled in print mode via `isPrintMode` prop or `prefers-reduced-motion` media query.

### 10.9 Color Palette Quick Reference

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | #1A1A2E | Deep Navy — headings, primary text, section badges |
| Accent | #0F3460 | Darker blue — info callouts, executive brief border |
| Highlight | #E94560 | Soft Red — domain name on cover, emphasis |
| Success | #06D6A0 | Green — positive findings, quick wins, high confidence |
| Warning | #FFD166 | Amber — warning findings, medium confidence |
| Error | #EF476F | Red — critical findings, P0 priority, low scores |
| Background | #FAFBFC | Page background |
| Surface | #FFFFFF | Card/panel background |
| Muted Text | #64748B | Labels, captions, secondary text |
| Subtle Border | #E2E8F0 | Table borders, card borders, dividers |
| Light Border | #F1F5F9 | Row separators, subtle divisions |

---

## Appendix A: Full ReportData TypeScript Interface

```typescript
// ============================================================
// Core Types
// ============================================================

type TrafficLight = 'green' | 'yellow' | 'red';
type Severity = 'critical' | 'warning' | 'info' | 'positive';
type Priority = 'P0' | 'P1' | 'P2' | 'P3';
type Effort = 'S' | 'M' | 'L' | 'XL';
type Confidence = 'high' | 'medium' | 'low';
type ToolStatus = 'active' | 'inactive' | 'abandoned';
type ModuleStatus = 'success' | 'partial' | 'error' | 'skipped';

// ============================================================
// Sub-Types
// ============================================================

interface CategoryScore {
  name: string;
  shortName: string;      // 4-char abbreviation (Anly, Paid, Perf, etc.)
  score: number;           // 0-100
  light: TrafficLight;
  weight: number;          // 0.04 to 0.20
}

interface Finding {
  finding: string;
  severity: Severity;
  impact: string;
  evidence?: string;
  businessImpact?: string;
  modules: string[];       // e.g., ['M05', 'M08']
}

interface Opportunity {
  opportunity: string;
  impact: string;
  effort: Effort;
  modules: string[];
}

interface TechStackData {
  tools: Array<{
    name: string;
    category: string;
    status: ToolStatus;
    confidence: number;
    sourceModules: string[];
    icon?: string;
  }>;
  stackHealth: {
    total: number;
    active: number;
    inactive: number;
    redundantPairs: number;
  };
  industryComparison?: {
    industry: string;
    averageToolCount: number;
  };
}

interface CategoryData {
  category: {
    name: string;
    shortName: string;
    weight: number;
    score: number;
    light: TrafficLight;
    description: string;
  };
  moduleScores: Array<{
    moduleId: string;
    moduleName: string;
    score: number;
    status: ModuleStatus;
  }>;
  findings: Array<{
    finding: string;
    severity: Severity;
    evidence: string;
    businessImpact: string;
    sourceModules: string[];
  }>;
  recommendations: Array<{
    action: string;
    priority: Priority;
    effort: Effort;
    expectedImpact: string;
  }>;
  // Category-specific data (varies by category)
  visualizationData: Record<string, unknown>;
}

interface ROIData {
  totalOpportunity: { low: number; high: number };
  impactAreas: Array<{
    id: string;
    title: string;
    icon: string;
    low: number;
    high: number;
    confidence: Confidence;
    calculationSteps: string[];
    assumptions: string[];
    sourceModules: string[];
  }>;
  complianceRisk?: {
    annualRange: string;
    riskFactors: string[];
    regulations: string[];
  };
  scoreImprovement: {
    current: number;
    estimated: number;
    label: string;
  };
}

interface RoadmapData {
  workstreams: Array<{
    id: string;
    name: string;
    ownerRole: string;
    priority: Priority;
    totalEffort: string;
    businessImpact: string;
    tasks: Array<{
      id: string;
      task: string;
      effort: Effort;
      dependencies: string[];
      successCriteria: string;
    }>;
  }>;
  timeline: {
    week1: string[];
    week2: string[];
    weeks3_4: string[];
    month2: string[];
    month3plus: string[];
  };
  quickWins: Array<{
    task: string;
    workstream: string;
    impact: string;
  }>;
}

// ============================================================
// Main Interface
// ============================================================

interface ReportData {
  // Metadata
  domain: string;
  scanDate: string;
  scanId: string;
  userEmail: string;

  // Scores
  marketingIQ: number;
  marketingIQLabel: string;
  categoryScores: CategoryScore[];

  // Executive Summary (M42)
  executiveBrief: string;
  criticalFindings: Finding[];
  topOpportunities: Opportunity[];

  // Tech Stack (M02, M05-M09, M20)
  techStack: TechStackData;

  // Category Deep Dives
  categories: {
    analytics: CategoryData;
    paidMedia: CategoryData;
    performance: CategoryData;
    compliance: CategoryData;
    martech: CategoryData;
    seo: CategoryData;
    marketPosition: CategoryData;
    digitalPresence: CategoryData;
  };

  // ROI (M44, M45)
  roi: ROIData;

  // Roadmap (M43)
  roadmap: RoadmapData;

  // Key Metrics
  keyMetrics: {
    monthlyVisits?: number;
    bounceRate?: number;
    techStackCount: number;
    complianceScore: number;
    organicTrafficShare?: number;
    domainRank?: number;
  };

  // Methodology
  methodology: {
    categoryWeights: Array<{ name: string; weight: number }>;
    penaltiesApplied: Array<{ name: string; points: number; reason: string }>;
    bonusesApplied: Array<{ name: string; points: number; reason: string }>;
  };

  // Sources
  sources: Array<{
    moduleId: string;
    moduleName: string;
    dataProvider?: string;
    timestamp: string;
  }>;
}
```

---

## Appendix B: Print CSS

The complete `@media print` stylesheet is documented in [Section 8.1](#81-primary-approach-windowprint--css). Key rules summary:

| Rule | Purpose |
|------|---------|
| `@page { size: A4; margin: 20mm 15mm 25mm 15mm; }` | A4 format with comfortable margins |
| `.report-sidebar { display: none; }` | Hide navigation chrome |
| `[data-expandable] { max-height: none; }` | Expand all collapsed sections |
| `.report-section { break-before: always; }` | Each section on new page |
| `.chart-container { break-inside: avoid; }` | Never split charts across pages |
| `* { print-color-adjust: exact; }` | Preserve colors in print |
| `.print-watermark { display: block; }` | Show subtle watermark |
| `body { font-size: 10pt; }` | Print-optimized base size |

---

## Appendix C: Puppeteer PDF Generation

The complete Playwright/Puppeteer implementation is documented in [Section 8.2](#82-puppeteer-fallback-on-engine-droplet) and [Section 8.3](#83-upload-to-supabase-storage). Key configuration:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `format` | A4 | Standard international paper |
| `printBackground` | true | Preserve design colors |
| `preferCSSPageSize` | true | Respect `@page` rules |
| `waitUntil` | networkidle | Ensure all assets loaded |
| `data-charts-loaded` | Selector wait | Ensure Recharts SVGs rendered |
| Header | "MarketingAlphaScan" left | Branding |
| Footer | "Page X of Y" right | Navigation |
| Storage bucket | `reports` | Supabase Storage |
| Signed URL expiry | 24 hours | Security |

---

## Appendix D: Section-to-Module Data Source Mapping

| Report Section | Report # | Data Sources | Notes |
|---------------|---------|-------------|-------|
| Cover | -- | scan metadata | domain, date, score, user email |
| Executive Summary | 1 | M42 | AI-generated brief, findings, opportunities |
| Tech Stack | 2 | M02, M05, M06, M07, M08, M09, M20 | All technology detection modules |
| Analytics & Data Integrity | 3 | M05, M08, M09, M41(M05), M41(M08), M41(M09) | GA4, GTM, behavioral analytics |
| Paid Media & Attribution | 4 | M06, M06b, M21, M28, M29, M41 outputs | Pixels, PPC, attribution |
| Performance & UX | 5 | M03, M13, M14, M41 outputs | CWV, page speed, resource analysis |
| Compliance & Security | 6 | M01, M10, M11, M12, M41 outputs | Consent, privacy, security headers |
| MarTech Efficiency | 7 | M07, M20, M45, M41 outputs | Tool utilization, redundancy |
| SEO & Content | 8 | M04, M15, M16, M41 outputs | Meta tags, structured data, content |
| Market Position | 9 | M24-M35, M41 outputs | SimilarWeb data, competitor analysis |
| Digital Presence | 10 | M02, M17, M18, M19, M41 outputs | Social profiles, schema, branding |
| ROI Impact Analysis | 11 | M44, M45 | Revenue impact, cost analysis |
| Remediation Roadmap | 12 | M43 | Workstreams, tasks, timeline |
| Methodology | 13 | scoring config (static) | Weights, penalties, bonuses |
| Sources | 14 | all module metadata | Module IDs, timestamps, providers |

---

## Appendix E: Accessibility

### E.1 Heading Hierarchy

Every report follows strict heading hierarchy:
- `<h1>`: Report title (cover page only)
- `<h2>`: Section titles (Executive Summary, Tech Stack, etc.)
- `<h3>`: Subsection titles (Score Header, Key Findings, Recommendations)
- `<h4>`: Individual items (finding titles, workstream names)

### E.2 Chart Accessibility

All charts include:
- `aria-label` with a data summary (e.g., "Bar chart showing MarketingIQ category scores. Analytics: 78, Paid Media: 54...")
- Hidden `<table>` alternative (`ScreenReaderTable`) with `sr-only` class containing the same data in tabular form
- `role="img"` on chart wrapper SVG elements

### E.3 Color-Blind Safety

Traffic lights use shape + icon in addition to color:
- Green: circle shape + CheckCircle icon
- Yellow: triangle shape + AlertCircle icon
- Red: square shape + X icon

All severity badges include text labels (CRITICAL, WARNING, INFO, POSITIVE) alongside colors.

### E.4 Keyboard Navigation

- Sidebar TOC items are focusable (`tabIndex={0}`) and keyboard navigable (Enter to jump)
- Expandable sections triggered by Enter/Space on toggle button
- Focus trap within modal dialogs (share URL modal)
- Skip-to-content link at top of page

### E.5 Screen Reader Considerations

- `aria-hidden="true"` on decorative elements (watermark, decorative borders, score gauge animations)
- `aria-live="polite"` on score counter animation completion
- `aria-expanded` on expandable sections
- Meaningful `alt` text on all tool icons

---

## Appendix F: Performance Budget

### F.1 Load Time Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Report page initial load (cover + exec summary) | < 3s | LCP on 4G connection |
| All charts visible (lazy loaded as user scrolls) | < 5s from first scroll | Custom metric |
| Print mode full render | < 8s | All sections, no lazy loading |
| Time to Interactive | < 4s | TTI metric |

### F.2 Bundle Size Targets

| Asset | Target (gzipped) | Notes |
|-------|------------------|-------|
| Report page JS bundle | < 150KB | Excluding shared chunks |
| Largest chart component | < 20KB | Individual component ceiling |
| Recharts (shared) | ~45KB | Tree-shaken, only used chart types |
| Framer Motion (shared) | ~30KB | Tree-shaken, only used features |
| Print CSS | < 3KB | Inlined in `<style>` for print |
| Total report-specific CSS | < 8KB | Tailwind purged |

### F.3 Image Optimization

- **Tool icons:** all SVG (inline or sprite sheet), no raster images
- **OG preview mockup** (SEO section): generated as inline SVG or `<canvas>`, not a raster image
- **Score gauges:** pure SVG/CSS, no image assets
- **Logo on cover:** SVG, inlined

### F.4 Caching Strategy

- **Static assets:** immutable cache (1 year, content-hashed filenames)
- **Report data:** ISR with 60-second revalidation (report data rarely changes)
- **PDF files:** cached in Supabase Storage, regenerated only if scan data changes
- **Fonts:** preloaded via `next/font`, locally hosted (no Google Fonts CDN)

### F.5 Rendering Strategy

| Section | Strategy | Reason |
|---------|----------|--------|
| Page shell + data fetch | Server Component (RSC) | SEO not needed but fast TTFB |
| ReportLayout | Client Component | Needs scroll observers, state |
| Cover + Exec Summary | Eager render | Above the fold |
| All other sections | Lazy + IntersectionObserver | Below the fold |
| Charts within sections | Dynamic import | Heavy Recharts components |
| Print mode | All eager, no lazy | Must render complete document |

---

*End of P2 McKinsey-Style Report Design Specification*
