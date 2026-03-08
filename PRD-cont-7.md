# PRD-cont-7: GhostScan OS — Remaining Implementation Plan

> **Document type**: Principal Engineer (L10) Execution Plan
> **Date**: 2026-02-23
> **Sprint**: GhostScan OS Frontend — Continuation #7
> **Status**: READY FOR EXECUTION
> **Save location**: `/Users/ianramirez/AI/MarketingAlphaAudit/PRD-cont-7.md`
>
> **FIRST STEP ON EXECUTION**: Copy this plan to the project root alongside PRD-cont-1 through PRD-cont-6:
> ```bash
> cp /Users/ianramirez/.claude/plans/abstract-honking-raven.md /Users/ianramirez/AI/MarketingAlphaAudit/PRD-cont-7.md
> ```

---

## 0. What We Already Built (Context)

Over the past sessions we completed **Phases 1–8** of the GhostScan OS frontend redesign — transforming a generic SaaS dashboard into a Win95/Mac OS 9 retro desktop operating system with a pixel art ghost mascot named Chloé. Everything below was **implemented, typechecked, and build-verified**:

| Phase | Scope | Key Files |
|-------|-------|-----------|
| **Phase 1** | Foundation — OKLCH colors, 3D bevels, CRT effects, cursors, Window component (4 variants), Desktop environment, MenuBar, Taskbar, DesktopIcon, ContextMenu, BevelInput, ProgressBar, ASCII player, Matrix Rain | `globals.css`, `tailwind.config.ts`, `layout.tsx`, `components/os/*`, `lib/os-state.ts`, `public/cursors/*` |
| **Phase 2** | Chloé — CSS pixel art sprite (box-shadow 16x16 grid, 9 states), speech bubbles, reactions context (22 events), screenmate desktop pet, chat avatar, 100+ personality strings | `components/chloe/*`, `lib/chloe-ai-copy.ts` |
| **Phase 3** | Scan Experience — Hollywood Hack loading (4-phase choreography), terminal boot, ASCII movie rotation, scan input redesign (dialog/inline variants), scan progress rewrite | `components/scan/scan-sequence.tsx`, `terminal-boot.tsx`, `scan-input.tsx`, `scan-progress.tsx`, `lib/scan-sequence-timing.ts` |
| **Phase 4** | Dashboard — Bento dashboard as Desktop OS with Window chrome, category tab bar, module slides as ModulePanels, overview slide, redaction unlock overlay, chart-config OKLCH migration, paid-slides bulk restyling | `components/scan/bento-dashboard.tsx`, `module-slide.tsx`, `overview-slide.tsx`, `unlock-overlay.tsx`, `paid-slides.tsx`, `lib/chart-config.ts` |
| **Phase 5** | Marketing & Auth — Landing page, pricing cards/page, about page, navbar, footer, auth form (login/register), verify page, signup wall, fake scan progress, pending verification card | `app/(marketing)/*`, `components/marketing/*`, `components/auth/*`, `app/(auth)/*` |
| **Phase 6** | Chat & Error States — Chat interface with Chloé, 6 error state components, 404 page, scan history as file-explorer | `components/chat/*`, `components/states/*`, `app/not-found.tsx`, `app/(dashboard)/history/page.tsx` |
| **Phase 7** | Easter Eggs & Sound — Radio.exe player, Konami code + console ASCII art, procedural Web Audio sound effects, mobile gate | `components/os/radio-player.tsx`, `easter-eggs.tsx`, `mobile-gate.tsx`, `lib/sound-effects.ts` |
| **Phase 8** | Polish — Dashboard layout, chat page, error boundaries, blog, legal pages, report paywall, print button, auto-scan trigger, score gauge, tech stack | Various app/ and component files |

**All phases typecheck clean and build successfully.**

---

## 1. What Remains — Gap Analysis

Below is the exhaustive list of pending items, derived from a full codebase audit performed 2026-02-23. Each item is categorized by priority and estimated complexity.

### 1.1 Chart Components — Hardcoded Hex Color Migration (24 files, ~87 instances)

**Problem**: `lib/chart-config.ts` was migrated to OKLCH CSS variables, but 24 of 26 individual chart component files still contain **hardcoded hex colors** in inline styles, fill attributes, and local color dictionaries. These colors render as the old corporate palette (navy, slate, bright red) inside retro OS windows, creating jarring visual dissonance.

**Files affected** (with instance counts):

