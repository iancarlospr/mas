/**
 * Boss Deck CSS — extracted from boss-deck-html.ts for reuse by both
 * the React component view and the HTML string renderer.
 *
 * Uses .bd-page instead of .page to avoid collision with global styles.
 */

export const BOSS_DECK_CSS = `
/* ── Reset & Page ─────────────────────────────────── */
@page { size: 14in 8.5in; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important; }
html, body { width: 14in; background: #0A0E1A; }
body { font-family: 'DM Sans', system-ui, sans-serif; font-size: 13px; color: #1E293B; }

/* ── Page base ────────────────────────────────────── */
.bd-page {
  width: 14in; height: 8.5in; position: relative; overflow: hidden;
  page-break-after: always; break-inside: avoid;
}
.bd-page:last-child { page-break-after: auto; }
.dark-page { background: #0A0E1A; color: #E2E8F0; }
.light-page { background: #F8FAFC; color: #1E293B; }
.page-inner { padding: 0.6in 0.75in; height: calc(100% - 36px); position: relative; z-index: 2; }

/* ── Shared ───────────────────────────────────────── */
/* Grain overlays — now canvas-based (GrainCanvas component), CSS kept for layout */

.slide-footer {
  position: absolute; bottom: 0; left: 0; right: 0; height: 36px;
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 0.75in; font-size: 11px; letter-spacing: 0.04em;
  font-family: 'DM Sans', sans-serif; z-index: 10;
  overflow: hidden;
}
.slide-footer > span, .slide-footer > div { position: relative; z-index: 1; }
.slide-footer.footer-dark { position: absolute; }
.footer-dark {
  background: linear-gradient(135deg, rgba(6,10,20,0.8) 0%, rgba(10,22,40,0.75) 30%, rgba(14,31,58,0.75) 60%, rgba(10,22,40,0.8) 100%);
}
.footer-light {
  background: linear-gradient(135deg, #DFE3EA 0%, #E4E8EF 25%, #EAECF0 50%, #E4E8EF 75%, #DFE3EA 100%);
  position: relative;
}
.footer-light::before {
  content: ''; position: absolute; top: -50%; left: -5%; width: 45%; height: 200%;
  background: radial-gradient(ellipse at center, rgba(59,130,246,0.06) 0%, rgba(148,163,184,0.12) 30%, transparent 60%);
  pointer-events: none;
}
.footer-light::after {
  content: ''; position: absolute; top: -50%; right: 0; width: 35%; height: 200%;
  background: radial-gradient(ellipse at center, rgba(201,169,110,0.08) 0%, rgba(148,163,184,0.06) 30%, transparent 55%);
  pointer-events: none;
}

/* Section headers */
.section-header-light, .section-header-dark {
  display: flex; align-items: center; gap: 16px; margin-bottom: 8px;
}
.section-number {
  font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 800;
  color: #3B82F6; letter-spacing: 0.02em;
}
.section-label {
  font-family: 'Sora', sans-serif; font-size: 10px; font-weight: 700;
  letter-spacing: 0.2em; color: #94A3B8; text-transform: uppercase;
}
.section-number-dark {
  font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 800;
  color: #3B82F6;
}
.section-label-dark {
  font-family: 'Sora', sans-serif; font-size: 10px; font-weight: 700;
  letter-spacing: 0.2em; color: #64748B; text-transform: uppercase;
}

/* Titles */
.title-light {
  font-family: 'Sora', sans-serif; font-size: 36px; font-weight: 800;
  color: #0F172A; line-height: 1.1; margin-bottom: 16px;
  letter-spacing: -0.02em;
}
.title-dark {
  font-family: 'Sora', sans-serif; font-size: 36px; font-weight: 800;
  color: #FFFFFF; line-height: 1.1; margin-bottom: 20px;
  letter-spacing: -0.02em;
}

/* ═══ COVER ═══════════════════════════════════════ */
.cover-page { position: relative; }
.cover-bg {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; z-index: 0;
}
.cover-gradient {
  position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(
    105deg,
    rgba(10,14,26,0.92) 0%,
    rgba(10,14,26,0.85) 35%,
    rgba(10,14,26,0.55) 60%,
    rgba(10,14,26,0.25) 80%,
    rgba(10,14,26,0.15) 100%
  );
}
.cover-accent-line {
  position: absolute; top: 0; left: 0; right: 0; height: 4px; z-index: 3;
  background: linear-gradient(90deg, #3B82F6 0%, #60A5FA 30%, #F59E0B 70%, #3B82F6 100%);
}
.cover-content {
  position: relative; z-index: 2; height: calc(100% - 44px);
  display: flex; align-items: center;
}
.cover-left {
  width: 55%; padding: 0 0.75in;
}
.cover-type-label {
  font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 600;
  letter-spacing: 0.25em; text-transform: uppercase;
  color: rgba(255,255,255,0.45); margin-bottom: 16px;
}
.cover-business-name {
  font-family: 'Sora', sans-serif; font-size: 72px; font-weight: 800;
  color: #FFFFFF; line-height: 1.0; margin-bottom: 24px;
  letter-spacing: -0.04em;
  text-shadow: 0 2px 30px rgba(0,0,0,0.4);
}
.cover-divider {
  width: 64px; height: 3px; border-radius: 2px; margin-bottom: 20px;
  background: linear-gradient(90deg, #3B82F6, #60A5FA);
}
.cover-subtitle {
  font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 400;
  color: rgba(255,255,255,0.65); max-width: 440px; line-height: 1.6;
}
.cover-bottom-bar {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 3;
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 0.75in; height: 44px;
  font-family: 'DM Sans', sans-serif; font-size: 11px;
  color: rgba(255,255,255,0.45);
  background: linear-gradient(135deg, rgba(6,10,20,0.75) 0%, rgba(10,22,40,0.7) 30%, rgba(14,31,58,0.7) 60%, rgba(10,22,40,0.75) 100%);
  backdrop-filter: blur(8px);
  overflow: hidden; z-index: 10;
}
.cover-bottom-bar > span { position: relative; z-index: 1; }
.cover-bottom-bar::before {
  content: ''; position: absolute; top: -50%; left: -5%; width: 40%; height: 200%;
  background: radial-gradient(ellipse at center, rgba(59,130,246,0.06) 0%, transparent 60%);
  pointer-events: none;
}
.cover-bottom-bar::after {
  content: ''; position: absolute; top: -50%; right: 0; width: 30%; height: 200%;
  background: radial-gradient(ellipse at center, rgba(201,169,110,0.04) 0%, transparent 55%);
  pointer-events: none;
}
.cover-powered { font-style: italic; }

/* ═══ WINS v4 — Full dark page, same language as Issues/Impact ═══ */

/* Full-bleed warm dark background — charcoal/grey with gold glow */
.wins-page-dark { position: relative; }
.wins-plasma {
  position: absolute; inset: 0; z-index: 0;
  background: linear-gradient(135deg, #0C0C0E 0%, #141418 20%, #1A1A20 40%, #1E1E26 55%, #141418 75%, #0C0C0E 100%);
}
.wins-glow-1 {
  position: absolute; z-index: 0; pointer-events: none;
  top: -10%; left: -5%; width: 60%; height: 60%;
  background: radial-gradient(ellipse at center, rgba(201,169,110,0.08) 0%, transparent 65%);
}
.wins-glow-2 {
  position: absolute; z-index: 0; pointer-events: none;
  bottom: -15%; right: -10%; width: 55%; height: 55%;
  background: radial-gradient(ellipse at center, rgba(245,158,11,0.05) 0%, transparent 55%);
}
.wins-grain {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
}
.wins-inner {
  z-index: 2;
  display: flex; flex-direction: column;
}
.wins-section-num {
  font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 800;
  color: #C9A96E;
}
.wins-title-sm {
  font-size: 28px !important; margin-bottom: 6px !important; line-height: 1.1;
}
.wins-narrative {
  font-size: 13px; color: #94A3B8; line-height: 1.6;
  margin-bottom: 24px; max-width: 10in;
}
.str-pill {
  display: inline-block; font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  padding: 4px 12px; border-radius: 4px; white-space: nowrap;
}

/* Widget grid — flat on dark page, no container card */
.wins-widget-grid {
  display: grid; gap: 20px;
}
.widget {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px; padding: 20px 24px;
}
.widget-hdr {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.widget-title {
  font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 0.14em; color: #64748B; text-transform: uppercase;
}
.widget-status {
  font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  padding: 3px 10px; border-radius: 4px;
}
.widget-status-good {
  background: rgba(34,197,94,0.15); color: #22C55E;
}
.widget-status-blue {
  background: rgba(201,169,110,0.15); color: #C9A96E;
}
.widget-badge {
  font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 0.08em; padding: 3px 10px; border-radius: 4px;
  background: rgba(201,169,110,0.15); color: #C9A96E;
}

/* CWV gauges */
.cwv-row { display: flex; justify-content: center; gap: 24px; }
.cwv-gauge { text-align: center; }
.cwv-val {
  font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 800;
  margin-top: -2px; line-height: 1;
}
.cwv-lbl {
  font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 0.12em; color: #64748B; margin-top: 2px;
}

/* Paid ads */
.ads-hero {
  font-family: 'Sora', sans-serif; font-size: 36px; font-weight: 800;
  color: #FFFFFF; line-height: 1; text-align: center; margin-bottom: 6px;
}
.ads-platforms { margin-top: 10px; }
.ads-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: #CBD5E1; font-weight: 500;
  padding: 4px 0; border-top: 1px solid rgba(255,255,255,0.06);
}
.ads-row:first-child { border-top: none; }
.ads-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.ads-name { flex: 1; }
.ads-count {
  font-family: 'Sora', sans-serif; font-weight: 700; color: #C9A96E; font-size: 13px;
}
.ads-pixels {
  font-size: 11px; color: #475569; margin-top: 8px;
  padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.06);
}

/* Sentiment */
.sentiment-total {
  font-family: 'Sora', sans-serif; font-size: 32px; font-weight: 800;
  color: #FFFFFF; line-height: 1; text-align: center;
}
.sentiment-sub-label {
  font-size: 10px; font-weight: 500; letter-spacing: 0.08em;
  color: #64748B; text-align: center; margin-top: 2px;
}
.sentiment-bar {
  display: flex; height: 7px; border-radius: 4px; overflow: hidden;
  background: rgba(255,255,255,0.08); gap: 1px; margin: 10px 0 6px;
}
.sentiment-legend {
  display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;
}
.sent-pos { color: #22C55E; }
.sent-neg { color: #EF4444; }

/* Traffic */
.traffic-hero {
  font-family: 'Sora', sans-serif; font-size: 36px; font-weight: 800;
  color: #FFFFFF; line-height: 1; text-align: center;
}
.traffic-tier {
  font-size: 10px; color: #64748B; text-align: center;
  letter-spacing: 0.04em; margin: 2px 0 10px;
}
.traffic-bar-wrap { margin-bottom: 4px; }
.traffic-bar {
  display: flex; height: 6px; border-radius: 3px; overflow: hidden;
  background: rgba(255,255,255,0.06);
}
.traffic-bar-org { background: #22C55E; border-radius: 3px 0 0 3px; }
.traffic-bar-paid { background: #F59E0B; border-radius: 0 3px 3px 0; }
.traffic-legend {
  display: flex; justify-content: space-between; margin-top: 6px;
  font-size: 11px; font-weight: 600; color: #CBD5E1;
}
.traf-org, .traf-paid { display: flex; align-items: center; gap: 5px; }
.traf-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.traffic-country {
  font-size: 12px; color: #64748B; text-align: center; margin-top: 8px;
  padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.06);
}
.country-code {
  font-family: 'Sora', sans-serif; font-weight: 800; color: #FFFFFF; font-size: 14px;
  margin-left: 4px;
}

/* Top keyword */
.kw-name {
  font-family: 'Source Code Pro', monospace; font-size: 18px; font-weight: 700;
  color: #FFFFFF; text-align: center; line-height: 1.2;
  word-break: break-word; margin-bottom: 8px;
}
.kw-meta {
  display: flex; justify-content: center; align-items: center; gap: 8px;
}
.kw-vol, .kw-total {
  font-size: 11px; color: #64748B;
}
.kw-sep { color: #334155; }

/* ── AI stat cards — frosted glass on dark, same as outcome cards ── */
.wins-stats-row {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
  margin-top: auto;
}
.stat-card-win {
  padding: 20px 24px; border-radius: 12px;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
}
.stat-val-win {
  font-family: 'Sora', sans-serif; font-size: 28px; font-weight: 800;
  color: #0F172A; line-height: 1; letter-spacing: -0.02em;
  margin-bottom: 6px;
}
.stat-lbl-win {
  font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: #C9A96E; margin-bottom: 6px;
}
.stat-ctx-win {
  font-size: 12px; color: #475569; line-height: 1.45;
}

/* ═══ ISSUES ══════════════════════════════════════ */
.issues-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
  margin-top: 8px;
}
.issue-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px; padding: 28px;
  display: flex; flex-direction: column;
}
.issue-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.issue-num {
  font-family: 'Sora', sans-serif; font-size: 32px; font-weight: 800;
  color: #3B82F6; line-height: 1;
}
.urgency-tag {
  font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 0.1em; padding: 4px 10px; border-radius: 4px;
}
.issue-headline {
  font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700;
  color: #FFFFFF; line-height: 1.3; margin-bottom: 12px;
}
.issue-explanation {
  font-size: 13px; color: #94A3B8; line-height: 1.6; flex: 1;
  margin-bottom: 16px;
}
.issue-impact {
  display: flex; gap: 10px; align-items: flex-start;
  padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08);
}
.impact-icon {
  font-size: 14px; color: #F59E0B; font-weight: 700; flex-shrink: 0;
  width: 20px; height: 20px; display: flex; align-items: center;
  justify-content: center; background: rgba(245,158,11,0.15);
  border-radius: 4px;
}
.impact-text {
  font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
  color: #F59E0B; line-height: 1.4;
}

/* ═══ ROADMAP ═════════════════════════════════════ */
.roadmap-summary {
  font-size: 14px; color: #475569; line-height: 1.6;
  margin-bottom: 20px; max-width: 10in;
}
.initiatives-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;
  margin-bottom: 24px;
}
.initiative-card {
  display: flex; border-radius: 8px; overflow: hidden;
  background: #FFFFFF; border: 1px solid #E2E8F0;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.init-accent {
  width: 4px; flex-shrink: 0;
}
.init-content { padding: 16px; flex: 1; display: flex; flex-direction: column; }
.init-owner {
  font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 6px;
  display: block;
}
.init-name {
  font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700;
  color: #0F172A; line-height: 1.25; margin-bottom: 8px;
}
.init-items {
  list-style: none; padding: 0; margin-bottom: 12px; flex: 1;
}
.init-items li {
  font-size: 12px; color: #475569; line-height: 1.5; padding: 2px 0;
  padding-left: 14px; position: relative;
}
.init-items li::before {
  content: '→'; position: absolute; left: 0; color: #94A3B8;
}
.init-meta {
  display: flex; gap: 8px; font-size: 11px; flex-wrap: wrap;
}
.init-effort {
  font-weight: 700; color: #0F172A;
  padding: 2px 8px; background: #F1F5F9; border-radius: 4px;
}
.init-outcome { color: #64748B; font-style: italic; }

/* Timeline */
.timeline-section { position: relative; padding-top: 4px; }
.timeline-track {
  display: flex; position: relative; z-index: 1;
}
.timeline-line {
  position: absolute; top: 19px; left: 4px; right: 4px; height: 2px;
  background: linear-gradient(90deg, #EF4444, #F59E0B, #3B82F6, #64748B);
  border-radius: 1px; z-index: 0;
}
.timeline-phase { padding-right: 16px; }
.tl-dot {
  width: 10px; height: 10px; border-radius: 50%; margin-bottom: 8px;
  position: relative; z-index: 2;
  box-shadow: 0 0 0 3px #F8FAFC;
}
.tl-label {
  font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 6px;
}
.tl-item { font-size: 11px; color: #475569; line-height: 1.5; }

/* Actions band — bottom 20% of roadmap page */
.actions-band {
  position: absolute; bottom: 36px; left: 0; right: 0; z-index: 3;
  background: linear-gradient(135deg, #060A14 0%, #0A1628 30%, #0E1F3A 60%, #0A1628 100%);
  padding: 20px 0.75in;
  border-top: 3px solid #3B82F6;
  overflow: hidden;
}
/* Radial glows inside the band */
.actions-band::before {
  content: ''; position: absolute; top: -40%; left: -5%; width: 45%; height: 180%;
  background: radial-gradient(ellipse at center, rgba(59,130,246,0.08) 0%, transparent 60%);
  pointer-events: none;
}
.actions-band::after {
  content: ''; position: absolute; top: -30%; right: 0; width: 35%; height: 160%;
  background: radial-gradient(ellipse at center, rgba(201,169,110,0.05) 0%, transparent 55%);
  pointer-events: none;
}
.actions-inner {
  display: flex; align-items: flex-start; gap: 40px;
  position: relative; z-index: 1;
}
.actions-left {
  display: flex; align-items: center; gap: 14px; flex-shrink: 0;
  min-width: 220px;
}
.actions-icon {
  width: 44px; height: 44px; border-radius: 10px;
  background: linear-gradient(135deg, #3B82F6, #2563EB);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(59,130,246,0.3);
}
.actions-title-block { }
.actions-label {
  font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 800;
  letter-spacing: 0.15em; color: #3B82F6;
}
.actions-subtitle {
  font-family: 'DM Sans', sans-serif; font-size: 12px;
  color: #64748B; margin-top: 2px;
}
.actions-list {
  display: flex; flex-direction: column; gap: 6px; flex: 1;
}
.action-item {
  display: flex; align-items: baseline; gap: 12px;
}
.action-num {
  font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 800;
  color: #3B82F6; flex-shrink: 0;
  width: 22px; height: 22px; border-radius: 50%;
  border: 1.5px solid rgba(59,130,246,0.3);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
}
.action-text {
  font-family: 'DM Sans', sans-serif; font-size: 13px;
  color: #E2E8F0; line-height: 1.4;
}

/* ═══ RESULTS ═════════════════════════════════════ */
.results-page { position: relative; background: #060A14; }

/* Layer 1: Deep gradient base */
.results-plasma {
  position: absolute; inset: 0; z-index: 0;
  background: linear-gradient(
    135deg,
    #060A14 0%,
    #0A1628 20%,
    #0C1A30 40%,
    #0E1F3A 55%,
    #0A1628 75%,
    #060A14 100%
  );
}

/* Layer 2-4: Radial color glows */
.results-glow-1 {
  position: absolute; z-index: 0; pointer-events: none;
  top: -10%; left: -5%; width: 60%; height: 60%;
  background: radial-gradient(ellipse at center, rgba(59,130,246,0.08) 0%, transparent 65%);
}
.results-glow-2 {
  position: absolute; z-index: 0; pointer-events: none;
  bottom: -15%; right: -10%; width: 55%; height: 55%;
  background: radial-gradient(ellipse at center, rgba(245,158,11,0.06) 0%, transparent 55%);
}
.results-glow-3 {
  position: absolute; z-index: 0; pointer-events: none;
  top: 20%; right: 5%; width: 35%; height: 50%;
  background: radial-gradient(ellipse at center, rgba(201,169,110,0.05) 0%, transparent 55%);
}

/* Layer 5: Noise grain — canvas-based */
.results-grain {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
}

/* Layer 6: Vignette */
.results-vignette {
  position: absolute; top: 0; left: 0; right: 0; bottom: 36px;
  z-index: 1; pointer-events: none;
  background: radial-gradient(ellipse 85% 80% at 50% 45%, transparent 0%, rgba(6,10,20,0.3) 55%, rgba(6,10,20,0.7) 100%);
}

/* Gold accent line at top */
.results-gold-line {
  position: absolute; top: 0; left: 0; right: 0; height: 3px; z-index: 2;
  background: linear-gradient(90deg, transparent 5%, rgba(201,169,110,0.5) 25%, rgba(245,158,11,0.7) 50%, rgba(201,169,110,0.5) 75%, transparent 95%);
  box-shadow: 0 0 20px rgba(245,158,11,0.15), 0 2px 12px rgba(245,158,11,0.1);
}

.results-inner { z-index: 2; }

.projection-table { margin-bottom: 24px; }
.proj-header {
  display: grid; grid-template-columns: 200px 80px 80px 1fr;
  gap: 8px; padding: 10px 16px; margin-bottom: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.proj-h-cat, .proj-h-note {
  font-family: 'Sora', sans-serif; font-size: 10px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; color: #64748B;
}
.proj-h-now {
  font-family: 'Sora', sans-serif; font-size: 10px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; color: #EF4444;
  text-align: center;
}
.proj-h-after {
  font-family: 'Sora', sans-serif; font-size: 10px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; color: #22C55E;
  text-align: center;
}
.proj-row {
  display: grid; grid-template-columns: 200px 80px 80px 1fr;
  gap: 8px; align-items: center; padding: 10px 16px;
  border-radius: 6px;
  background: rgba(255,255,255,0.04);
  margin-bottom: 3px;
  border-left: 3px solid transparent;
  transition: background 0.15s;
}
.proj-row:nth-child(odd) { background: rgba(255,255,255,0.02); }
.proj-row:hover { background: rgba(255,255,255,0.07); }
.proj-cat {
  font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
  color: #FFFFFF;
}
.proj-light { text-align: center; }
.proj-dot-ring {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  border: 1.5px solid;
}
.proj-dot {
  display: inline-block; width: 10px; height: 10px; border-radius: 50%;
}
.proj-note { font-size: 12px; color: #94A3B8; }

.outcomes-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px;
}
.outcome-card {
  display: flex; gap: 12px; padding: 18px; border-radius: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(201,169,110,0.12);
  backdrop-filter: blur(6px);
}
.outcome-accent {
  width: 3px; border-radius: 2px; flex-shrink: 0;
  align-self: stretch;
  background: linear-gradient(180deg, #F59E0B, #C9A96E);
}
.outcome-body { flex: 1; }
.outcome-text {
  font-size: 13px; font-weight: 600; color: #FFFFFF; line-height: 1.4;
  margin-bottom: 4px;
}
.outcome-evidence { font-size: 12px; color: #64748B; line-height: 1.4; }

/* ═══ TOOLS ═══════════════════════════════════════ */
.tools-grid {
  display: flex; flex-direction: column; gap: 16px; margin-top: 8px;
}
.tool-card {
  display: grid; grid-template-columns: 1fr 48px 1.5fr;
  align-items: center; gap: 0;
  border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden;
  background: #FFFFFF; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.tool-left {
  padding: 20px 24px;
  background: #F1F5F9;
  height: 100%; display: flex; flex-direction: column; justify-content: center;
}
.tool-arrow {
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(90deg, #F1F5F9, #FFFFFF);
}
.tool-right {
  padding: 20px 24px;
}
.tool-label {
  font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 0.15em; text-transform: uppercase; color: #94A3B8;
  margin-bottom: 6px;
}
.tool-current-name {
  font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 700;
  color: #0F172A;
}
.tool-no-coverage { color: #94A3B8; font-style: italic; }
.tool-gap-dot { color: #EF4444; font-size: 12px; margin-top: 4px; }
.tool-rec-name {
  font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 700;
  color: #3B82F6; margin-bottom: 6px;
}
.tool-pitch { font-size: 13px; color: #475569; line-height: 1.5; }
.tool-gap-row {
  grid-column: 1 / -1; font-size: 12px; color: #64748B;
  padding: 0 24px 12px; font-style: italic;
  border-top: 1px solid #F1F5F9;
  padding-top: 10px;
}

/* ═══ CLOSER — Certificate style (opus magnus) ═══ */
.closer-page { position: relative; background: #040610; }

/* Horizon image as blurred texture base */
.closer-bg {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; z-index: 0;
  filter: blur(30px) saturate(0.4) brightness(0.2);
  transform: scale(1.15);
}

/* Deep gradient overlay */
.closer-plasma {
  position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(
    160deg,
    rgba(4,6,16,0.85) 0%,
    rgba(8,14,32,0.7) 20%,
    rgba(12,22,44,0.55) 40%,
    rgba(16,28,52,0.5) 50%,
    rgba(12,22,44,0.55) 60%,
    rgba(8,14,32,0.7) 80%,
    rgba(4,6,16,0.85) 100%
  );
}

/* Radial glows — 4 layers for depth */
.closer-glow-blue {
  position: absolute; z-index: 1; pointer-events: none;
  top: -15%; left: -10%; width: 60%; height: 70%;
  background: radial-gradient(ellipse at center, rgba(59,130,246,0.1) 0%, transparent 55%);
}
.closer-glow-gold {
  position: absolute; z-index: 1; pointer-events: none;
  bottom: -20%; right: -10%; width: 65%; height: 65%;
  background: radial-gradient(ellipse at center, rgba(245,158,11,0.08) 0%, rgba(201,169,110,0.03) 40%, transparent 60%);
}
.closer-glow-center {
  position: absolute; z-index: 1; pointer-events: none;
  top: 30%; left: 50%; transform: translate(-50%, -50%);
  width: 50%; height: 50%;
  background: radial-gradient(circle, rgba(99,102,241,0.06) 0%, rgba(59,130,246,0.03) 30%, transparent 55%);
}
.closer-glow-top {
  position: absolute; z-index: 1; pointer-events: none;
  top: -5%; left: 30%; width: 40%; height: 30%;
  background: radial-gradient(ellipse at center, rgba(201,169,110,0.06) 0%, transparent 55%);
}

/* Noise grain — canvas-based */
.closer-grain {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
}

/* Heavy vignette — cinematic edges */
.closer-vignette {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: radial-gradient(
    ellipse 70% 65% at 50% 45%,
    transparent 0%,
    rgba(4,6,16,0.15) 40%,
    rgba(4,6,16,0.5) 65%,
    rgba(4,6,16,0.85) 100%
  );
}

/* Gold accent lines */
.closer-line-top {
  position: absolute; top: 0; left: 0; right: 0; height: 3px; z-index: 3;
  background: linear-gradient(90deg, transparent 10%, rgba(201,169,110,0.4) 30%, rgba(245,158,11,0.6) 50%, rgba(201,169,110,0.4) 70%, transparent 90%);
  box-shadow: 0 0 20px rgba(245,158,11,0.12), 0 2px 8px rgba(245,158,11,0.08);
}
.closer-line-bottom {
  position: absolute; bottom: 50px; left: 10%; right: 10%; height: 1px; z-index: 3;
  background: linear-gradient(90deg, transparent, rgba(59,130,246,0.2) 20%, rgba(201,169,110,0.25) 50%, rgba(59,130,246,0.2) 80%, transparent);
}
.closer-stack {
  position: relative; z-index: 4;
  height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center; padding: 2% 5% 0;
}
.closer-ascii {
  font-family: 'Source Code Pro', monospace; font-size: 8px;
  line-height: 1.1; white-space: pre; color: #3B82F6;
  text-shadow:
    0 0 8px rgba(59,130,246,0.5),
    0 0 20px rgba(59,130,246,0.3),
    0 0 40px rgba(59,130,246,0.15),
    0 0 80px rgba(59,130,246,0.08),
    0 0 160px rgba(59,130,246,0.04);
  margin-bottom: 6px;
}
.closer-subtitle {
  font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
  letter-spacing: 0.25em; text-transform: uppercase;
  color: rgba(148,163,184,0.5); margin-bottom: 20px;
}
.closer-rule {
  width: 25%; height: 1px; margin-bottom: 16px;
  background: linear-gradient(to right, transparent, rgba(201,169,110,0.4), rgba(59,130,246,0.3), transparent);
  box-shadow: 0 0 12px rgba(201,169,110,0.08);
}
.closer-domain-name {
  font-family: 'Sora', sans-serif; font-size: 52px; font-weight: 800;
  letter-spacing: -0.02em; text-transform: uppercase;
  color: #FFFFFF; line-height: 1; margin-bottom: 14px;
  text-shadow: 0 0 40px rgba(255,255,255,0.08);
}
.closer-score-num {
  font-family: 'Sora', sans-serif; font-size: 80px; font-weight: 800;
  line-height: 0.9; margin-bottom: 4px;
  text-shadow: 0 0 30px currentColor;
}
.closer-score-sub {
  font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 700;
  letter-spacing: 0.2em; text-transform: uppercase;
  color: rgba(148,163,184,0.45); margin-bottom: 2px;
}
.closer-score-label {
  font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600;
  letter-spacing: 0.08em; margin-bottom: 16px;
}
.closer-meta {
  font-family: 'Source Code Pro', monospace; font-size: 13px;
  color: rgba(148,163,184,0.4); letter-spacing: 0.12em;
  margin-bottom: 18px;
}
.closer-signoff {
  font-family: 'Permanent Marker', cursive; font-size: 34px;
  color: #C9A96E;
  text-shadow:
    0 0 12px rgba(201,169,110,0.35),
    0 0 30px rgba(201,169,110,0.15),
    0 0 60px rgba(201,169,110,0.06);
  line-height: 1;
}
.closer-footer-text {
  position: absolute; bottom: 54px; left: 0; right: 0; z-index: 4;
  text-align: center;
  font-family: 'Source Code Pro', monospace; font-size: 11px;
  letter-spacing: 0.2em; text-transform: uppercase;
  color: rgba(148,163,184,0.2);
}
.closer-seal {
  position: absolute; z-index: 4; pointer-events: none;
  bottom: 65px; right: 50px; width: 120px; height: 120px;
  opacity: 0.45;
  filter: drop-shadow(0 0 14px rgba(59,130,246,0.15));
}
.closer-dither {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: 50px; z-index: 5; pointer-events: none;
}
`;
