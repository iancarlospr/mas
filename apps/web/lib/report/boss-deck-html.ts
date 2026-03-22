/**
 * Boss Deck v2 — HTML template renderer.
 *
 * 7-page landscape pitch deck with alternating dark/light backgrounds.
 * McKinsey-inspired: bold numbers, split layouts, no card borders.
 * Cover + Closer use AI-generated image for premium feel.
 */

import type { BossDeckAIOutput } from './boss-deck-prompt';

// ── Context ──────────────────────────────────────────────────

export interface BossDeckRenderContext {
  domain: string;
  businessName: string;
  scanDate: string;
  userEmail: string;
  marketingIQ: number | null;
  marketingIQLabel: string | null;
  ai: BossDeckAIOutput | null;
  m42Synthesis: Record<string, unknown> | null;
  m45StackAnalysis: Record<string, unknown> | null;
  categoryScores: { category: string; score: number; light: string }[];
  hasM43: boolean;
  hasM45: boolean;
}

// ── Helpers ──────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

function lightColor(light: string): string {
  if (light === 'green') return '#38A169';
  if (light === 'yellow') return '#D69E2E';
  return '#E53E3E';
}

function ownerColor(owner: string): string {
  const map: Record<string, string> = {
    'Content Team': '#2B6CB0',
    'Dev Team': '#0B1F3F',
    'Marketing Ops': '#B8860B',
    'Design Team': '#6B46C1',
    'Leadership': '#C53030',
  };
  return map[owner] ?? '#4A5568';
}

function footer(pageNum: number, variant: 'dark' | 'light'): string {
  const bg = variant === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)';
  const color = variant === 'dark' ? '#5A6A80' : '#A0AEC0';
  return `<div class="slide-footer" style="background:${bg};color:${color}">
    <span>Confidential — Prepared with AlphaScan</span>
    <span>${String(pageNum).padStart(2, '0')}</span>
  </div>`;
}

// ── Render ───────────────────────────────────────────────────