| File | Hardcoded Hexes | Local Color Dicts | Old CSS Classes | Font Hardcoding |
|------|----------------|-------------------|-----------------|-----------------|
| `alpha-tooltip.tsx` | 1 (`#FAFBFC`) | — | — | `"JetBrains Mono"` |
| `animation-utils.tsx` | 1 (`rgba(26,26,46,0.12)`) | — | — | — |
| `bento-card.tsx` | 5 (`#F1F5F9`, `#1A1A2E`, `#94A3B8`, `#EF476F`, `#64748B`) | — | — | `"Plus Jakarta Sans"`, `"JetBrains Mono"` |
| `brand-sparkline.tsx` | 4 (`#1A1A2E`, `#06D6A0`, `#EF476F`, `#94A3B8`) | — | — | — |
| `category-scores-bar.tsx` | 1 (`#1A1A2E`) | — | — | — |
| `chart-skeletons.tsx` | 6× `#F1F5F9` | — | — | — |
| `chart-states.tsx` | 6 (`#FAFBFC`, `#E2E8F0`, `#94A3B8`, `#1A1A2E`, `#EF476F`, `#64748B`) | — | — | — |
| `checklist-grid.tsx` | 8 (`#06D6A0`, `#EF476F`, `#FFD166`, `#E2E8F0`, `#F1F5F9`, `#1A1A2E`, `#94A3B8`, `#64748B`) | `STATUS_CONFIG` | `font-heading` | — |
| `comparison-matrix.tsx` | 9 (`#EF476F`, `#FFD166`, `#0EA5E9`, `#E2E8F0`, `#FAFBFC`, `#F1F5F9`, `#1A1A2E`, `#64748B`, `#06D6A0`) | — | `font-heading` | — |
| `competitor-overlap.tsx` | 2 (`#1A1A2E`, `#94A3B8`) | — | `font-heading` | — |
| `consent-timeline.tsx` | 5 (`#06D6A0`, `#EF476F`, `#FFD166`, `#1A1A2E`, `#E94560`) | — | `font-heading` | — |
| `cookie-audit-bar.tsx` | 5 | `COOKIE_COLORS` | — | — |
| `cwv-metrics.tsx` | 5 | `RATING_COLORS` | `font-heading` | — |
| `data-table.tsx` | 6 (`#F1F5F9`, `#FAFBFC`, `#E2E8F0`, `#94A3B8`, `#1A1A2E`, `#F8FAFC`) | — | `font-heading` | — |
| `domain-trust-radar.tsx` | 5 (`#E2E8F0`, `#64748B`, `#94A3B8`, `#1A1A2E`, `#06D6A0`) | — | `font-heading` | — |
| `flow-diagram.tsx` | 8 | `NODE_COLORS`, `STATUS_DOT` | — | — |
| `remediation-scatter.tsx` | 7 | quadrant labels | `font-heading` | — |
| `resource-breakdown.tsx` | 2 (`#1A1A2E`, `#94A3B8`) | — | `font-heading` | — |
| `roi-impact-bar.tsx` | 6 | — | — | — |
| `tool-utilization-heatmap.tsx` | 3 | `UTIL_COLORS` | `font-heading` | — |
| `traffic-sources-donut.tsx` | 3 (`#1A1A2E`, `#64748B`, `#FAFBFC`) | — | — | — |
| `traffic-trend-area.tsx` | 2 (`#1A1A2E`, `#94A3B8`) | — | — | — |
| `waterfall-chart.tsx` | 8 | timing colors | `text-accent` | — |

**3 files are CLEAN**: `chart-a11y.tsx`, `chart-container.tsx`, `chart-performance.tsx`

### 1.2 Non-Chart Component Migration (5 files)

| File | Issue | Instances |
|------|-------|-----------|
| `components/scan/module-card.tsx` | `bg-surface`, `font-heading`, `font-700`, `font-800`, `border-border` | 7 |
| `components/scan/slide-sidebar.tsx` | `border-border`, `font-heading`, `font-600`, plus `font-400` bug (invalid Tailwind) | 3 + 1 bug |
| `app/auth/error/page.tsx` | All hardcoded hex (`#FAFBFC`, `#E2E8F0`, `#1A1A2E`, `#64748B`, `#E94560`) | 6 |
| `app/unsubscribed/page.tsx` | All hardcoded hex (`#FAFBFC`, `#E2E8F0`, `#1A1A2E`, `#64748B`, `#0F3460`) | 5 |
| `app/(dashboard)/report/[id]/page.tsx` | `font-heading` (1 reference) | 1 |

### 1.3 Integration Gaps (Built But Not Wired)

