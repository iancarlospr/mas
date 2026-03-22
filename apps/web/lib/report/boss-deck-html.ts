/**
 * Boss Deck — HTML template renderer.
 *
 * Renders a 8-9 page landscape pitch deck as a printable HTML document.
 * Design: Navy (#0B1F3F) + Gold (#B8860B) + Pink (#FFB2EF) accents.
 * Cohesive with PRD but bolder, more visual, deck-like.
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
  // Raw data for fallback / direct rendering
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

const URGENCY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  immediate: { bg: '#C53030', text: '#fff', label: 'IMMEDIATE' },
  this_week: { bg: '#C05621', text: '#fff', label: 'THIS WEEK' },
  this_month: { bg: '#2B6CB0', text: '#fff', label: 'THIS MONTH' },
};

const OWNER_COLORS: Record<string, { bg: string; text: string }> = {
  'Content Team': { bg: '#2B6CB0', text: '#fff' },
  'Dev Team': { bg: '#0B1F3F', text: '#fff' },
  'Marketing Ops': { bg: '#B8860B', text: '#fff' },
  'Design Team': { bg: '#6B46C1', text: '#fff' },
  'Leadership': { bg: '#C53030', text: '#fff' },
};

function ownerColor(owner: string): { bg: string; text: string } {
  return OWNER_COLORS[owner] ?? { bg: '#4A5568', text: '#fff' };
}

function lightColor(light: string): string {
  if (light === 'green') return '#38A169';
  if (light === 'yellow') return '#D69E2E';
  return '#E53E3E';
}

function lightEmoji(light: string): string {
  if (light === 'green') return '●';
  if (light === 'yellow') return '●';
  return '●';
}

// ── Render ───────────────────────────────────────────────────

export function renderBossDeck(ctx: BossDeckRenderContext): string {
  const ai = ctx.ai;
  const domainSafe = esc(ctx.domain);
  const dateFmt = formatDate(ctx.scanDate);

  // Fallback values when AI is null
  const coverSubtitle = ai?.cover_subtitle ?? `Marketing Technology Assessment — ${dateFmt}`;
  const winsNarrative = ai?.wins_narrative ?? (ctx.m42Synthesis?.['executive_brief'] as string ?? '').split('\n')[0] ?? '';
  const winsHighlights = ai?.wins_highlights ?? [];
  const topIssues = ai?.top_issues ?? [];
  const initiatives = ai?.initiatives ?? [];
  const toolPitches = ai?.tool_pitches ?? [];
  const businessCaseHeadline = ai?.business_case_headline ?? 'The Business Case for Action';
  const businessCaseNarrative = ai?.business_case_narrative ?? '';
  const businessCaseMetrics = ai?.business_case_metrics ?? [];
  const impactHeadline = ai?.implementation_impact_headline ?? 'What This Means For The Business';
  const impactOutcomes = ai?.implementation_outcomes ?? [];
  const categoryProjections = ai?.category_projections ?? [];
  const timelineSummary = ai?.timeline_summary ?? '';
  const timelineItems = ai?.timeline_items ?? [];
  const nextSteps = ai?.next_steps ?? [];
  const closingMessage = ai?.closing_message ?? 'Ready to move forward when you are.';

  // Build pages
  const pages: string[] = [];

  // ── Page 1: Cover ──
  pages.push(renderCover(ctx, coverSubtitle, dateFmt));

  // ── Page 2: What's Working ──
  if (winsHighlights.length > 0 || winsNarrative) {
    pages.push(renderWins(winsNarrative, winsHighlights, ctx));
  }

  // ── Page 3: Top 3 Issues ──
  if (topIssues.length > 0) {
    pages.push(renderIssues(topIssues));
  }

  // ── Page 4: Initiatives ──
  if (initiatives.length > 0) {
    pages.push(renderInitiatives(initiatives));
  }

  // ── Page 5: Tool Pitches (conditional) ──
  if (toolPitches.length > 0 && ctx.hasM45) {
    pages.push(renderToolPitches(toolPitches));
  }

  // ── Page 6: Business Case ──
  if (businessCaseMetrics.length > 0) {
    pages.push(renderBusinessCase(businessCaseHeadline, businessCaseNarrative, businessCaseMetrics, ctx));
  }

  // ── Page 7: Implementation Impact ──
  if (impactOutcomes.length > 0 || categoryProjections.length > 0) {
    pages.push(renderImpact(impactHeadline, impactOutcomes, categoryProjections));
  }

  // ── Page 8: Timeline ──
  if (timelineItems.length > 0) {
    pages.push(renderTimeline(timelineSummary, timelineItems));
  }

  // ── Page 9: Next Steps ──
  pages.push(renderCloser(nextSteps, closingMessage, domainSafe));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Boss Deck — ${domainSafe}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500;600;700&family=Source+Sans+3:wght@300;400;600;700&family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet">
<style>
${CSS}
</style>
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

// ── Page Renderers ───────────────────────────────────────────

function renderCover(ctx: BossDeckRenderContext, subtitle: string, dateFmt: string): string {
  const score = ctx.marketingIQ;
  const label = ctx.marketingIQLabel ?? '';
  const scoreColor = score != null && score >= 70 ? '#38A169' : score != null && score >= 40 ? '#D69E2E' : '#E53E3E';

  return `<div class="page cover-page">
  <div class="cover-accent"></div>
  <div class="cover-center">
    <div class="cover-label">MARKETING AUDIT BRIEFING</div>
    <div class="cover-domain-name">${esc(ctx.businessName || ctx.domain)}</div>
    <div class="cover-divider"></div>
    <div class="cover-subtitle">${esc(subtitle)}</div>
    ${score != null ? `
    <div class="cover-score-ring">
      <div class="cover-score-value" style="color:${scoreColor}">${score}</div>
      <div class="cover-score-label">MarketingIQ™</div>
      <div class="cover-score-tier">${esc(label)}</div>
    </div>` : ''}
  </div>
  <div class="cover-footer">
    <span>Prepared by ${esc(ctx.userEmail)} · ${esc(dateFmt)}</span>
    <span class="cover-powered">Powered by AlphaScan</span>
  </div>
  <div class="cover-bottom-accent"></div>
</div>`;
}

function renderWins(narrative: string, highlights: BossDeckAIOutput['wins_highlights'], ctx: BossDeckRenderContext): string {
  const strengthsList = getStrengths(ctx);

  return `<div class="page wins-page">
  <div class="page-header">
    <div class="page-number">02</div>
    <div class="page-title">Here's What's Already Working</div>
  </div>
  <div class="wins-narrative">${esc(narrative)}</div>
  <div class="wins-grid">
    ${highlights.map(h => `
    <div class="wins-card">
      <div class="wins-card-value">${esc(h.metric_value)}</div>
      <div class="wins-card-label">${esc(h.metric_label)}</div>
      <div class="wins-card-context">${esc(h.context)}</div>
    </div>`).join('')}
  </div>
  ${strengthsList.length > 0 ? `
  <div class="wins-strengths">
    <div class="wins-strengths-title">Category Strengths</div>
    <div class="wins-strengths-list">
      ${strengthsList.map(s => `<div class="wins-strength-item"><span class="wins-strength-dot" style="background:${lightColor(s.light)}">●</span> ${esc(s.name)}: ${esc(s.note)}</div>`).join('')}
    </div>
  </div>` : ''}
</div>`;
}

function getStrengths(ctx: BossDeckRenderContext): { name: string; note: string; light: string }[] {
  const strengths: { name: string; note: string; light: string }[] = [];
  // From category assessments in M42
  const assessments = ctx.m42Synthesis?.['category_assessments'] as Record<string, Record<string, unknown>> | undefined;
  if (assessments) {
    for (const [, val] of Object.entries(assessments)) {
      const strArr = val['strengths'] as string[] | undefined;
      if (strArr && strArr.length > 0) {
        const catName = val['category_name'] as string ?? '';
        const matching = ctx.categoryScores.find(c => c.category.toLowerCase().includes(catName.toLowerCase().split(' ')[0] ?? ''));
        if (matching && (matching.light === 'green' || matching.score >= 60)) {
          strengths.push({ name: catName, note: strArr[0] ?? '', light: matching.light });
        }
      }
    }
  }
  return strengths.slice(0, 4);
}

function renderIssues(issues: BossDeckAIOutput['top_issues']): string {
  return `<div class="page issues-page">
  <div class="page-header">
    <div class="page-number">03</div>
    <div class="page-title">Three Things Holding Us Back</div>
  </div>
  <div class="issues-grid">
    ${issues.map((issue, i) => {
      const uc = URGENCY_COLORS[issue.urgency] ?? URGENCY_COLORS['this_month']!;
      return `
    <div class="issue-card">
      <div class="issue-number">${i + 1}</div>
      <div class="issue-content">
        <div class="issue-badge" style="background:${uc.bg};color:${uc.text}">${uc.label}</div>
        <div class="issue-headline">${esc(issue.headline)}</div>
        <div class="issue-explanation">${esc(issue.explanation)}</div>
        <div class="issue-impact">${esc(issue.dollar_impact)}</div>
      </div>
    </div>`;
    }).join('')}
  </div>
</div>`;
}

function renderInitiatives(initiatives: BossDeckAIOutput['initiatives']): string {
  return `<div class="page initiatives-page">
  <div class="page-header">
    <div class="page-number">04</div>
    <div class="page-title">What We Need To Do</div>
  </div>
  <div class="initiatives-grid">
    ${initiatives.map(init => {
      const oc = ownerColor(init.owner);
      return `
    <div class="initiative-card">
      <div class="initiative-header">
        <span class="initiative-owner" style="background:${oc.bg};color:${oc.text}">${esc(init.owner)}</span>
        <span class="initiative-effort">${esc(init.effort)}</span>
      </div>
      <div class="initiative-name">${esc(init.name)}</div>
      <ul class="initiative-items">
        ${init.items.map(item => `<li>${esc(item)}</li>`).join('')}
      </ul>
      <div class="initiative-outcome">${esc(init.expected_outcome)}</div>
    </div>`;
    }).join('')}
  </div>
</div>`;
}

function renderToolPitches(pitches: BossDeckAIOutput['tool_pitches']): string {
  return `<div class="page tools-page">
  <div class="page-header">
    <div class="page-number">05</div>
    <div class="page-title">Tools We Should Invest In</div>
  </div>
  <div class="tools-grid">
    ${pitches.map(p => `
    <div class="tool-card">
      <div class="tool-name">${esc(p.tool_name)}</div>
      <div class="tool-pitch">${esc(p.why_we_need_it)}</div>
      <div class="tool-meta">
        ${p.what_it_replaces && p.what_it_replaces !== 'New addition' ? `<div class="tool-replaces"><span class="tool-meta-label">Replaces:</span> ${esc(p.what_it_replaces)}</div>` : '<div class="tool-replaces"><span class="tool-meta-label">Type:</span> New addition</div>'}
        <div class="tool-gap"><span class="tool-meta-label">Fills gap:</span> ${esc(p.capability_gap)}</div>
      </div>
    </div>`).join('')}
  </div>
</div>`;
}

function renderBusinessCase(headline: string, narrative: string, metrics: BossDeckAIOutput['business_case_metrics'], ctx: BossDeckRenderContext): string {
  return `<div class="page business-page">
  <div class="page-header">
    <div class="page-number">${ctx.hasM45 && (ctx.ai?.tool_pitches?.length ?? 0) > 0 ? '06' : '05'}</div>
    <div class="page-title">${esc(headline)}</div>
  </div>
  <div class="business-narrative">${esc(narrative)}</div>
  <div class="business-metrics-grid">
    ${metrics.map(m => `
    <div class="business-metric-card">
      <div class="business-metric-value">${esc(m.value)}</div>
      <div class="business-metric-label">${esc(m.label)}</div>
      <div class="business-metric-comparison">${esc(m.comparison)}</div>
      <div class="business-metric-insight">${esc(m.insight)}</div>
    </div>`).join('')}
  </div>
  <div class="business-score-bar">
    <div class="business-score-title">Category Health Overview</div>
    <div class="business-score-grid">
      ${ctx.categoryScores.map(c => `
      <div class="score-chip">
        <span class="score-dot" style="color:${lightColor(c.light)}">${lightEmoji(c.light)}</span>
        <span class="score-cat-name">${esc(c.category.replace(/_/g, ' '))}</span>
        <span class="score-cat-val">${c.score}</span>
      </div>`).join('')}
    </div>
  </div>
</div>`;
}

function renderImpact(headline: string, outcomes: BossDeckAIOutput['implementation_outcomes'], projections: BossDeckAIOutput['category_projections']): string {
  return `<div class="page impact-page">
  <div class="page-header">
    <div class="page-number">07</div>
    <div class="page-title">${esc(headline)}</div>
  </div>
  ${outcomes.length > 0 ? `
  <div class="impact-outcomes">
    ${outcomes.map(o => `
    <div class="impact-outcome">
      <div class="impact-outcome-text">${esc(o.outcome)}</div>
      <div class="impact-outcome-evidence">${esc(o.evidence)}</div>
      <div class="impact-outcome-source">Depends on: ${esc(o.source_work)}</div>
    </div>`).join('')}
  </div>` : ''}
  ${projections.length > 0 ? `
  <div class="impact-projections">
    <div class="impact-projections-title">Category Health — Before & After</div>
    <div class="impact-projections-grid">
      ${projections.map(p => `
      <div class="projection-row">
        <span class="projection-cat">${esc(p.category)}</span>
        <span class="projection-lights">
          <span class="projection-dot" style="color:${lightColor(p.current_light)}">${lightEmoji(p.current_light)}</span>
          <span class="projection-arrow">→</span>
          <span class="projection-dot" style="color:${lightColor(p.projected_light)}">${lightEmoji(p.projected_light)}</span>
        </span>
        <span class="projection-note">${esc(p.explanation)}</span>
      </div>`).join('')}
    </div>
  </div>` : ''}
</div>`;
}

function renderTimeline(summary: string, items: BossDeckAIOutput['timeline_items']): string {
  const phaseColors = ['#C53030', '#C05621', '#2B6CB0', '#718096'];
  return `<div class="page timeline-page">
  <div class="page-header">
    <div class="page-number">08</div>
    <div class="page-title">Implementation Timeline</div>
  </div>
  <div class="timeline-summary">${esc(summary)}</div>
  <div class="timeline-columns">
    ${items.map((phase, i) => `
    <div class="timeline-column">
      <div class="timeline-phase-header" style="border-top-color:${phaseColors[i] ?? '#718096'}">${esc(phase.phase)}</div>
      <ul class="timeline-phase-items">
        ${phase.items.map(item => `<li>${esc(item)}</li>`).join('')}
      </ul>
    </div>`).join('')}
  </div>
</div>`;
}

function renderCloser(nextSteps: string[], closingMessage: string, domainSafe: string): string {
  return `<div class="page closer-page">
  <div class="closer-content">
    <div class="closer-title">What Happens Next</div>
    <div class="closer-steps">
      ${nextSteps.map((step, i) => `
      <div class="closer-step">
        <div class="closer-step-num">${i + 1}</div>
        <div class="closer-step-text">${esc(step)}</div>
      </div>`).join('')}
    </div>
    <div class="closer-message">${esc(closingMessage)}</div>
    <div class="closer-cta">
      <div class="closer-cta-text">Full audit report and remediation plan available at</div>
      <div class="closer-cta-domain">${domainSafe}</div>
    </div>
  </div>
  <div class="closer-footer">
    <span class="closer-powered">Powered by AlphaScan</span>
  </div>
</div>`;
}

// ── CSS ──────────────────────────────────────────────────────

const CSS = `
/* ── Reset & Page ──────────────────────────────────── */
@page { size: 14in 8.5in; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important; }
html, body { width: 14in; min-height: 8.5in; background: #fff; }
body { font-family: 'Source Sans 3', system-ui, sans-serif; font-size: 13px; color: #2D3748; }

/* ── Print Banner ──────────────────────────────────── */
.print-banner {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  background: #0B1F3F; color: #E2E8F0; text-align: center;
  padding: 11px 20px; font-size: 13.5px; font-weight: 400;
  display: flex; align-items: center; justify-content: center; gap: 16px;
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

/* ── Page Container ────────────────────────────────── */
.page {
  width: 14in; height: 8.5in; position: relative; overflow: hidden;
  page-break-after: always; break-inside: avoid;
}
.page:last-child { page-break-after: auto; }

/* ── Page Header (shared) ──────────────────────────── */
.page-header {
  display: flex; align-items: baseline; gap: 16px;
  padding: 0.55in 0.75in 0 0.75in;
}
.page-number {
  font-family: 'EB Garamond', Georgia, serif; font-size: 32px; font-weight: 700;
  color: #B8860B; line-height: 1;
}
.page-title {
  font-family: 'EB Garamond', Georgia, serif; font-size: 28px; font-weight: 600;
  color: #0B1F3F; line-height: 1.2;
}

/* ═══════════════════════════════════════════════════════
   PAGE 1: COVER
   ═══════════════════════════════════════════════════════ */
.cover-page {
  background: #0B1F3F; color: #fff;
  display: flex; flex-direction: column;
}
.cover-accent {
  height: 6px;
  background: linear-gradient(90deg, #B8860B 0%, #D4A017 40%, #FFB2EF 70%, #B8860B 100%);
}
.cover-center {
  flex: 1; display: flex; flex-direction: column;
  justify-content: center; align-items: center; text-align: center;
  padding: 0 1.5in;
}
.cover-label {
  font-size: 11px; font-weight: 600; letter-spacing: 0.25em;
  text-transform: uppercase; color: #B8860B; margin-bottom: 24px;
}
.cover-domain-name {
  font-family: 'EB Garamond', Georgia, serif; font-size: 48px; font-weight: 700;
  color: #fff; line-height: 1.1; margin-bottom: 16px;
}
.cover-divider {
  width: 120px; height: 3px; border-radius: 2px;
  background: linear-gradient(90deg, #B8860B, #D4A017, transparent);
  margin: 0 auto 20px;
}
.cover-subtitle {
  font-size: 16px; font-weight: 300; color: #CBD5E0;
  letter-spacing: 0.02em; max-width: 500px;
}
.cover-score-ring {
  margin-top: 40px; text-align: center;
  border: 2px solid #B8860B; border-radius: 12px;
  padding: 20px 36px; display: inline-block;
}
.cover-score-value {
  font-family: 'EB Garamond', Georgia, serif; font-size: 56px; font-weight: 700;
  line-height: 1;
}
.cover-score-label {
  font-size: 10px; font-weight: 600; letter-spacing: 0.15em;
  text-transform: uppercase; color: #718096; margin-top: 4px;
}
.cover-score-tier {
  font-size: 14px; font-weight: 600; color: #B8860B; margin-top: 2px;
}
.cover-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 0.85in 0.45in; font-size: 11px; color: #718096;
}
.cover-powered { font-style: italic; }
.cover-bottom-accent {
  height: 4px;
  background: linear-gradient(90deg, #B8860B 0%, #D4A017 50%, transparent 100%);
}

/* ═══════════════════════════════════════════════════════
   PAGE 2: WINS
   ═══════════════════════════════════════════════════════ */
.wins-page { background: #FAFBFD; padding: 0; }
.wins-narrative {
  font-size: 15px; color: #4A5568; line-height: 1.6;
  padding: 20px 0.75in 0; max-width: 10in;
}
.wins-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;
  padding: 28px 0.75in 0;
}
.wins-card {
  background: #fff; border: 1px solid #E2E8F0; border-radius: 8px;
  padding: 24px 20px; text-align: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.wins-card-value {
  font-family: 'EB Garamond', Georgia, serif; font-size: 36px; font-weight: 700;
  color: #B8860B; line-height: 1.1;
}
.wins-card-label {
  font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: #718096; margin-top: 6px;
}
.wins-card-context {
  font-size: 12px; color: #4A5568; margin-top: 10px; line-height: 1.5;
}
.wins-strengths {
  padding: 24px 0.75in 0;
}
.wins-strengths-title {
  font-family: 'EB Garamond', Georgia, serif; font-size: 16px; font-weight: 600;
  color: #0B1F3F; margin-bottom: 10px;
}
.wins-strengths-list { display: flex; flex-wrap: wrap; gap: 8px 24px; }
.wins-strength-item {
  font-size: 13px; color: #2D3748; display: flex; align-items: center; gap: 6px;
}
.wins-strength-dot { font-size: 10px; }

/* ═══════════════════════════════════════════════════════
   PAGE 3: ISSUES
   ═══════════════════════════════════════════════════════ */
.issues-page { background: #FAFBFD; }
.issues-grid {
  display: flex; flex-direction: column; gap: 20px;
  padding: 28px 0.75in 0;
}
.issue-card {
  display: flex; gap: 20px; align-items: flex-start;
  background: #fff; border: 1px solid #E2E8F0; border-radius: 8px;
  padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.issue-number {
  font-family: 'EB Garamond', Georgia, serif; font-size: 42px; font-weight: 700;
  color: #E2E8F0; line-height: 1; flex-shrink: 0; width: 48px; text-align: center;
}
.issue-content { flex: 1; }
.issue-badge {
  display: inline-block; padding: 3px 10px; border-radius: 3px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; margin-bottom: 8px;
}
.issue-headline {
  font-family: 'EB Garamond', Georgia, serif; font-size: 20px; font-weight: 600;
  color: #0B1F3F; margin-bottom: 6px; line-height: 1.3;
}
.issue-explanation { font-size: 13px; color: #4A5568; line-height: 1.6; margin-bottom: 8px; }
.issue-impact {
  font-size: 13px; font-weight: 600; color: #B8860B;
  padding-top: 8px; border-top: 1px solid #E2E8F0;
}

/* ═══════════════════════════════════════════════════════
   PAGE 4: INITIATIVES
   ═══════════════════════════════════════════════════════ */
.initiatives-page { background: #FAFBFD; }
.initiatives-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;
  padding: 28px 0.75in 0;
}
.initiative-card {
  background: #fff; border: 1px solid #E2E8F0; border-radius: 8px;
  padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.initiative-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px;
}
.initiative-owner {
  display: inline-block; padding: 3px 10px; border-radius: 3px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
}
.initiative-effort {
  font-size: 11px; color: #718096; font-weight: 600;
}
.initiative-name {
  font-family: 'EB Garamond', Georgia, serif; font-size: 17px; font-weight: 600;
  color: #0B1F3F; margin-bottom: 10px; line-height: 1.3;
}
.initiative-items {
  list-style: none; padding: 0; margin: 0 0 12px 0;
}
.initiative-items li {
  font-size: 12.5px; color: #4A5568; line-height: 1.5;
  padding: 3px 0 3px 16px; position: relative;
}
.initiative-items li::before {
  content: '→'; position: absolute; left: 0; color: #B8860B; font-weight: 600;
}
.initiative-outcome {
  font-size: 12px; color: #2B6CB0; font-style: italic;
  padding-top: 10px; border-top: 1px solid #E2E8F0;
}

/* ═══════════════════════════════════════════════════════
   PAGE 5: TOOL PITCHES
   ═══════════════════════════════════════════════════════ */
.tools-page { background: #FAFBFD; }
.tools-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;
  padding: 28px 0.75in 0;
}
.tool-card {
  background: #fff; border: 1px solid #E2E8F0; border-left: 4px solid #B8860B;
  border-radius: 8px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.tool-name {
  font-family: 'EB Garamond', Georgia, serif; font-size: 20px; font-weight: 600;
  color: #0B1F3F; margin-bottom: 8px;
}
.tool-pitch { font-size: 13.5px; color: #4A5568; line-height: 1.6; margin-bottom: 14px; }
.tool-meta { font-size: 12px; color: #718096; }
.tool-meta-label { font-weight: 600; color: #4A5568; }
.tool-replaces, .tool-gap { margin-top: 4px; }

/* ═══════════════════════════════════════════════════════
   PAGE 6: BUSINESS CASE
   ═══════════════════════════════════════════════════════ */
.business-page { background: #FAFBFD; }
.business-narrative {
  font-size: 14px; color: #4A5568; line-height: 1.6;
  padding: 16px 0.75in 0; max-width: 10in;
}
.business-metrics-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;
  padding: 24px 0.75in 0;
}
.business-metric-card {
  background: #0B1F3F; border-radius: 8px; padding: 24px; color: #fff;
  text-align: center;
}
.business-metric-value {
  font-family: 'EB Garamond', Georgia, serif; font-size: 34px; font-weight: 700;
  color: #B8860B; line-height: 1.1;
}
.business-metric-label {
  font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: #718096; margin-top: 6px;
}
.business-metric-comparison {
  font-size: 12px; color: #CBD5E0; margin-top: 10px; font-style: italic;
}
.business-metric-insight {
  font-size: 12.5px; color: #E2E8F0; margin-top: 8px; line-height: 1.5;
}
.business-score-bar {
  padding: 24px 0.75in 0;
}
.business-score-title {
  font-size: 13px; font-weight: 600; color: #0B1F3F; margin-bottom: 10px;
  letter-spacing: 0.04em; text-transform: uppercase;
}
.business-score-grid {
  display: flex; flex-wrap: wrap; gap: 10px;
}
.score-chip {
  display: flex; align-items: center; gap: 6px;
  background: #fff; border: 1px solid #E2E8F0; border-radius: 20px;
  padding: 5px 14px; font-size: 12px;
}
.score-dot { font-size: 10px; }
.score-cat-name {
  font-weight: 400; color: #4A5568; text-transform: capitalize;
}
.score-cat-val { font-weight: 700; color: #0B1F3F; }

/* ═══════════════════════════════════════════════════════
   PAGE 7: IMPLEMENTATION IMPACT
   ═══════════════════════════════════════════════════════ */
.impact-page { background: #FAFBFD; }
.impact-outcomes { padding: 20px 0.75in 0; }
.impact-outcome {
  background: #fff; border: 1px solid #E2E8F0; border-left: 4px solid #38A169;
  border-radius: 6px; padding: 16px 20px; margin-bottom: 12px;
}
.impact-outcome-text {
  font-family: 'EB Garamond', Georgia, serif; font-size: 16px; font-weight: 600;
  color: #0B1F3F; margin-bottom: 4px;
}
.impact-outcome-evidence { font-size: 12.5px; color: #4A5568; line-height: 1.5; }
.impact-outcome-source {
  font-size: 11px; color: #718096; font-style: italic; margin-top: 6px;
}
.impact-projections { padding: 24px 0.75in 0; }
.impact-projections-title {
  font-family: 'EB Garamond', Georgia, serif; font-size: 17px; font-weight: 600;
  color: #0B1F3F; margin-bottom: 12px;
}
.impact-projections-grid { display: flex; flex-direction: column; gap: 6px; }
.projection-row {
  display: grid; grid-template-columns: 200px 100px 1fr; gap: 12px;
  align-items: center; padding: 6px 12px; border-radius: 4px;
  background: #fff; border: 1px solid #f0f0f0;
}
.projection-cat {
  font-size: 13px; font-weight: 600; color: #0B1F3F; text-transform: capitalize;
}
.projection-lights {
  display: flex; align-items: center; gap: 8px; font-size: 14px;
}
.projection-arrow { color: #718096; font-size: 12px; }
.projection-dot { font-size: 16px; }
.projection-note { font-size: 12px; color: #4A5568; }

/* ═══════════════════════════════════════════════════════
   PAGE 8: TIMELINE
   ═══════════════════════════════════════════════════════ */
.timeline-page { background: #FAFBFD; }
.timeline-summary {
  font-size: 14px; color: #4A5568; line-height: 1.6;
  padding: 16px 0.75in 0; max-width: 10in;
}
.timeline-columns {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
  padding: 24px 0.75in 0;
}
.timeline-column {
  background: #fff; border: 1px solid #E2E8F0; border-radius: 8px;
  padding: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.timeline-phase-header {
  font-family: 'EB Garamond', Georgia, serif; font-size: 15px; font-weight: 600;
  color: #0B1F3F; padding-bottom: 8px; margin-bottom: 10px;
  border-top: 4px solid #718096; padding-top: 8px;
}
.timeline-phase-items {
  list-style: none; padding: 0; margin: 0;
}
.timeline-phase-items li {
  font-size: 12px; color: #4A5568; line-height: 1.5;
  padding: 4px 0 4px 14px; position: relative;
}
.timeline-phase-items li::before {
  content: '•'; position: absolute; left: 0; color: #B8860B; font-weight: 700;
}

/* ═══════════════════════════════════════════════════════
   PAGE 9: CLOSER
   ═══════════════════════════════════════════════════════ */
.closer-page {
  background: #0B1F3F; color: #fff;
  display: flex; flex-direction: column;
}
.closer-content {
  flex: 1; display: flex; flex-direction: column;
  justify-content: center; align-items: center; text-align: center;
  padding: 0 1.5in;
}
.closer-title {
  font-family: 'EB Garamond', Georgia, serif; font-size: 32px; font-weight: 600;
  color: #fff; margin-bottom: 36px;
}
.closer-steps {
  display: flex; flex-direction: column; gap: 16px;
  text-align: left; width: 100%; max-width: 600px;
}
.closer-step {
  display: flex; align-items: flex-start; gap: 16px;
}
.closer-step-num {
  font-family: 'EB Garamond', Georgia, serif; font-size: 28px; font-weight: 700;
  color: #B8860B; line-height: 1; flex-shrink: 0; width: 36px; text-align: center;
}
.closer-step-text {
  font-size: 15px; color: #E2E8F0; line-height: 1.5; padding-top: 4px;
}
.closer-message {
  font-size: 16px; color: #CBD5E0; font-style: italic;
  margin-top: 40px; max-width: 500px;
}
.closer-cta {
  margin-top: 32px; padding: 16px 28px;
  border: 1px solid #B8860B; border-radius: 8px;
}
.closer-cta-text {
  font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 0.1em;
}
.closer-cta-domain {
  font-family: 'Source Code Pro', monospace; font-size: 14px; color: #B8860B;
  margin-top: 4px;
}
.closer-footer {
  padding: 0 0.85in 0.45in; text-align: right;
}
.closer-powered { font-size: 11px; color: #4A5568; font-style: italic; }

/* ── Responsive for 3-col wins when only 3 highlights ─ */
@media print {
  .wins-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
}
`;
