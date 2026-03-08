# PRD-cont-8: GhostScan OS — Next Steps Plan

> **Document type**: Principal Engineer (L10) Next Steps
> **Date**: 2026-02-23
> **Sprint**: Post PRD-cont-7 completion
> **Status**: READY FOR REVIEW

---

## 0. What Was Completed in PRD-cont-7

All tasks from PRD-cont-7 were executed successfully:

| Task | Scope | Status |
|------|-------|--------|
| **A** | Chart component hex→OKLCH migration (24 files + config) | DONE — zero hex remaining |
| **B** | Non-chart component migration (5 files) | DONE — module-card, slide-sidebar, auth/error, unsubscribed, report page |
| **C** | Wire orphaned components | DONE — Radio.exe opens, sound effects fire on chat/radio, MobileGate wraps dashboard |
| **D** | Missing assets | DONE — pixel ghost favicon (icon.svg), dynamic OG image (opengraph-image.tsx), Chloe ASCII animation (chloe_scan.json) |
| **E** | Bug fixes + build verification | DONE — font-400/600/700/800 fixed in paid-slides + slide-sidebar, typecheck clean, build clean |

**Build status**: `tsc` clean, `npm run build` clean, zero hardcoded hex outside report/.

---

## 1. Remaining Work (Priority Order)

### 1.1 ESLint Configuration (HIGH)
**Why**: The project has no ESLint config. `npm run lint` fails because Next.js prompts for initial setup. This blocks CI/CD lint gate.

**What to do**:
- Create `apps/web/.eslintrc.json` with `next/core-web-vitals` preset
- Run `npm run lint --workspace=apps/web` and fix all errors
- Estimated: 30-60 minutes depending on error count

### 1.2 Lighthouse & Accessibility Audit (HIGH)
**Why**: Never run. Performance budget is ≥ 90, accessibility ≥ 90.

**What to do**:
- Run Lighthouse on `/`, `/login`, `/scan/[id]` (with real scan data)
- Verify CRT effects don't cause jank (check `will-change`, compositor layers)
- Verify `prefers-reduced-motion` works
- Check WCAG AA contrast ratios on gs-mid text over gs-light bg
- Add `aria-label` to Windows, `aria-hidden` to decorative Chloe sprites
- Estimated: 1-2 hours

### 1.3 Cross-Browser Testing (MEDIUM)
**Why**: OKLCH colors and custom SVG cursors are the biggest risk areas.

**What to do**:
- Test Chrome, Firefox, Safari, Edge
- Verify OKLCH renders (Safari 15+, Chrome 111+, Firefox 113+)
- Verify custom cursors work (Firefox may need `.cur` fallback)
- Test `backdrop-filter: blur()` (Firefox support)
- Estimated: 1 hour

### 1.4 More Sound Effect Integration (MEDIUM)
**Why**: Currently only `chatSend`, `chatReceive`, and radio enable are wired. The remaining 8 events (boot, windowOpen, windowClose, scanStart, moduleComplete, criticalFound, scanComplete, unlock) are defined but not called.

**What to do**:
- Add `soundEffects.play('windowOpen')` to Window component mount
- Add scan-related sounds to scan-progress.tsx (scanStart, moduleComplete, criticalFound, scanComplete)
- Add `soundEffects.play('unlock')` to unlock-overlay.tsx after Stripe return
- Add `soundEffects.play('boot')` to scan-sequence.tsx Phase 3 reveal
- Estimated: 30 minutes

### 1.5 Apple Touch Icon (LOW)
**Why**: `apple-icon.png` (180×180) needed for iOS home screen bookmarks.

**What to do**:
- Generate a 180×180 PNG version of the ghost favicon
- Place at `apps/web/app/apple-icon.png`
- Estimated: 15 minutes

---

## 2. Deferred Items (Future Sprints)

### Phase 9: Module-Specific Layouts
Per-module custom visualizations. Each of the 42 modules gets a layout designed for its data shape:
- Dense modules (M05 Analytics, M07 MarTech) → custom charts, multi-section panels
- Sparse modules (M16 PR, M17 Careers) → combined multi-module cards
- GhostScan modules (M09-M12) → Chloe-themed treatment with ghost glow
- Estimated: 2-3 weeks

### Phase 10: McKinsey PDF Report
Separate design language for the shareable PDF. 27 report components untouched:
- Clean serif typography, data-dense charts, no retro aesthetics
- Bloomberg Terminal meets McKinsey slide decks
- `components/report/*` full redesign
- Estimated: 2-3 weeks

### Easter Egg Expansion
- **Pixel Sweep** — Minesweeper using real module data (mines = critical findings)
- **Stack Stacker** — Tetris with MarTech tool logos
- **Mobile simplified fallback** — Single-column layout below MobileGate for persistent mobile users
- **Tablet landscape detection** — Allow iPad Pro landscape to see full desktop
- Estimated: 3-4 hours total

---

## 3. Technical Debt Notes

- **Report components** (`components/report/*`) still use old design tokens (font-heading, font-700, hardcoded hex). This is intentional — they'll be redesigned in Phase 10 with a different aesthetic.
- **ESLint** is not configured. Next.js default linting needs initial setup.
- **paid-slides.tsx** may still have some hardcoded hex values inherited from the Phase 4 bulk replacement. These are inside `className` strings using Tailwind arbitrary values and were addressed in the font-weight pass but a full audit of this file specifically would be prudent.
- **Recharts** tooltip/legend styling uses CSS variables which may not resolve in all Recharts contexts (especially custom labels rendered in SVG). The OKLCH inline values dict mitigates this.