| Component | Status | Gap |
|-----------|--------|-----|
| **MobileGate** (`components/os/mobile-gate.tsx`) | Exported in index.ts, **never imported** anywhere | Not wrapping any layout or page |
| **Sound Effects** (`lib/sound-effects.ts`) | Fully defined (11 events), **zero `soundEffects.play()` calls** in codebase | No interaction triggers sound |
| **Radio.exe** (`components/os/radio-player.tsx`) | Desktop icon exists in bento-dashboard, **`onOpen: () => {}`** is empty callback | Clicking the icon does nothing |

### 1.4 Missing Assets

| Asset | Status | Description |
|-------|--------|-------------|
| **Favicon** | No `favicon.ico` exists in `apps/web/app/` | Need pixel ghost favicon |
| **OG Image** | No `opengraph-image.*` file, no `images` in OG metadata | Need branded social share image |
| **Chloé ASCII Animation** | Only `rick_roll.json` and `short_intro.json` exist in `public/ascii/` | Need cyan/fuchsia Chloé-branded ASCII art for scan loading |

### 1.5 Quality & Polish

| Item | Status |
|------|--------|
| **Lint pass** (`npm run lint --workspace=apps/web`) | Never run |
| **Lighthouse audit** (Performance ≥ 90) | Never run |
| **Accessibility audit** (WCAG AA) | Never run |
| **Cross-browser testing** | Never run |
| **`font-400` bug** in `slide-sidebar.tsx:161` | Invalid Tailwind class, should be `font-normal` |

### 1.6 Deferred Easter Eggs (Lower Priority)

| Item | Status | Complexity |
|------|--------|------------|
| **Pixel Sweep** (Minesweeper using real module data) | Not built | Large |
| **Stack Stacker** (Tetris with MarTech logos) | Not built | Large |
| **Mobile simplified fallback** (single-column below gate) | Not built | Medium |
| **Tablet landscape detection** | Not built | Small |

---

## 2. Out of Scope (Future Sprints)

### Phase 9: Module-Specific Layouts
Per-module custom visualizations designed around each module's unique data shape. Dense modules get custom charts, sparse modules get combined into multi-module cards, GhostScan modules (M09-M12) get Chloé treatment. This requires design work per-module and is estimated at 2-3 weeks.

### Phase 10: McKinsey PDF Report Redesign
The shareable PDF report uses a **completely separate design language** — Bloomberg Terminal density meets McKinsey slide decks. Clean serif typography, data-dense charts, no retro aesthetics. The `components/report/` directory (27 files) is intentionally untouched and will be redesigned in this future sprint. Estimated at 2-3 weeks.

---

## 3. Execution Plan

### Task A: Chart Component Color Migration
**Priority**: HIGH — Most impactful visual fix
**Estimated effort**: ~2 hours
**Approach**: Systematic file-by-file migration

#### A.1: Expand `chart-config.ts` with Missing Color Dictionaries

Several chart files define their own local color dictionaries that should be centralized. Add these to `lib/chart-config.ts`:

```typescript
// ── New exports to add to chart-config.ts ──

/** Cookie category colors (cookie-audit-bar.tsx) */
export const COOKIE_CATEGORY_COLORS: Record<string, string> = {
  essential:    'var(--gs-terminal)',   // was #06D6A0
  functional:   'var(--gs-cyan)',       // was #0EA5E9
  analytics:    'var(--gs-warning)',    // was #FFD166
  advertising:  'var(--gs-critical)',   // was #E94560
  unknown:      'var(--gs-mid-light)', // was #94A3B8
};

/** CWV rating colors (cwv-metrics.tsx) */
export const CWV_RATING_COLORS: Record<string, string> = {
  good:         'var(--gs-terminal)',   // was #06D6A0
  'needs-improvement': 'var(--gs-warning)', // was #FFD166
  poor:         'var(--gs-critical)',   // was #EF476F
};

/** Utilization heat levels (tool-utilization-heatmap.tsx) */
export const UTILIZATION_COLORS = {
  high:    'var(--gs-terminal)',   // was #06D6A0
  medium:  'var(--gs-warning)',    // was #FFD166
  low:     'var(--gs-critical)',   // was #EF476F
  none:    'var(--gs-mid-light)', // was #F1F5F9
};

/** Flow diagram node colors (flow-diagram.tsx) */
export const FLOW_NODE_COLORS: Record<string, string> = {
  source:      'var(--gs-cyan)',
  healthy:     'var(--gs-terminal)',
  warning:     'var(--gs-warning)',
  critical:    'var(--gs-critical)',
  neutral:     'var(--gs-mid-light)',
};

/** Scatter plot quadrant colors (remediation-scatter.tsx) */
export const QUADRANT_COLORS = {
  quickWins:   'var(--gs-terminal)',
  strategic:   'var(--gs-cyan)',
  lowPriority: 'var(--gs-mid-light)',
  avoid:       'var(--gs-critical)',
};

/** Skeleton placeholder color */
export const SKELETON_COLOR = 'var(--gs-mid-light)';

/** Neutral text/axis/grid OKLCH values for inline SVG styles */
export const OKLCH_INLINE = {
  black:     'oklch(0.15 0.01 80)',  // --gs-black
  dark:      'oklch(0.25 0.01 80)',  // --gs-dark
  midDark:   'oklch(0.35 0.01 80)',  // --gs-mid-dark
  mid:       'oklch(0.50 0.01 80)',  // --gs-mid
  midLight:  'oklch(0.65 0.01 80)',  // --gs-mid-light
  light:     'oklch(0.80 0.01 80)',  // --gs-light
  nearWhite: 'oklch(0.93 0.01 80)', // --gs-near-white
  cyan:      'oklch(0.82 0.18 192)',
  fuchsia:   'oklch(0.65 0.28 350)',
  terminal:  'oklch(0.80 0.25 145)',
  critical:  'oklch(0.55 0.22 25)',
  warning:   'oklch(0.78 0.15 75)',
} as const;
```