export function renderBossDeck(ctx: BossDeckRenderContext): string {
  const ai = ctx.ai;
  const domainSafe = esc(ctx.domain);
  const dateFmt = formatDate(ctx.scanDate);

  const coverSubtitle = ai?.cover_subtitle ?? `Marketing Technology Assessment — ${dateFmt}`;
  const winsNarrative = ai?.wins_narrative ?? '';
  const winsHighlights = ai?.wins_highlights ?? [];
  const topIssues = ai?.top_issues ?? [];
  const initiatives = ai?.initiatives ?? [];
  const toolPitches = ai?.tool_pitches ?? [];
  const impactHeadline = ai?.implementation_impact_headline ?? 'What This Means For The Business';
  const impactOutcomes = ai?.implementation_outcomes ?? [];
  const categoryProjections = ai?.category_projections ?? [];
  const timelineSummary = ai?.timeline_summary ?? '';
  const timelineItems = ai?.timeline_items ?? [];
  const nextSteps = ai?.next_steps ?? [];
  const closingMessage = ai?.closing_message ?? 'Ready to move forward when you are.';

  const pages: string[] = [];

  // 1. Cover (DARK)
  pages.push(renderCover(ctx, coverSubtitle, dateFmt));

  // 2. What's Working (LIGHT)
  if (winsHighlights.length > 0) {
    pages.push(renderWins(winsNarrative, winsHighlights, ctx));
  }

  // 3. Top 3 Issues (DARK)
  if (topIssues.length > 0) {
    pages.push(renderIssues(topIssues));
  }

  // 4. Roadmap — Initiatives + Timeline merged (LIGHT)
  if (initiatives.length > 0 || timelineItems.length > 0) {
    pages.push(renderRoadmap(initiatives, timelineSummary, timelineItems, nextSteps));
  }

  // 5. Results — Before/After + Outcomes (DARK)
  if (categoryProjections.length > 0 || impactOutcomes.length > 0) {
    pages.push(renderResults(impactHeadline, impactOutcomes, categoryProjections));
  }

  // 6. Tool Investment (LIGHT) — conditional
  if (toolPitches.length > 0 && ctx.hasM45) {
    pages.push(renderTools(toolPitches));
  }

  // 7. Closer (DARK)
  pages.push(renderCloser(ctx, closingMessage));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Boss Deck — ${domainSafe}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500;600;700&family=Source+Sans+3:wght@300;400;600;700&family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div class="print-banner">
  <span>Boss Deck — ${domainSafe}</span>
  <button onclick="window.print()">Save as PDF</button>
</div>
${pages.join('\n')}
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE 1: COVER (DARK)
// ═══════════════════════════════════════════════════════════════

function renderCover(ctx: BossDeckRenderContext, subtitle: string, dateFmt: string): string {
  const score = ctx.marketingIQ;
  const label = ctx.marketingIQLabel ?? '';
  const scoreColor = score != null && score >= 70 ? '#38A169' : score != null && score >= 40 ? '#D69E2E' : '#E53E3E';

  const imageHtml = `<img class="cover-image" src="/boss-deck-cover.png" alt="" />`;

  return `<div class="page dark-page cover-page">
  <div class="cover-accent-top"></div>
  <div class="cover-layout">
    <div class="cover-left">
      <div class="cover-wordmark">AlphaScan</div>
      <div class="cover-type-label">MARKETING AUDIT BRIEFING</div>
      <div class="cover-business-name">${esc(ctx.businessName || ctx.domain)}</div>
      <div class="cover-gold-line"></div>
      <div class="cover-subtitle">${esc(subtitle)}</div>
      ${score != null ? `
      <div class="cover-meta-row">
        <div class="cover-score">
          <span class="cover-score-num" style="color:${scoreColor}">${score}</span>
          <span class="cover-score-label">MarketingIQ™ · ${esc(label)}</span>
        </div>
      </div>` : ''}
    </div>
    <div class="cover-right">
      ${imageHtml}
    </div>
  </div>
  <div class="cover-bottom">
    <span>Prepared by ${esc(ctx.userEmail)} · ${esc(dateFmt)}</span>
    <span class="cover-powered">Powered by AlphaScan</span>
  </div>
  <div class="cover-accent-bottom"></div>
</div>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE 2: WHAT'S WORKING (LIGHT)
// ═══════════════════════════════════════════════════════════════

function renderWins(narrative: string, highlights: BossDeckAIOutput['wins_highlights'], ctx: BossDeckRenderContext): string {
  const strengths = getStrengths(ctx);

  return `<div class="page light-page">
  <div class="split-layout">
    <div class="split-left" style="width:38%">
      <div class="slide-title-light">Here's What's<br/>Already Working</div>
      <div class="wins-narrative">${esc(narrative)}</div>
      ${strengths.length > 0 ? `
      <div class="wins-strengths">
        ${strengths.map(s => `<div class="strength-row"><span class="strength-dot" style="background:${lightColor(s.light)}"></span>${esc(s.name)}</div>`).join('')}
      </div>` : ''}
    </div>
    <div class="split-right" style="width:60%">
      <div class="wins-metrics-grid">
        ${highlights.map(h => `
        <div class="win-metric">
          <div class="win-metric-value">${esc(h.metric_value)}</div>
          <div class="win-metric-label">${esc(h.metric_label)}</div>
          <div class="win-metric-context">${esc(h.context)}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>
  ${footer(2, 'light')}
</div>`;
}

function getStrengths(ctx: BossDeckRenderContext): { name: string; light: string }[] {
  const strengths: { name: string; light: string }[] = [];
  const assessments = ctx.m42Synthesis?.['category_assessments'] as Record<string, Record<string, unknown>> | undefined;
  if (assessments) {
    for (const [, val] of Object.entries(assessments)) {
      const strArr = val['strengths'] as string[] | undefined;
      if (strArr && strArr.length > 0) {
        const catName = val['category_name'] as string ?? '';
        const matching = ctx.categoryScores.find(c => c.category.toLowerCase().includes(catName.toLowerCase().split(' ')[0] ?? ''));
        if (matching && (matching.light === 'green' || matching.score >= 60)) {
          strengths.push({ name: catName, light: matching.light });
        }
      }
    }
  }
  return strengths.slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════
// PAGE 3: TOP 3 ISSUES (DARK)
// ═══════════════════════════════════════════════════════════════

function renderIssues(issues: BossDeckAIOutput['top_issues']): string {
  return `<div class="page dark-page">
  <div class="split-layout">
    <div class="issues-main">
      <div class="slide-title-dark">Three Things<br/>Holding Us Back</div>
      <div class="issues-list">
        ${issues.map((issue, i) => `
        <div class="issue-row">
          <div class="issue-num">${String(i + 1).padStart(2, '0')}</div>
          <div class="issue-body">
            <div class="issue-headline">${esc(issue.headline)}</div>
            <div class="issue-explanation">${esc(issue.explanation)}</div>
          </div>
        </div>
        ${i < issues.length - 1 ? '<div class="gold-divider"></div>' : ''}`).join('')}
      </div>
    </div>
    <div class="issues-sidebar">
      <div class="sidebar-label">BUSINESS IMPACT</div>
      ${issues.map((issue, i) => `
      <div class="impact-callout">
        <div class="impact-num">${String(i + 1).padStart(2, '0')}</div>
        <div class="impact-text">${esc(issue.dollar_impact)}</div>
      </div>`).join('')}
    </div>
  </div>
  ${footer(3, 'dark')}
</div>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE 4: ROADMAP (LIGHT) — merged initiatives + timeline
// ═══════════════════════════════════════════════════════════════

function renderRoadmap(
  initiatives: BossDeckAIOutput['initiatives'],
  timelineSummary: string,
  timelineItems: BossDeckAIOutput['timeline_items'],
  nextSteps: string[],
): string {
  const phaseColors = ['#C53030', '#C05621', '#2B6CB0', '#718096'];

  return `<div class="page light-page">
  <div class="slide-title-light-full">The Roadmap</div>
  ${timelineSummary ? `<div class="roadmap-summary">${esc(timelineSummary)}</div>` : ''}

  <div class="roadmap-initiatives">
    ${initiatives.map(init => {
      const oc = ownerColor(init.owner);
      return `
    <div class="initiative-block">
      <div class="initiative-bar" style="background:${oc}"></div>
      <div class="initiative-owner" style="background:${oc}">${esc(init.owner)}</div>
      <div class="initiative-name">${esc(init.name)}</div>
      <div class="initiative-items">
        ${init.items.map(item => `<div class="init-item">→ ${esc(item)}</div>`).join('')}
      </div>
      <div class="initiative-meta">
        <span class="init-effort">${esc(init.effort)}</span>
        <span class="init-outcome">${esc(init.expected_outcome)}</span>
      </div>
    </div>`;
    }).join('')}
  </div>

  ${timelineItems.length > 0 ? `
  <div class="timeline-bar">
    <div class="timeline-line"></div>
    ${timelineItems.map((phase, i) => `
    <div class="timeline-phase">
      <div class="timeline-dot" style="background:${phaseColors[i] ?? '#718096'}"></div>
      <div class="timeline-phase-label" style="color:${phaseColors[i] ?? '#718096'}">${esc(phase.phase)}</div>
      <div class="timeline-phase-items">
        ${phase.items.slice(0, 3).map(item => `<div class="tl-item">${esc(item)}</div>`).join('')}
      </div>
    </div>`).join('')}
  </div>` : ''}

  ${nextSteps.length > 0 ? `
  <div class="next-steps-row">
    <span class="ns-label">FIRST ACTIONS:</span>
    ${nextSteps.slice(0, 3).map(s => `<span class="ns-item">${esc(s)}</span>`).join('<span class="ns-sep">·</span>')}
  </div>` : ''}

  ${footer(4, 'light')}
</div>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE 5: RESULTS — BEFORE & AFTER (DARK)
// ═══════════════════════════════════════════════════════════════

function renderResults(
  headline: string,
  outcomes: BossDeckAIOutput['implementation_outcomes'],
  projections: BossDeckAIOutput['category_projections'],
): string {
  return `<div class="page dark-page">
  <div class="slide-title-dark-full">${esc(headline)}</div>

  ${projections.length > 0 ? `
  <div class="comparison-table">
    <div class="comp-header">
      <span class="comp-cat-header">Category</span>
      <span class="comp-now-header">Now</span>
      <span class="comp-after-header">After Implementation</span>
      <span class="comp-note-header">What Changes</span>
    </div>
    ${projections.map(p => `
    <div class="comp-row">
      <span class="comp-cat">${esc(p.category)}</span>
      <span class="comp-now">
        <span class="comp-dot" style="color:${lightColor(p.current_light)}">●</span>
      </span>
      <span class="comp-arrow">→</span>
      <span class="comp-after">
        <span class="comp-dot" style="color:${lightColor(p.projected_light)}">●</span>
      </span>
      <span class="comp-note">${esc(p.explanation)}</span>
    </div>`).join('')}
  </div>` : ''}

  ${outcomes.length > 0 ? `
  <div class="outcomes-section">
    ${outcomes.map(o => `
    <div class="outcome-row">
      <div class="outcome-bar"></div>
      <div class="outcome-content">
        <div class="outcome-text">${esc(o.outcome)}</div>
        <div class="outcome-evidence">${esc(o.evidence)}</div>
      </div>
    </div>`).join('')}
  </div>` : ''}

  ${footer(5, 'dark')}
</div>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE 6: TOOL INVESTMENT (LIGHT)
// ═══════════════════════════════════════════════════════════════

function renderTools(pitches: BossDeckAIOutput['tool_pitches']): string {
  return `<div class="page light-page">
  <div class="slide-title-light-full">Technology Investment Recommendations</div>

  <div class="tools-list">
    ${pitches.map((p, i) => {
      const isReplace = p.what_it_replaces && p.what_it_replaces !== 'New addition';
      return `
    <div class="tool-comparison">
      <div class="tool-current">
        <div class="tool-side-label">${isReplace ? 'CURRENT' : 'GAP'}</div>
        <div class="tool-side-name ${isReplace ? '' : 'tool-gap'}">${isReplace ? esc(p.what_it_replaces) : 'No coverage'}</div>
        ${!isReplace ? `<div class="tool-side-dot-red">●</div>` : ''}
      </div>
      <div class="tool-arrow-col">→</div>
      <div class="tool-proposed">
        <div class="tool-side-label">RECOMMENDED</div>
        <div class="tool-side-name tool-highlight">${esc(p.tool_name)}</div>
        <div class="tool-pitch-text">${esc(p.why_we_need_it)}</div>
      </div>
      <div class="tool-gap-text">${esc(p.capability_gap)}</div>
    </div>
    ${i < pitches.length - 1 ? '<div class="tool-divider"></div>' : ''}`;
    }).join('')}
  </div>

  ${footer(6, 'light')}
</div>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE 7: CLOSER (DARK)
// ═══════════════════════════════════════════════════════════════

function renderCloser(ctx: BossDeckRenderContext, closingMessage: string): string {
  const score = ctx.marketingIQ;
  const label = ctx.marketingIQLabel ?? '';
  const scoreColor = score != null && score >= 70 ? '#38A169' : score != null && score >= 40 ? '#D69E2E' : '#E53E3E';

  const imageHtml = `<img class="closer-image" src="/boss-deck-cover.png" alt="" style="transform:scaleX(-1)" />`;

  return `<div class="page dark-page closer-page">
  <div class="cover-accent-top"></div>
  <div class="cover-layout">
    <div class="cover-right closer-img-container">
      ${imageHtml}
    </div>
    <div class="cover-left closer-right">
      ${score != null ? `
      <div class="closer-score" style="color:${scoreColor}">${score}</div>
      <div class="closer-score-label">MarketingIQ™ · ${esc(label)}</div>
      ` : ''}
      <div class="closer-message">${esc(closingMessage)}</div>
      <div class="closer-domain">${esc(ctx.domain)}</div>
    </div>
  </div>
  <div class="cover-bottom">
    <span></span>
    <span class="cover-powered">Powered by AlphaScan</span>
  </div>
  <div class="cover-accent-bottom"></div>
</div>`;
}

// ═══════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════

const CSS = `
/* ── Reset & Page ─────────────────────────────────── */
@page { size: 14in 8.5in; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important; }
html, body { width: 14in; background: #fff; }
body { font-family: 'Source Sans 3', system-ui, sans-serif; font-size: 13px; }

/* ── Print Banner ─────────────────────────────────── */
.print-banner {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  background: #0B1F3F; color: #E2E8F0; padding: 11px 20px;
  font-size: 13.5px; display: flex; align-items: center;
  justify-content: center; gap: 16px;
  box-shadow: 0 2px 12px rgba(11,31,63,0.3);
}
.print-banner button {
  background: #B8860B; color: #fff; border: none; padding: 7px 24px;
  font-weight: 600; font-size: 13px; border-radius: 3px; cursor: pointer;
  letter-spacing: 0.04em; text-transform: uppercase;
}
.print-banner button:hover { background: #D4A017; }
@media print { .print-banner { display: none; } body { margin-top: 0; } }
@media screen { body { margin-top: 52px; } }

/* ── Page base ────────────────────────────────────── */
.page {
  width: 14in; height: 8.5in; position: relative; overflow: hidden;
  page-break-after: always; break-inside: avoid;
}
.page:last-child { page-break-after: auto; }
.dark-page { background: #0B1F3F; color: #E2E8F0; }
.light-page { background: #FAFBFD; color: #2D3748; }

/* ── Shared ───────────────────────────────────────── */
.split-layout {
  display: flex; height: calc(100% - 32px); /* minus footer */
}
.split-left, .split-right {
  padding: 0.6in 0.55in;
}
.slide-footer {
  position: absolute; bottom: 0; left: 0; right: 0; height: 32px;
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 0.75in; font-size: 10px; letter-spacing: 0.03em;
}
.gold-divider {
  height: 1px; margin: 16px 0;
  background: linear-gradient(90deg, transparent 0%, rgba(184,134,11,0.35) 15%, rgba(184,134,11,0.35) 85%, transparent 100%);
}
.slide-title-dark {
  font-family: 'EB Garamond', Georgia, serif; font-size: 34px; font-weight: 700;
  color: #fff; line-height: 1.15; margin-bottom: 28px;
}
.slide-title-light {
  font-family: 'EB Garamond', Georgia, serif; font-size: 34px; font-weight: 700;
  color: #0B1F3F; line-height: 1.15; margin-bottom: 28px;
}
.slide-title-dark-full {
  font-family: 'EB Garamond', Georgia, serif; font-size: 28px; font-weight: 700;
  color: #fff; padding: 0.5in 0.75in 0;
}
.slide-title-light-full {
  font-family: 'EB Garamond', Georgia, serif; font-size: 28px; font-weight: 700;
  color: #0B1F3F; padding: 0.5in 0.75in 0;
}

/* ═══ COVER ═══════════════════════════════════════ */
.cover-accent-top {
  height: 5px;
  background: linear-gradient(90deg, #B8860B 0%, #D4A017 40%, #FFB2EF 70%, #B8860B 100%);
}
.cover-accent-bottom {
  height: 3px;
  background: linear-gradient(90deg, #B8860B 0%, #D4A017 50%, transparent 100%);
}
.cover-layout {
  display: flex; flex: 1; height: calc(100% - 5px - 3px - 36px);
}
.cover-left {
  width: 55%; padding: 0.65in 0.75in; display: flex;
  flex-direction: column; justify-content: center;
}
.cover-right {
  width: 45%; position: relative; overflow: hidden;
}
.cover-wordmark {
  font-family: 'EB Garamond', Georgia, serif; font-size: 14px; font-weight: 600;
  color: #B8860B; letter-spacing: 0.15em; text-transform: uppercase;
  margin-bottom: 40px;
}
.cover-type-label {
  font-size: 11px; font-weight: 600; letter-spacing: 0.25em;
  text-transform: uppercase; color: #718096; margin-bottom: 16px;
}
.cover-business-name {
  font-family: 'EB Garamond', Georgia, serif; font-size: 50px; font-weight: 700;
  color: #fff; line-height: 1.08; margin-bottom: 16px;
}
.cover-gold-line {
  width: 80px; height: 3px; border-radius: 2px;
  background: linear-gradient(90deg, #B8860B, #D4A017);
  margin-bottom: 18px;
}
.cover-subtitle {
  font-size: 16px; font-weight: 300; color: #CBD5E0;
  letter-spacing: 0.02em; max-width: 420px; line-height: 1.5;
}
.cover-meta-row { margin-top: 36px; }
.cover-score { display: flex; align-items: baseline; gap: 12px; }
.cover-score-num {
  font-family: 'EB Garamond', Georgia, serif; font-size: 44px; font-weight: 700;
}
.cover-score-label { font-size: 12px; color: #718096; letter-spacing: 0.06em; }
.cover-bottom {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 0.75in; height: 36px; font-size: 11px; color: #5A6A80;
}
.cover-powered { font-style: italic; }

/* Cover image */
.cover-image {
  width: 100%; height: 100%; object-fit: cover;
}

/* Cover CSS fallback arcs */
.cover-arcs {
  position: absolute; inset: 0; overflow: hidden;
}
.arc {
  position: absolute; border-radius: 50%;
  border: 1px solid rgba(184,134,11,0.12);
}
.arc-1 { width: 600px; height: 600px; top: -100px; right: -150px; transform: rotate(-15deg); }
.arc-2 { width: 480px; height: 480px; top: -40px; right: -80px; transform: rotate(-25deg);
         border-color: rgba(184,134,11,0.08); }
.arc-3 { width: 360px; height: 360px; top: 30px; right: -30px; transform: rotate(-35deg);
         border-color: rgba(184,134,11,0.15); }
.arc-4 { width: 520px; height: 520px; top: 60px; right: -200px; transform: rotate(10deg);
         border-color: rgba(184,134,11,0.06); }
.arc-5 { width: 280px; height: 280px; bottom: 40px; right: 20px; transform: rotate(-45deg);
         border-color: rgba(184,134,11,0.1); }

/* ═══ WINS ════════════════════════════════════════ */
.wins-narrative {
  font-size: 14px; color: #4A5568; line-height: 1.65; margin-bottom: 24px;
}
.wins-metrics-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px 40px;
  padding-top: 8px;
}
.win-metric { }
.win-metric-value {
  font-family: 'EB Garamond', Georgia, serif; font-size: 46px; font-weight: 700;
  color: #0B1F3F; line-height: 1.1;
}
.win-metric-label {
  font-size: 11px; font-weight: 600; letter-spacing: 0.12em;
  text-transform: uppercase; color: #718096; margin-top: 4px;
}
.win-metric-context {
  font-size: 13px; color: #4A5568; margin-top: 8px; line-height: 1.5;
}
.wins-strengths { margin-top: 24px; }
.strength-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: #2D3748; margin-bottom: 6px;
}
.strength-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}

/* ═══ ISSUES ══════════════════════════════════════ */
.issues-main {
  width: 63%; padding: 0.6in 0.55in;
}
.issues-sidebar {
  width: 37%; background: #132D54; padding: 0.6in 0.45in;
  display: flex; flex-direction: column;
}
.sidebar-label {
  font-size: 10px; font-weight: 700; letter-spacing: 0.2em;
  color: #B8860B; margin-bottom: 24px;
}
.issues-list { display: flex; flex-direction: column; gap: 0; }
.issue-row { display: flex; gap: 16px; align-items: flex-start; }
.issue-num {
  font-family: 'EB Garamond', Georgia, serif; font-size: 38px; font-weight: 700;
  color: #B8860B; line-height: 1; flex-shrink: 0; width: 50px;
}
.issue-body { flex: 1; }
.issue-headline {
  font-family: 'EB Garamond', Georgia, serif; font-size: 19px; font-weight: 600;
  color: #fff; line-height: 1.3; margin-bottom: 6px;
}
.issue-explanation { font-size: 13px; color: #CBD5E0; line-height: 1.55; }

.impact-callout {
  margin-bottom: 20px; padding-top: 16px;
  border-top: 2px solid #B8860B;
}
.impact-num {
  font-family: 'EB Garamond', Georgia, serif; font-size: 14px;
  color: #718096; margin-bottom: 4px;
}
.impact-text {
  font-family: 'EB Garamond', Georgia, serif; font-size: 18px; font-weight: 600;
  color: #B8860B; line-height: 1.4;
}

/* ═══ ROADMAP ═════════════════════════════════════ */
.roadmap-summary {
  font-size: 14px; color: #4A5568; line-height: 1.6;
  padding: 12px 0.75in 0; max-width: 10in;
}
.roadmap-initiatives {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;
  padding: 16px 0.75in 0;
}
.initiative-block { }
.initiative-bar {
  height: 4px; border-radius: 2px; margin-bottom: 8px;
}
.initiative-owner {
  display: inline-block; padding: 2px 10px; border-radius: 3px;
  font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: #fff; margin-bottom: 6px;
}
.initiative-name {
  font-family: 'EB Garamond', Georgia, serif; font-size: 16px; font-weight: 600;
  color: #0B1F3F; margin-bottom: 6px; line-height: 1.25;
}
.initiative-items { margin-bottom: 8px; }
.init-item {
  font-size: 12px; color: #4A5568; line-height: 1.5; padding: 1px 0;
}
.initiative-meta {
  font-size: 11px; color: #718096; display: flex; gap: 12px;
}
.init-effort { font-weight: 600; color: #0B1F3F; }
.init-outcome { font-style: italic; }

/* Timeline bar */
.timeline-bar {
  display: flex; gap: 0; padding: 16px 0.75in 0; position: relative;
}
.timeline-line {
  position: absolute; top: 30px; left: 0.75in; right: 0.75in;
  height: 2px; background: linear-gradient(90deg, #B8860B, #D4A017, transparent);
}
.timeline-phase {
  flex: 1; padding-right: 12px; position: relative;
}
.timeline-dot {
  width: 10px; height: 10px; border-radius: 50%; margin-bottom: 8px;
  position: relative; z-index: 1;
}
.timeline-phase-label {
  font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; margin-bottom: 6px;
}
.timeline-phase-items { }
.tl-item { font-size: 11px; color: #4A5568; line-height: 1.5; }

/* Next steps row */
.next-steps-row {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  padding: 14px 0.75in 0; font-size: 11px;
}
.ns-label {
  font-weight: 700; color: #B8860B; letter-spacing: 0.08em; text-transform: uppercase;
}
.ns-item { color: #4A5568; }
.ns-sep { color: #CBD5E0; }

/* ═══ RESULTS ═════════════════════════════════════ */
.comparison-table {
  padding: 20px 0.75in 0;
}
.comp-header {
  display: grid; grid-template-columns: 200px 60px 20px 80px 1fr;
  gap: 8px; padding: 8px 12px; margin-bottom: 4px;
}
.comp-cat-header { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #718096; }
.comp-now-header { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #E53E3E; text-align: center; }
.comp-after-header { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #38A169; text-align: center; }
.comp-note-header { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #718096; }
.comp-row {
  display: grid; grid-template-columns: 200px 60px 20px 80px 1fr;
  gap: 8px; align-items: center; padding: 6px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.comp-cat { font-size: 13px; font-weight: 600; color: #fff; text-transform: capitalize; }
.comp-now, .comp-after { text-align: center; }
.comp-dot { font-size: 18px; }
.comp-arrow { color: #5A6A80; font-size: 12px; text-align: center; }
.comp-note { font-size: 12px; color: #8CA0B8; }

.outcomes-section { padding: 20px 0.75in 0; }
.outcome-row {
  display: flex; gap: 12px; margin-bottom: 10px; align-items: flex-start;
}
.outcome-bar {
  width: 3px; min-height: 100%; background: #38A169; border-radius: 2px;
  flex-shrink: 0; align-self: stretch;
}
.outcome-content { }
.outcome-text {
  font-size: 13.5px; font-weight: 600; color: #fff; line-height: 1.4;
}
.outcome-evidence { font-size: 12px; color: #8CA0B8; margin-top: 2px; }

/* ═══ TOOLS ═══════════════════════════════════════ */
.tools-list { padding: 20px 0.75in 0; }
.tool-comparison {
  display: grid; grid-template-columns: 1fr 40px 1fr; gap: 0;
  align-items: start; margin-bottom: 8px;
}
.tool-current {
  background: #F0F0F0; border-radius: 6px 0 0 6px; padding: 16px 20px;
  border-left: 3px solid #CBD5E0;
}
.tool-proposed {
  background: #fff; border-radius: 0 6px 6px 0; padding: 16px 20px;
  border-left: 3px solid #B8860B;
}
.tool-arrow-col {
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; color: #B8860B; font-weight: 700;
  background: linear-gradient(90deg, #F0F0F0, #fff);
}
.tool-side-label {
  font-size: 9px; font-weight: 700; letter-spacing: 0.15em;
  text-transform: uppercase; color: #718096; margin-bottom: 4px;
}
.tool-side-name {
  font-family: 'EB Garamond', Georgia, serif; font-size: 18px; font-weight: 600;
  color: #0B1F3F; margin-bottom: 4px;
}
.tool-gap { color: #A0AEC0; font-style: italic; }
.tool-side-dot-red { color: #E53E3E; font-size: 14px; margin-top: 4px; }
.tool-highlight { color: #B8860B; }
.tool-pitch-text { font-size: 13px; color: #4A5568; line-height: 1.5; margin-top: 6px; }
.tool-gap-text {
  grid-column: 1 / -1; font-size: 12px; color: #718096;
  font-style: italic; padding: 4px 20px 0;
}
.tool-divider {
  height: 1px; margin: 12px 0;
  background: linear-gradient(90deg, transparent, #E2E8F0 20%, #E2E8F0 80%, transparent);
}

/* ═══ CLOSER ══════════════════════════════════════ */
.closer-page .cover-layout { flex-direction: row-reverse; }
.closer-img-container { width: 45%; }
.closer-image {
  width: 100%; height: 100%; object-fit: cover;
}
.closer-right {
  width: 55%; display: flex; flex-direction: column;
  justify-content: center; align-items: center; text-align: center;
}
.closer-score {
  font-family: 'EB Garamond', Georgia, serif; font-size: 72px; font-weight: 700;
  line-height: 1;
}
.closer-score-label {
  font-size: 13px; color: #718096; letter-spacing: 0.1em; margin-top: 8px;
}
.closer-message {
  font-size: 17px; color: #CBD5E0; font-style: italic;
  margin-top: 36px; max-width: 380px; line-height: 1.6;
}
.closer-domain {
  font-family: 'Source Code Pro', monospace; font-size: 14px;
  color: #B8860B; margin-top: 24px; letter-spacing: 0.03em;
}
`;