**Why `OKLCH_INLINE`?** — Recharts/SVG elements use inline `fill` and `stroke` attributes. CSS `var()` doesn't work inside SVG `fill="..."` attributes. We need resolved OKLCH values (not CSS variables) for SVG inline styles. This dict centralizes them so no chart file has raw hex values.

#### A.2: Hex-to-OKLCH Mapping Reference

Every hardcoded hex in charts maps to one of these:

| Old Hex | Meaning | New OKLCH (use `OKLCH_INLINE.*`) |
|---------|---------|----------------------------------|
| `#1A1A2E` | Deep navy text | `OKLCH_INLINE.black` |
| `#0F3460` | Navy accent | `OKLCH_INLINE.dark` |
| `#334155` | Dark text | `OKLCH_INLINE.midDark` |
| `#64748B` | Mid-gray text | `OKLCH_INLINE.mid` |
| `#94A3B8` | Muted text/border | `OKLCH_INLINE.midLight` |
| `#E2E8F0` | Light border/grid | `OKLCH_INLINE.light` |
| `#F1F5F9` | Light bg/skeleton | `OKLCH_INLINE.light` |
| `#F8FAFC` | Near-white bg | `OKLCH_INLINE.nearWhite` |
| `#FAFBFC` | White bg | `OKLCH_INLINE.nearWhite` |
| `#06D6A0` | Success/good/green | `OKLCH_INLINE.terminal` |
| `#EF476F` / `#E94560` | Error/bad/red | `OKLCH_INLINE.critical` |
| `#FFD166` | Warning/amber | `OKLCH_INLINE.warning` |
| `#0EA5E9` | Blue accent | `OKLCH_INLINE.cyan` |
| `#7C3AED` | Purple accent | `OKLCH_INLINE.fuchsia` |
| `#E94560` (soft red variant) | Critical | `OKLCH_INLINE.critical` |

#### A.3: Font Family Replacement Reference

| Old Inline Style | New |
|-----------------|-----|
| `fontFamily: '"Plus Jakarta Sans", sans-serif'` | `fontFamily: 'var(--font-system)'` |
| `fontFamily: '"JetBrains Mono", monospace'` | `fontFamily: 'var(--font-data)'` |
| `fontFamily: '"Inter", sans-serif'` | `fontFamily: 'var(--font-data)'` |

#### A.4: CSS Class Replacement Reference

| Old Class | New Class |
|-----------|-----------|
| `font-heading` | `font-system` |
| `font-700` | `font-bold` |
| `font-800` | `font-bold` (Pixelify Sans doesn't have 800) |
| `font-600` | `font-semibold` |
| `font-400` | `font-normal` |
| `text-primary` | `text-gs-black` |
| `text-muted` | `text-gs-mid` |
| `text-accent` | `text-gs-cyan` |
| `text-error` | `text-gs-critical` |
| `text-success` | `text-gs-terminal` |
| `text-warning` | `text-gs-warning` |
| `bg-surface` | `bg-gs-light` |
| `bg-border` | `bg-gs-mid-light` |
| `border-border` | `border-gs-mid-light` |
| `rounded-xl` / `rounded-lg` | (remove — default is 0px in GhostScan OS) |
| `rounded-2xl` | (remove) |

#### A.5: Execution Order for Charts

Process each file in this exact order (dependency-first):

1. `lib/chart-config.ts` — Add new color dicts + `OKLCH_INLINE`
2. `chart-skeletons.tsx` — Simple: replace 6× `#F1F5F9` with `OKLCH_INLINE.light`
3. `chart-states.tsx` — Replace 6 hex values with `OKLCH_INLINE.*`
4. `alpha-tooltip.tsx` — Replace 1 hex, fix font family
5. `animation-utils.tsx` — Replace 1 rgba
6. `bento-card.tsx` — Replace 5 hex + 2 font families
7. `brand-sparkline.tsx` — Replace 4 hex
8. `category-scores-bar.tsx` — Replace 1 hex
9. `checklist-grid.tsx` — Extract `STATUS_CONFIG` to config, replace 8 hex, fix `font-heading`
10. `comparison-matrix.tsx` — Replace 9 hex, fix `font-heading`
11. `competitor-overlap.tsx` — Replace 2 hex, fix `font-heading`
12. `consent-timeline.tsx` — Replace 5 hex, fix `font-heading`
13. `cookie-audit-bar.tsx` — Import `COOKIE_CATEGORY_COLORS` from config, remove local dict
14. `cwv-metrics.tsx` — Import `CWV_RATING_COLORS` from config, remove local dict, fix `font-heading`
15. `data-table.tsx` — Replace 6 hex, fix `font-heading`
16. `domain-trust-radar.tsx` — Replace 5 hex, fix `font-heading`
17. `flow-diagram.tsx` — Import `FLOW_NODE_COLORS`, remove 2 local dicts, replace 8 hex
18. `remediation-scatter.tsx` — Import `QUADRANT_COLORS`, replace 7 hex, fix `font-heading`
19. `resource-breakdown.tsx` — Replace 2 hex, fix `font-heading`
20. `roi-impact-bar.tsx` — Replace 6 hex
21. `tool-utilization-heatmap.tsx` — Import `UTILIZATION_COLORS`, remove local dict, fix `font-heading`
22. `traffic-sources-donut.tsx` — Replace 3 hex
23. `traffic-trend-area.tsx` — Replace 2 hex
24. `waterfall-chart.tsx` — Replace 8 hex, fix `text-accent`

After each batch of ~5 files, run typecheck: `npx tsc --noEmit --project apps/web/tsconfig.json`

---

### Task B: Non-Chart Component Migration
**Priority**: HIGH
**Estimated effort**: ~30 minutes

#### B.1: `components/scan/module-card.tsx`

Replace all 7 instances of old tokens using the mapping from A.4. This is the accordion-style module viewer (alternative to module-slide). Key replacements:
- `bg-surface` → `bg-gs-light`
- `font-heading` → `font-system`
- `font-700` → `font-bold`
- `font-800` → `font-bold`
- `border-border` → `border-gs-mid-light`

#### B.2: `components/scan/slide-sidebar.tsx`

Replace 3 old tokens + fix the `font-400` bug on line 161:
- `border-border` → `border-gs-mid-light`
- `font-heading` → `font-system`
- `font-600` → `font-semibold`
- **BUG FIX**: `font-400` → `font-normal` (line 161 — `font-400` is invalid Tailwind syntax)

#### B.3: `app/auth/error/page.tsx`

Complete rewrite — currently all hardcoded hex. Convert to GhostScan OS style:
- Dark CRT background with noise grain
- Chloé `critical` sprite
- Window dialog with error message
- "Go Home" as `bevel-button-primary`

#### B.4: `app/unsubscribed/page.tsx`

Complete rewrite — same approach as B.3:
- Dark CRT background
- Chloé `idle` sprite (unsubscribe is not an error)
- Window dialog with confirmation message

#### B.5: `app/(dashboard)/report/[id]/page.tsx`

Single `font-heading` → `font-system` replacement. Read the file first to confirm scope.

---

### Task C: Wire Orphaned Components
**Priority**: HIGH — These are fully built features that users can't access
**Estimated effort**: ~45 minutes

#### C.1: Wire Radio.exe in Bento Dashboard

**File**: `components/scan/bento-dashboard.tsx`

The Radio.exe desktop icon already exists (line 123-128) but its `onOpen` callback is empty. Wire it to open the RadioPlayer component inside the Desktop environment:

1. Import `RadioPlayer` from `@/components/os/radio-player`
2. Add a `radioOpen` state boolean
3. Replace `onOpen: () => {}` with `onOpen: () => setRadioOpen(true)`
4. Render `{radioOpen && <RadioPlayer onClose={() => setRadioOpen(false)} />}` in the window area

**Important**: The RadioPlayer must render as a floating window overlaid on the dashboard, NOT replacing the dashboard content. Use absolute/fixed positioning or add it to the Desktop's window layer.

#### C.2: Wire Sound Effects into Key Interactions

**File**: `lib/sound-effects.ts` is the source. Calls need to be added in:

| Event | Where to Call | File |
|-------|--------------|------|
| `boot` | After scan sequence completes (Phase 3 reveal) | `components/scan/scan-sequence.tsx` |
| `windowOpen` | When Window component mounts with `isActive` | `components/os/window.tsx` |
| `windowClose` | When Window `onClose` fires | `components/os/window.tsx` |
| `scanStart` | When scan begins | `components/scan/scan-progress.tsx` |
| `moduleComplete` | When SSE delivers a module result | `components/scan/scan-progress.tsx` |
| `criticalFound` | When a module result has score < 30 | `components/scan/scan-progress.tsx` |
| `scanComplete` | When scan status = 'complete' | `components/scan/scan-progress.tsx` |
| `chatSend` | When user sends a message | `components/chat/chat-interface.tsx` |
| `chatReceive` | When Chloé responds | `components/chat/chat-interface.tsx` |
| `buttonClick` | On bevel-button-primary click (global or selected) | Consider a hook or selective integration |
| `unlock` | After successful Stripe return | `components/scan/unlock-overlay.tsx` |

**Critical constraint**: Sound is OFF by default. The `soundEffects.play()` calls are no-ops when disabled. Users enable via the menu bar volume toggle or Radio.exe. The `soundEffects.enable()` call should be wired to:
- The 🔊 icon in the MenuBar (`components/os/menu-bar.tsx`)
- Radio.exe play button (`components/os/radio-player.tsx` — when user starts playing, also enable sound effects)

#### C.3: Wire MobileGate into Dashboard Layout

**File**: `app/(dashboard)/layout.tsx`

Wrap the dashboard content in `<MobileGate>`:

```tsx
import { MobileGate } from '@/components/os/mobile-gate';

export default function DashboardLayout({ children }) {
  return (
    <MobileGate>
      <div className="min-h-screen bg-gs-near-white">
        {/* existing header + main */}
      </div>
    </MobileGate>
  );
}
```

**Decision**: Only gate the dashboard (post-scan experience). Marketing pages should remain mobile-accessible since they're the acquisition funnel. The mobile gate wraps the desktop OS metaphor which genuinely doesn't work on small screens.

---

### Task D: Missing Assets
**Priority**: MEDIUM
**Estimated effort**: ~1 hour

#### D.1: Pixel Ghost Favicon

Create `apps/web/app/favicon.ico` (or `icon.svg` for modern browsers) — a tiny pixel art ghost in the GhostScan brand colors.

**Approach**: Use an SVG favicon since Next.js App Router supports `app/icon.svg`:

```svg
<!-- 32x32 pixel art ghost in cyan with fuchsia eyes -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <!-- Ghost body (cyan-white) -->
  <rect x="10" y="4" width="12" height="2" fill="#00e5ff"/>
  <rect x="8" y="6" width="16" height="2" fill="#00e5ff"/>
  <rect x="6" y="8" width="20" height="12" fill="white"/>
  <!-- Eyes (fuchsia) -->
  <rect x="10" y="12" width="4" height="4" fill="#e040fb"/>
  <rect x="18" y="12" width="4" height="4" fill="#e040fb"/>
  <!-- Bottom wave -->
  <rect x="6" y="20" width="4" height="4" fill="white"/>
  <rect x="14" y="20" width="4" height="4" fill="white"/>
  <rect x="22" y="20" width="4" height="4" fill="white"/>
  <rect x="10" y="20" width="4" height="2" fill="white"/>
  <rect x="18" y="20" width="4" height="2" fill="white"/>
</svg>
```

This is a starting point — refine the pixel art to match Chloé's exact proportions from `chloe-sprite.tsx`.

Also create `apps/web/app/apple-icon.png` (180×180) for iOS home screen.

#### D.2: OG Image

Create `apps/web/app/opengraph-image.png` (1200×630) — a branded social share image.

**Design**: Dark (`--gs-black`) background with CRT grain texture, Chloé pixel art centered, "AlphaScan" in Pixelify Sans, "Forensic Marketing Intelligence" in JetBrains Mono, cyan→fuchsia gradient accent line.

**Implementation options**:
1. **Static PNG** — Design in Figma/code, export as PNG, place in `app/`
2. **Dynamic with `opengraph-image.tsx`** — Use Next.js ImageResponse API to generate programmatically (can reuse font variables)

Recommend option 2 for maintainability. Example structure:

```tsx
// app/opengraph-image.tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'AlphaScan — Forensic Marketing Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <div style={{ /* dark bg, Chloé art, brand text */ }} />,
    { ...size }
  );
}
```

#### D.3: Chloé ASCII Animation

Create a Chloé-branded ASCII art animation in `public/ascii/chloe_scan.json` — rendered in brand colors (cyan/fuchsia glyphs) during the scan loading sequence.

**Format**: Same JSON structure as `rick_roll.json`:
```json
[
  { "d": 200, "f": "  frame 1 ASCII text..." },
  { "d": 200, "f": "  frame 2 ASCII text..." }
]
```

**Content idea**: 10-20 frames showing Chloé ghost silhouette "scanning" — her eyes sweep left-to-right, body pulses, data streams around her. Use block characters (█▓▒░), box drawing (╔═╗║╚╝), and braille pattern dots for texture.

**Integration**: Update `lib/scan-sequence-timing.ts` to include `chloe_scan` in the movie rotation:
```typescript
// Add to ASCII_MOVIES array:
{ path: '/ascii/chloe_scan.json', name: 'chloe_scan', weight: 2 }
```
Higher weight = more likely to be selected. Chloé animation should be the most common.

---

### Task E: Bug Fixes & Quality
**Priority**: MEDIUM
**Estimated effort**: ~30 minutes

#### E.1: Fix `font-400` Bug

**File**: `components/scan/slide-sidebar.tsx`, line 161
**Fix**: Replace `font-400` with `font-normal`

#### E.2: Run Lint

```bash
npm run lint --workspace=apps/web
```

Fix any errors/warnings. Common expected issues:
- Unused imports from old code
- `img` tags without `alt` (use `next/image` or add alt)
- `a` tags that should be `Link` from `next/link`

#### E.3: Run Full Build Verification

```bash
npm run build --workspace=apps/web
```

Must complete with zero errors.

---

### Task F: Lighthouse & Accessibility Audit
**Priority**: MEDIUM (can defer to next session if time-constrained)
**Estimated effort**: ~1 hour

#### F.1: Lighthouse Performance Audit

Run Lighthouse on key pages via Chrome DevTools or Playwright:
- `/` (landing page) — target ≥ 90 performance
- `/scan/[id]` (dashboard with real data) — target ≥ 85 (charts are heavy)
- `/login` (auth page) — target ≥ 95

**Known risks**:
- CRT scanline overlay (`repeating-linear-gradient`) — should be GPU-composited via `will-change: transform`
- Noise grain SVG filter — verify it's static, not re-rendering per frame
- Custom cursors — may cause layout shifts if not preloaded
- Multiple Google Fonts — verify they're subset and swap-displayed

#### F.2: Accessibility Check

Verify with axe-core or Lighthouse Accessibility score ≥ 90:
- All `<button>` and `<a>` elements are keyboard-focusable
- Windows have `role="dialog"` or `role="region"` with `aria-label`
- Chloé sprite has `aria-hidden="true"` (decorative)
- Color contrast on `--gs-mid` text over `--gs-light` background meets AA (4.5:1)
- `prefers-reduced-motion` disables all CSS animations (already in globals.css, verify it works)

#### F.3: Cross-Browser Spot Check

**Highest risk areas**:
- **OKLCH colors in Safari** — Safari 15+ supports OKLCH, but verify older versions get fallbacks
- **Custom SVG cursors** — Firefox handles them differently, may need `.cur` fallback
- **`backdrop-filter: blur()`** — Used in scan sequence, verify Firefox support
- **CSS `clamp()`** — Used extensively in headings, should work everywhere modern

---

### Task G: Deferred Easter Eggs (LOW PRIORITY)
**Estimated effort**: ~3 hours total
**Recommendation**: Defer to a future session unless time permits

#### G.1: Pixel Sweep (Minesweeper Variant)

A small minesweeper game where:
- The grid corresponds to real module findings
- "Mines" are critical-severity findings
- Clicking a "mine" reveals the actual issue text
- Win condition = flag all critical findings

**File**: `components/os/pixel-sweep.tsx`
**Integration**: Hidden "Games" folder on desktop, accessible via Start Menu > Programs > Games

#### G.2: Mobile Simplified Fallback

For users who dismiss the MobileGate:
- Single-column layout, no OS chrome
- Each module as a collapsible card
- MarketingIQ score hero at top
- Chloé floating avatar bottom-right
- Chat as full-screen overlay

This is a significant layout alternative and should be its own task.

#### G.3: Tablet Landscape Detection

Add to MobileGate:
```tsx
// Allow landscape tablets (iPad Pro landscape = 1024px+)
const isTabletLandscape = window.innerWidth >= 1024 && window.innerHeight < window.innerWidth;
if (isTabletLandscape) return <>{children}</>; // serve full experience
```

---

## 4. Execution Protocol

```
FOR EACH TASK (A through F):
  1. Mark task in_progress (TaskUpdate)
  2. FOR EACH file in the task:
     a. Read the existing file
     b. Apply changes (Edit for targeted replacements, Write for full rewrites)
     c. Verify the change is correct (no collateral damage)
  3. After completing all files in the task:
     a. Run typecheck: npx tsc --noEmit --project apps/web/tsconfig.json
     b. IF errors → fix immediately, re-run until clean
     c. Mark task completed (TaskUpdate)
  4. After all tasks:
     a. Run full build: npm run build --workspace=apps/web
     b. Run lint: npm run lint --workspace=apps/web
     c. Fix any issues, re-verify
     d. Final typecheck confirmation
```

---

## 5. Verification Checklist

After all tasks complete, verify:

- [ ] `npx tsc --noEmit --project apps/web/tsconfig.json` — zero errors
- [ ] `npm run build --workspace=apps/web` — builds successfully
- [ ] `npm run lint --workspace=apps/web` — zero errors (warnings acceptable)
- [ ] No hardcoded hex colors remain in `components/charts/*.tsx` (grep for `#[0-9A-Fa-f]{6}`)
- [ ] No `font-heading` class remains outside `components/report/` (grep to verify)
- [ ] No `font-400` / `font-700` / `font-800` remain outside `components/report/`
- [ ] Favicon loads in browser (`/favicon.ico` or `/icon.svg`)
- [ ] OG image renders when sharing URL (test with https://opengraph.xyz)
- [ ] Radio.exe icon opens the player on dashboard
- [ ] Sound effects fire when enabled (test: enable sounds, click bevel button)
- [ ] Mobile gate appears on viewport < 768px on dashboard pages
- [ ] Konami code triggers Chloé celebration (↑↑↓↓←→←→BA)
- [ ] Console shows ASCII Chloé art + hiring message

---

## 6. File Index — All Files to Touch

| # | File | Task | Action |
|---|------|------|--------|
| 1 | `apps/web/lib/chart-config.ts` | A.1 | Add new color dicts + OKLCH_INLINE |
| 2-25 | `apps/web/components/charts/*.tsx` (24 files) | A.2-A.5 | Replace hex → OKLCH, extract local dicts |
| 26 | `apps/web/components/scan/module-card.tsx` | B.1 | Replace 7 old tokens |
| 27 | `apps/web/components/scan/slide-sidebar.tsx` | B.2 + E.1 | Replace 3 tokens + fix font-400 bug |
| 28 | `apps/web/app/auth/error/page.tsx` | B.3 | Full rewrite with GhostScan OS |
| 29 | `apps/web/app/unsubscribed/page.tsx` | B.4 | Full rewrite with GhostScan OS |
| 30 | `apps/web/app/(dashboard)/report/[id]/page.tsx` | B.5 | Replace 1 token |
| 31 | `apps/web/components/scan/bento-dashboard.tsx` | C.1 | Wire Radio.exe onOpen |
| 32 | `apps/web/components/os/window.tsx` | C.2 | Add sound effect calls |
| 33 | `apps/web/components/scan/scan-progress.tsx` | C.2 | Add sound effect calls |
| 34 | `apps/web/components/chat/chat-interface.tsx` | C.2 | Add sound effect calls |
| 35 | `apps/web/components/scan/unlock-overlay.tsx` | C.2 | Add sound effect call |
| 36 | `apps/web/components/os/menu-bar.tsx` | C.2 | Wire volume toggle to soundEffects.toggle() |
| 37 | `apps/web/components/os/radio-player.tsx` | C.2 | Enable sound effects on play |
| 38 | `apps/web/app/(dashboard)/layout.tsx` | C.3 | Wrap in MobileGate |
| 39 | `apps/web/app/icon.svg` | D.1 | NEW: Pixel ghost favicon |
| 40 | `apps/web/app/apple-icon.png` | D.1 | NEW: iOS icon |
| 41 | `apps/web/app/opengraph-image.tsx` | D.2 | NEW: Dynamic OG image |
| 42 | `public/ascii/chloe_scan.json` | D.3 | NEW: Chloé ASCII animation frames |
| 43 | `apps/web/lib/scan-sequence-timing.ts` | D.3 | Add chloe_scan to movie rotation |

**Total: 43 file operations across 6 tasks**

---

## 7. Out of Scope Reminder

The following are **explicitly NOT part of this plan** and should not be touched:

- `components/report/*` (27 files) — McKinsey PDF design, Phase 10
- Module-specific chart layouts — Phase 9
- Pixel Sweep / Stack Stacker games — deferred easter eggs
- E2E test suite updates — separate task
- Backend/engine changes — zero backend impact in this plan
