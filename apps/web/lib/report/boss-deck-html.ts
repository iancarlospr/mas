/**
 * Boss Deck v3 — Editorial Intelligence design.
 *
 * 7-page landscape pitch deck with full-bleed photography,
 * bold stat callouts, McKinsey-grade typography and composition.
 * Images are shared assets in /boss-deck/ (not per-scan).
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
  /** Base64 data URI for cover image (hero-cover.jpg) */
  coverImageDataUri?: string;
  /** Base64 data URI for closer image (hero-horizon.jpg) */
  closerImageDataUri?: string;
  /** Raw module data for slide 2 widgets */
  m03Data?: Record<string, unknown> | null;
  m06Data?: Record<string, unknown> | null;
  m21Data?: Record<string, unknown> | null;
  m22Data?: Record<string, unknown> | null;
  m24Data?: Record<string, unknown> | null;
  m25Data?: Record<string, unknown> | null;
  m26Data?: Record<string, unknown> | null;
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
  if (light === 'green') return '#22C55E';
  if (light === 'yellow') return '#EAB308';
  return '#EF4444';
}

function lightBg(light: string): string {
  if (light === 'green') return 'rgba(34,197,94,0.12)';
  if (light === 'yellow') return 'rgba(234,179,8,0.12)';
  return 'rgba(239,68,68,0.12)';
}

function urgencyTag(urgency: string): string {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    immediate: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444', label: 'IMMEDIATE' },
    this_week: { bg: 'rgba(234,179,8,0.15)', text: '#EAB308', label: 'THIS WEEK' },
    this_month: { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6', label: 'THIS MONTH' },
  };
  const c = colors[urgency] ?? colors['this_month']!;
  return `<span class="urgency-tag" style="background:${c.bg};color:${c.text}">${c.label}</span>`;
}

function ownerColor(owner: string): string {
  const map: Record<string, string> = {
    'Content Team': '#3B82F6',
    'Dev Team': '#8B5CF6',
    'Marketing Ops': '#F59E0B',
    'Design Team': '#EC4899',
    'Leadership': '#EF4444',
  };
  return map[owner] ?? '#64748B';
}

function footer(pageNum: number, totalPages: number, variant: 'dark' | 'light' | 'image', userName?: string): string {
  const color = variant === 'light' ? '#94A3B8' : 'rgba(255,255,255,0.4)';
  const left = userName ? `Prepared by ${esc(userName)}` : 'Powered by AlphaScan';
  const cls = variant === 'light' ? 'slide-footer footer-light' : 'slide-footer footer-dark';
  const grainCls = variant === 'light' ? 'bar-grain-light' : 'bar-grain';
  return `<div class="${cls}" style="color:${color}">
    <div class="${grainCls}" aria-hidden="true"></div>
    <span style="flex:1;text-align:left">${left}</span>
    <span>${pageNum} / ${totalPages}</span>
  </div>`;
}

// ── Slide 2 Widget Data Extractors ──────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return Math.round(n / 1_000) + 'K';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

interface CWVMetric { sec: number; health: string; label: string; max: number; }
interface CWVData { metrics: CWVMetric[]; }
function extractCWV(m03: Record<string, unknown> | null | undefined): CWVData | null {
  if (!m03) return null;
  const raw = m03['metrics'] as Record<string, unknown> | undefined;
  const crux = m03['cruxFieldData'] as Record<string, unknown> | undefined;
  const cruxP75 = (f: string) => { const m = crux?.[f] as Record<string, unknown> | undefined; return typeof m?.['p75'] === 'number' ? m['p75'] as number : null; };
  const health = (sec: number, good: number, warn: number) => sec <= good ? 'good' : sec <= warn ? 'warn' : 'poor';
  const good: CWVMetric[] = [];
  // LCP — only show if valid (> 0) and good (< 2.5s)
  const lcpMs = typeof raw?.['lcp'] === 'number' ? raw['lcp'] as number : cruxP75('lcp');
  if (lcpMs != null && lcpMs > 0) { const s = lcpMs / 1000; const h = health(s, 2.5, 4.0); if (h === 'good') good.push({ sec: s, health: h, label: 'LCP', max: 6 }); }
  // FCP — only show if valid and good (< 1.8s)
  const fcpMs = typeof raw?.['fcp'] === 'number' ? raw['fcp'] as number : cruxP75('fcp');
  if (fcpMs != null && fcpMs > 0) { const s = fcpMs / 1000; const h = health(s, 1.8, 3.0); if (h === 'good') good.push({ sec: s, health: h, label: 'FCP', max: 5 }); }
  // CLS — only show if excellent (< 0.1)
  const cls = typeof raw?.['cls'] === 'number' ? raw['cls'] as number : cruxP75('cls');
  if (cls != null && cls >= 0 && cls < 0.1) good.push({ sec: cls, health: 'good', label: 'CLS', max: 0.5 });
  if (good.length === 0) return null;
  return { metrics: good };
}

interface PaidAdsData { fbActive: boolean; googleActive: boolean; fbAds: number; googleAds: number; totalAds: number; tierLabel: string; pixelCount: number; }
function extractPaidAds(m21: Record<string, unknown> | null | undefined, m06: Record<string, unknown> | null | undefined): PaidAdsData | null {
  if (!m21) return null;
  const summary = (m21['summary'] as Record<string, unknown>) ?? {};
  const fbActive = summary['facebookActive'] === true;
  const googleActive = summary['googleSearchActive'] === true;
  const fbObj = m21['facebook'] as Record<string, unknown> | undefined;
  const googleObj = m21['google'] as Record<string, unknown> | undefined;
  const fbAds = typeof fbObj?.['totalAdsVisible'] === 'number' ? fbObj['totalAdsVisible'] as number : 0;
  const googleAds = typeof googleObj?.['totalAdsVisible'] === 'number' ? googleObj['totalAdsVisible'] as number : 0;
  const totalAds = fbAds + googleAds;
  // Only noteworthy if 10+ total ads — below that it's not impressive
  if (totalAds < 10) return null;
  const tierLabel = totalAds >= 1000 ? '1,000+' : totalAds >= 200 ? '200+' : totalAds >= 50 ? '50+' : totalAds >= 20 ? '20+' : '10+';
  const pixelCount = typeof m06?.['pixelCount'] === 'number' ? m06['pixelCount'] as number : 0;
  return { fbActive, googleActive, fbAds, googleAds, totalAds, tierLabel, pixelCount };
}

interface SentimentData { positive: number; neutral: number; negative: number; total: number; overall: string; posPct: number; negPct: number; neuPct: number; }
function extractSentiment(m22: Record<string, unknown> | null | undefined): SentimentData | null {
  if (!m22) return null;
  const sentRaw = (m22['sentiment'] as Record<string, unknown>) ?? {};
  const articles = (sentRaw['articles'] as Array<{ sentiment?: string }>) ?? [];
  const headlines = (m22['newsHeadlines'] as unknown[]) ?? [];
  const total = headlines.length > 0 ? headlines.length : articles.length;
  if (total === 0) return null;
  const positive = articles.filter(a => a.sentiment === 'positive').length;
  const neutral = articles.filter(a => a.sentiment === 'neutral').length;
  const negative = articles.filter(a => a.sentiment === 'negative').length;
  const overall = (sentRaw['overallSentiment'] as string) ?? 'neutral';
  // Only show on "What's Working" if sentiment is positive — negative/mixed is not a win
  if (overall === 'negative' || overall === 'mixed') return null;
  if (positive <= negative) return null;
  const pct = (n: number) => total > 0 ? Math.round(n / total * 100) : 0;
  return { positive, neutral, negative, total, overall, posPct: pct(positive), negPct: pct(negative), neuPct: pct(neutral) };
}

const COUNTRY_CODES: Record<string, string> = {
  'united states': 'US', 'united kingdom': 'GB', 'canada': 'CA', 'australia': 'AU', 'germany': 'DE',
  'france': 'FR', 'spain': 'ES', 'italy': 'IT', 'brazil': 'BR', 'mexico': 'MX', 'india': 'IN',
  'japan': 'JP', 'south korea': 'KR', 'netherlands': 'NL', 'sweden': 'SE', 'norway': 'NO',
  'denmark': 'DK', 'finland': 'FI', 'switzerland': 'CH', 'austria': 'AT', 'belgium': 'BE',
  'portugal': 'PT', 'ireland': 'IE', 'new zealand': 'NZ', 'singapore': 'SG', 'hong kong': 'HK',
  'israel': 'IL', 'south africa': 'ZA', 'argentina': 'AR', 'colombia': 'CO', 'chile': 'CL',
  'peru': 'PE', 'poland': 'PL', 'czech republic': 'CZ', 'romania': 'RO', 'turkey': 'TR',
  'indonesia': 'ID', 'thailand': 'TH', 'philippines': 'PH', 'vietnam': 'VN', 'malaysia': 'MY',
  'puerto rico': 'PR', 'belize': 'BZ', 'costa rica': 'CR', 'panama': 'PA', 'dominican republic': 'DO',
  'guatemala': 'GT', 'honduras': 'HN', 'el salvador': 'SV', 'nicaragua': 'NI', 'uruguay': 'UY',
  'paraguay': 'PY', 'ecuador': 'EC', 'bolivia': 'BO', 'venezuela': 'VE', 'egypt': 'EG',
  'nigeria': 'NG', 'kenya': 'KE', 'morocco': 'MA', 'ghana': 'GH', 'tanzania': 'TZ',
  'ukraine': 'UA', 'greece': 'GR', 'hungary': 'HU', 'slovakia': 'SK', 'croatia': 'HR',
  'serbia': 'RS', 'bulgaria': 'BG', 'lithuania': 'LT', 'latvia': 'LV', 'estonia': 'EE',
  'slovenia': 'SI', 'luxembourg': 'LU', 'iceland': 'IS', 'malta': 'MT', 'cyprus': 'CY',
  'taiwan': 'TW', 'china': 'CN', 'russia': 'RU', 'pakistan': 'PK', 'bangladesh': 'BD',
  'saudi arabia': 'SA', 'united arab emirates': 'AE', 'qatar': 'QA', 'kuwait': 'KW', 'bahrain': 'BH',
};

interface TrafficData { organic: number; paid: number; total: number; totalFmt: string; tierLabel: string; topCountry: string | null; topCountryCode: string | null; organicKeywords: number; }
function extractTraffic(m24: Record<string, unknown> | null | undefined, m25: Record<string, unknown> | null | undefined): TrafficData | null {
  if (!m24) return null;
  const organic = typeof m24['organicTraffic'] === 'number' ? m24['organicTraffic'] as number : 0;
  const paid = typeof m24['paidTraffic'] === 'number' ? m24['paidTraffic'] as number : 0;
  const total = typeof m24['totalTraffic'] === 'number' ? m24['totalTraffic'] as number : organic + paid;
  if (total < 5000) return null;
  const tierLabel = total >= 1_000_000 ? '1M+' : total >= 500_000 ? '500K+' : total >= 100_000 ? '100K+' : total >= 50_000 ? '50K+' : total >= 10_000 ? '10K+' : '5K+';
  const organicKeywords = typeof m24['organicKeywords'] === 'number' ? m24['organicKeywords'] as number : 0;
  const countries = (m25?.['countries'] as Array<{ country?: string }>) ?? [];
  const topCountryName = countries.length > 0 ? (countries[0]!.country ?? null) : null;
  const topCountryCode = topCountryName ? (COUNTRY_CODES[topCountryName.toLowerCase()] ?? null) : null;
  return { organic, paid, total, totalFmt: fmtNum(total), tierLabel, topCountry: topCountryName, topCountryCode, organicKeywords };
}

interface TopKeywordData { keyword: string; position: number; volume: number; volumeFmt: string; totalOrganic: number; }
function extractTopKeyword(m26: Record<string, unknown> | null | undefined): TopKeywordData | null {
  if (!m26) return null;
  const kws = (m26['topKeywords'] as Array<{ keyword: string; rankAbsolute: number; searchVolume: number }>) ?? [];
  if (kws.length === 0) return null;
  const top = kws[0]!;
  const totalOrganic = typeof m26['totalOrganic'] === 'number' ? m26['totalOrganic'] as number : kws.length;
  return { keyword: top.keyword, position: top.rankAbsolute, volume: top.searchVolume, volumeFmt: fmtNum(top.searchVolume), totalOrganic };
}

// ── Slide 2 Widget Renderers ────────────────────────────────

function healthColor(h: string): string { return h === 'good' ? '#22C55E' : h === 'warn' ? '#EAB308' : '#EF4444'; }

function svgGauge(value: number, max: number, health: string, label: string, isCls: boolean): string {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = 34;
  const circumHalf = Math.PI * r;
  const dash = circumHalf * pct;
  const color = healthColor(health);
  const display = isCls ? value.toFixed(3) : value.toFixed(1) + 's';
  return `<div class="cwv-gauge">
    <svg width="86" height="50" viewBox="0 0 80 46">
      <path d="M 6 44 A ${r} ${r} 0 0 1 74 44" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6" stroke-linecap="round" />
      <path d="M 6 44 A ${r} ${r} 0 0 1 74 44" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(1)} ${circumHalf.toFixed(1)}" />
    </svg>
    <div class="cwv-val" style="color:${color}">${display}</div>
    <div class="cwv-lbl">${label}</div>
  </div>`;
}

function renderCWVWidget(cwv: CWVData): string {
  return `<div class="widget">
    <div class="widget-accent" style="background:linear-gradient(180deg,#22C55E,#16A34A)"></div>
    <div class="widget-body">
      <div class="widget-hdr">
        <span class="widget-icon">&#x26A1;</span>
        <span class="widget-title">SITE SPEED</span>
      </div>
      <div class="cwv-row">
        ${cwv.metrics.map(m => svgGauge(m.sec, m.max, m.health, m.label, m.label === 'CLS')).join('')}
      </div>
      <div class="widget-verdict">PASSING</div>
    </div>
  </div>`;
}

function renderAdsWidget(ads: PaidAdsData): string {
  const dot = (active: boolean) => `<span class="ads-dot" style="background:${active ? '#22C55E' : '#475569'}"></span>`;
  const platforms: string[] = [];
  if (ads.fbActive) platforms.push(`<div class="ads-row">${dot(true)}<span class="ads-name">Facebook / Meta</span><span class="ads-count">${ads.fbAds}</span></div>`);
  if (ads.googleActive) platforms.push(`<div class="ads-row">${dot(true)}<span class="ads-name">Google Search</span><span class="ads-count">${ads.googleAds}</span></div>`);
  return `<div class="widget">
    <div class="widget-accent" style="background:linear-gradient(180deg,#3B82F6,#2563EB)"></div>
    <div class="widget-body">
      <div class="widget-hdr">
        <span class="widget-icon">&#x1F4E2;</span>
        <span class="widget-title">ACTIVE ADS</span>
      </div>
      <div class="ads-hero">${ads.totalAds}</div>
      <div class="widget-badge">${ads.tierLabel} Running</div>
      <div class="ads-platforms">${platforms.join('')}</div>
      ${ads.pixelCount > 0 ? `<div class="ads-pixels">${ads.pixelCount} tracking pixel${ads.pixelCount !== 1 ? 's' : ''}</div>` : ''}
    </div>
  </div>`;
}

function renderSentimentWidget(s: SentimentData): string {
  const barSeg = (pct: number, color: string) => pct > 0 ? `<div style="width:${pct}%;background:${color};height:100%;border-radius:3px"></div>` : '';
  return `<div class="widget">
    <div class="widget-accent" style="background:linear-gradient(180deg,#22C55E,#16A34A)"></div>
    <div class="widget-body">
      <div class="widget-hdr">
        <span class="widget-icon">&#x1F4F0;</span>
        <span class="widget-title">NEWS SENTIMENT</span>
      </div>
      <div class="sentiment-total">${s.total}</div>
      <div class="sentiment-sub-label">Media Mentions</div>
      <div class="sentiment-bar">${barSeg(s.posPct, '#22C55E')}${barSeg(s.neuPct, '#475569')}${barSeg(s.negPct, '#EF4444')}</div>
      <div class="sentiment-legend">
        <span class="sent-pos">+${s.positive} (${s.posPct}%)</span>
        <span class="sent-neg">&minus;${s.negative} (${s.negPct}%)</span>
      </div>
      <div class="widget-verdict">${esc(s.overall.charAt(0).toUpperCase() + s.overall.slice(1))}</div>
    </div>
  </div>`;
}

function renderTrafficWidget(t: TrafficData): string {
  const orgPct = t.total > 0 ? Math.round(t.organic / t.total * 100) : 0;
  const paidPct = 100 - orgPct;
  return `<div class="widget">
    <div class="widget-accent" style="background:linear-gradient(180deg,#8B5CF6,#6D28D9)"></div>
    <div class="widget-body">
      <div class="widget-hdr">
        <span class="widget-icon">&#x1F4C8;</span>
        <span class="widget-title">TRAFFIC VOLUME</span>
      </div>
      <div class="traffic-hero">${t.totalFmt}</div>
      <div class="traffic-tier">${t.tierLabel} monthly visits</div>
      <div class="traffic-bar-wrap">
        <div class="traffic-bar">
          <div class="traffic-bar-org" style="width:${orgPct}%"></div>
          <div class="traffic-bar-paid" style="width:${paidPct}%"></div>
        </div>
        <div class="traffic-legend">
          <span class="traf-org"><span class="traf-dot" style="background:#22C55E"></span>Organic ${fmtNum(t.organic)}</span>
          <span class="traf-paid"><span class="traf-dot" style="background:#F59E0B"></span>Paid ${fmtNum(t.paid)}</span>
        </div>
      </div>
      ${t.topCountryCode ? `<div class="traffic-country">#1 Market <span class="country-code">${t.topCountryCode}</span></div>` : ''}
    </div>
  </div>`;
}

function renderKeywordWidget(kw: TopKeywordData): string {
  return `<div class="widget">
    <div class="widget-accent" style="background:linear-gradient(180deg,#F59E0B,#D97706)"></div>
    <div class="widget-body">
      <div class="widget-hdr">
        <span class="widget-icon">&#x1F50D;</span>
        <span class="widget-title">TOP KEYWORD</span>
      </div>
      <div class="kw-name">&ldquo;${esc(kw.keyword)}&rdquo;</div>
      <div class="kw-pos">Position <span class="kw-rank">#${kw.position}</span></div>
      <div class="kw-meta">
        <span class="kw-vol">${kw.volumeFmt} searches/mo</span>
        <span class="kw-total">${fmtNum(kw.totalOrganic)} ranked</span>
      </div>
    </div>
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

  // Count total pages first
  let totalPages = 2; // cover + closer always present
  if (winsHighlights.length > 0) totalPages++;
  if (topIssues.length > 0) totalPages++;
  if (initiatives.length > 0 || timelineItems.length > 0) totalPages++;
  if (categoryProjections.length > 0 || impactOutcomes.length > 0) totalPages++;
  if (toolPitches.length > 0 && ctx.hasM45) totalPages++;

  let pageNum = 0;

  // 1. Cover
  pageNum++;
  pages.push(renderCover(ctx, coverSubtitle, dateFmt, pageNum, totalPages));

  // 2. What's Working
  if (winsHighlights.length > 0) {
    pageNum++;
    pages.push(renderWins(winsNarrative, winsHighlights, ctx, pageNum, totalPages));
  }

  // 3. Top 3 Issues
  if (topIssues.length > 0) {
    pageNum++;
    pages.push(renderIssues(topIssues, pageNum, totalPages, ctx.userEmail));
  }

  // 4. Roadmap
  if (initiatives.length > 0 || timelineItems.length > 0) {
    pageNum++;
    pages.push(renderRoadmap(initiatives, timelineSummary, timelineItems, nextSteps, pageNum, totalPages, ctx.userEmail));
  }

  // 5. Results
  if (categoryProjections.length > 0 || impactOutcomes.length > 0) {
    pageNum++;
    pages.push(renderResults(impactHeadline, impactOutcomes, categoryProjections, pageNum, totalPages, ctx.userEmail));
  }

  // 6. Tools
  if (toolPitches.length > 0 && ctx.hasM45) {
    pageNum++;
    pages.push(renderTools(toolPitches, pageNum, totalPages, ctx.userEmail));
  }

  // 7. Closer
  pageNum++;
  pages.push(renderCloser(ctx, closingMessage, pageNum, totalPages));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Boss Deck — ${domainSafe}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Source+Code+Pro:wght@400;600;700&family=Permanent+Marker&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
</defs></svg>
<div class="print-banner">
  <span>Boss Deck — ${domainSafe}</span>
  <button onclick="window.print()">Save as PDF</button>
</div>
${pages.join('\n')}
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE 1: COVER — Full-bleed hero image
// ═══════════════════════════════════════════════════════════════

function renderCover(ctx: BossDeckRenderContext, subtitle: string, dateFmt: string, _pageNum: number, _totalPages: number): string {
  return `<div class="page cover-page">
  <img class="cover-bg" src="${ctx.coverImageDataUri ?? '/boss-deck/hero-cover.jpg'}" alt="" />
  <div class="cover-gradient"></div>
  <div class="cover-accent-line"></div>

  <div class="cover-content">
    <div class="cover-left">
      <div class="cover-type-label">MARKETING AUDIT BRIEFING</div>
      <h1 class="cover-business-name">${esc(ctx.businessName || ctx.domain)}</h1>
      <div class="cover-divider"></div>
      <p class="cover-subtitle">${esc(subtitle)}</p>
    </div>
  </div>

  <div class="cover-bottom-bar">
    <div class="bar-grain"></div>
    <span>Prepared by ${esc(ctx.userEmail)}</span>
    <span>${esc(dateFmt)}</span>
    <span class="cover-powered">Powered by AlphaScan</span>
  </div>
</div>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE 2: WHAT'S WORKING — Light, big stats
// ═══════════════════════════════════════════════════════════════

function renderWins(narrative: string, highlights: BossDeckAIOutput['wins_highlights'], ctx: BossDeckRenderContext, pageNum: number, totalPages: number): string {
  const strengths = getStrengths(ctx);

  // Extract widget data — only shows noteworthy wins
  const cwv = extractCWV(ctx.m03Data);
  const ads = extractPaidAds(ctx.m21Data, ctx.m06Data);
  const sentiment = extractSentiment(ctx.m22Data);
  const traffic = extractTraffic(ctx.m24Data, ctx.m25Data);
  const topKw = extractTopKeyword(ctx.m26Data);

  const widgets: string[] = [];
  if (cwv) widgets.push(renderCWVWidget(cwv));
  if (ads) widgets.push(renderAdsWidget(ads));
  if (sentiment) widgets.push(renderSentimentWidget(sentiment));
  if (traffic) widgets.push(renderTrafficWidget(traffic));
  if (topKw) widgets.push(renderKeywordWidget(topKw));

  // Strength pills (inline)
  const pillsHtml = strengths.length > 0 ? strengths.map(s =>
    `<span class="str-pill" style="background:${lightBg(s.light)};color:${lightColor(s.light)}">${esc(s.name)}</span>`
  ).join('') : '';

  // Dynamic grid sizing: if 4+ widgets use 2 rows, otherwise 1 row
  const gridCols = widgets.length >= 4 ? Math.ceil(widgets.length / 2) : widgets.length;

  return `<div class="page wins-page">
  <!-- Light header section -->
  <div class="wins-top-section">
    <div class="wins-top-inner">
      <div class="section-header-light">
        <div class="section-number">02</div>
        <div class="section-label">CURRENT PERFORMANCE</div>
      </div>

      <div class="wins-header-strip">
        <div class="wins-header-left">
          <h2 class="title-light wins-title-sm">Here&rsquo;s What&rsquo;s Already Working</h2>
          <p class="wins-narrative-sm">${esc(narrative)}</p>
        </div>
        ${pillsHtml ? `<div class="wins-pills">${pillsHtml}</div>` : ''}
      </div>
    </div>
  </div>

  ${widgets.length > 0 ? `
  <!-- Dark data band -->
  <div class="wins-dark-band">
    <div class="wins-band-glow-1"></div>
    <div class="wins-band-glow-2"></div>
    <div class="wins-band-grain"></div>
    <div class="wins-band-inner">
      <div class="wins-widget-grid" style="grid-template-columns:repeat(${widgets.length > 3 ? Math.ceil(widgets.length / 2) : widgets.length}, 1fr)">
        ${widgets.join('\n')}
      </div>
    </div>
  </div>` : ''}

  <!-- AI stat cards -->
  <div class="wins-bottom-section">
    <div class="wins-stats-row">
      ${highlights.map(h => `
      <div class="stat-card-sm">
        <div class="stat-accent"></div>
        <div class="stat-content">
          <div class="stat-val-sm">${esc(h.metric_value)}</div>
          <div class="stat-lbl-sm">${esc(h.metric_label)}</div>
          <div class="stat-ctx-sm">${esc(h.context)}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>
  ${footer(pageNum, totalPages, 'light', ctx.userEmail)}
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
// PAGE 3: TOP 3 ISSUES — Dark, dramatic
// ═══════════════════════════════════════════════════════════════

function renderIssues(issues: BossDeckAIOutput['top_issues'], pageNum: number, totalPages: number, userName: string): string {
  return `<div class="page dark-page">
  <div class="page-inner">
    <div class="section-header-dark">
      <div class="section-number-dark">03</div>
      <div class="section-label-dark">CRITICAL FINDINGS</div>
    </div>

    <h2 class="title-dark">Three Things<br/>Holding Us Back</h2>

    <div class="issues-grid">
      ${issues.map((issue, i) => `
      <div class="issue-card">
        <div class="issue-top">
          <span class="issue-num">${String(i + 1).padStart(2, '0')}</span>
          ${urgencyTag(issue.urgency)}
        </div>
        <h3 class="issue-headline">${esc(issue.headline)}</h3>
        <p class="issue-explanation">${esc(issue.explanation)}</p>
        <div class="issue-impact">
          <div class="impact-icon">↗</div>
          <div class="impact-text">${esc(issue.dollar_impact)}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>
  ${footer(pageNum, totalPages, 'dark', userName)}
</div>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE 4: ROADMAP — Light, initiative cards + timeline
// ═══════════════════════════════════════════════════════════════

function renderRoadmap(
  initiatives: BossDeckAIOutput['initiatives'],
  timelineSummary: string,
  timelineItems: BossDeckAIOutput['timeline_items'],
  nextSteps: string[],
  pageNum: number,
  totalPages: number,
  userName: string,
): string {
  const phaseColors = ['#EF4444', '#F59E0B', '#3B82F6', '#64748B'];

  return `<div class="page light-page">
  <div class="page-inner">
    <div class="section-header-light">
      <div class="section-number">04</div>
      <div class="section-label">ACTION PLAN</div>
    </div>

    <h2 class="title-light">The Roadmap</h2>
    ${timelineSummary ? `<p class="roadmap-summary">${esc(timelineSummary)}</p>` : ''}

    <div class="initiatives-grid">
      ${initiatives.map(init => {
        const oc = ownerColor(init.owner);
        return `
      <div class="initiative-card">
        <div class="init-accent" style="background:${oc}"></div>
        <div class="init-content">
          <span class="init-owner" style="color:${oc}">${esc(init.owner)}</span>
          <h4 class="init-name">${esc(init.name)}</h4>
          <ul class="init-items">
            ${init.items.map(item => `<li>${esc(item)}</li>`).join('')}
          </ul>
          <div class="init-meta">
            <span class="init-outcome">${esc(init.expected_outcome)}</span>
          </div>
        </div>
      </div>`;
      }).join('')}
    </div>

    ${timelineItems.length > 0 ? `
    <div class="timeline-section">
      <div class="timeline-track">
        ${timelineItems.map((phase, i) => `
        <div class="timeline-phase" style="flex:1">
          <div class="tl-dot" style="background:${phaseColors[i] ?? '#64748B'}"></div>
          <div class="tl-label" style="color:${phaseColors[i] ?? '#64748B'}">${esc(phase.phase)}</div>
          ${phase.items.slice(0, 3).map(item => `<div class="tl-item">${esc(item)}</div>`).join('')}
        </div>`).join('')}
      </div>
      <div class="timeline-line"></div>
    </div>` : ''}

  </div>

  ${nextSteps.length > 0 ? `
  <div class="actions-band">
    <div class="bar-grain"></div>
    <div class="actions-inner">
      <div class="actions-left">
        <div class="actions-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="10" stroke="#fff" stroke-width="1.5" opacity="0.4"/></svg>
        </div>
        <div class="actions-title-block">
          <div class="actions-label">READY TO APPROVE</div>
          <div class="actions-subtitle">Three things to greenlight today</div>
        </div>
      </div>
      <div class="actions-list">
        ${nextSteps.slice(0, 3).map((s, i) => `
        <div class="action-item">
          <div class="action-num">${i + 1}</div>
          <div class="action-text">${esc(s)}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>` : ''}

  ${footer(pageNum, totalPages, 'light', userName)}
</div>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE 5: RESULTS — Dark with background image
// ═══════════════════════════════════════════════════════════════

function renderResults(
  headline: string,
  outcomes: BossDeckAIOutput['implementation_outcomes'],
  projections: BossDeckAIOutput['category_projections'],
  pageNum: number,
  totalPages: number,
  userName: string,
): string {
  return `<div class="page dark-page results-page">
  <div class="results-plasma"></div>
  <div class="results-glow-1"></div>
  <div class="results-glow-2"></div>
  <div class="results-glow-3"></div>
  <div class="results-grain"></div>
  <div class="results-vignette"></div>
  <div class="results-gold-line"></div>

  <div class="page-inner results-inner">
    <div class="section-header-dark">
      <div class="section-number-dark">05</div>
      <div class="section-label-dark">PROJECTED IMPACT</div>
    </div>

    <h2 class="title-dark">${esc(headline)}</h2>

    ${projections.length > 0 ? `
    <div class="projection-table">
      <div class="proj-header">
        <span class="proj-h-cat">Category</span>
        <span class="proj-h-now">Current</span>
        <span class="proj-h-after">Projected</span>
        <span class="proj-h-note">What Changes</span>
      </div>
      ${projections.map(p => `
      <div class="proj-row">
        <span class="proj-cat">${esc(p.category)}</span>
        <span class="proj-light">
          <span class="proj-dot-ring" style="border-color:${lightColor(p.current_light)}30">
            <span class="proj-dot" style="background:${lightColor(p.current_light)};box-shadow:0 0 10px ${lightColor(p.current_light)}50"></span>
          </span>
        </span>
        <span class="proj-light">
          <span class="proj-dot-ring" style="border-color:${lightColor(p.projected_light)}30">
            <span class="proj-dot" style="background:${lightColor(p.projected_light)};box-shadow:0 0 10px ${lightColor(p.projected_light)}50"></span>
          </span>
        </span>
        <span class="proj-note">${esc(p.explanation)}</span>
      </div>`).join('')}
    </div>` : ''}

    ${outcomes.length > 0 ? `
    <div class="outcomes-grid">
      ${outcomes.map(o => `
      <div class="outcome-card">
        <div class="outcome-accent"></div>
        <div class="outcome-body">
          <div class="outcome-text">${esc(o.outcome)}</div>
          <div class="outcome-evidence">${esc(o.evidence)}</div>
        </div>
      </div>`).join('')}
    </div>` : ''}
  </div>
  ${footer(pageNum, totalPages, 'image', userName)}
</div>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE 6: TOOL INVESTMENT — Light
// ═══════════════════════════════════════════════════════════════

function renderTools(pitches: BossDeckAIOutput['tool_pitches'], pageNum: number, totalPages: number, userName: string): string {
  return `<div class="page light-page">
  <div class="page-inner">
    <div class="section-header-light">
      <div class="section-number">06</div>
      <div class="section-label">TECHNOLOGY</div>
    </div>

    <h2 class="title-light">Technology Investment</h2>

    <div class="tools-grid">
      ${pitches.map(p => {
        const isReplace = p.what_it_replaces && p.what_it_replaces !== 'New addition';
        return `
      <div class="tool-card">
        <div class="tool-left">
          <div class="tool-label">${isReplace ? 'CURRENTLY USING' : 'CURRENT GAP'}</div>
          <div class="tool-current-name ${isReplace ? '' : 'tool-no-coverage'}">${isReplace ? esc(p.what_it_replaces) : 'Nothing in place'}</div>
          ${!isReplace ? '<div class="tool-gap-dot">●</div>' : ''}
        </div>
        <div class="tool-arrow">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m0 0l-4-4m4 4l-4 4" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="tool-right">
          <div class="tool-label">RECOMMENDED</div>
          <div class="tool-rec-name">${esc(p.tool_name)}</div>
          <div class="tool-pitch">${esc(p.why_we_need_it)}</div>
        </div>
        <div class="tool-gap-row">${esc(p.capability_gap)}</div>
      </div>`;
      }).join('')}
    </div>
  </div>
  ${footer(pageNum, totalPages, 'light', userName)}
</div>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE 7: CLOSER — Full-bleed horizon image
// ═══════════════════════════════════════════════════════════════

function renderCloser(ctx: BossDeckRenderContext, _closingMessage: string, _pageNum: number, _totalPages: number): string {
  const score = ctx.marketingIQ;
  const label = ctx.marketingIQLabel ?? '';
  const scoreColor = score != null && score >= 70 ? '#22C55E' : score != null && score >= 40 ? '#EAB308' : '#EF4444';
  const dateFmt = formatDate(ctx.scanDate);

  const ASCII_BRAND = ` █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`;

  // Build Bayer 8x8 dither as inline SVG (since no canvas/JS in server HTML)
  const ditherSvg = buildDitherSVG();

  // Seal SVG
  const sealSvg = buildSealSVG(score);

  return `<div class="page closer-page">
  <!-- Layer 0: Horizon image — heavily blurred as texture base -->
  <img class="closer-bg" src="${ctx.closerImageDataUri ?? '/boss-deck/hero-horizon.jpg'}" alt="" />

  <!-- Layer 1: Deep gradient overlay -->
  <div class="closer-plasma"></div>

  <!-- Layer 2: Radial color glows -->
  <div class="closer-glow-blue"></div>
  <div class="closer-glow-gold"></div>
  <div class="closer-glow-center"></div>
  <div class="closer-glow-top"></div>

  <!-- Layer 3: Noise grain -->
  <div class="closer-grain"></div>

  <!-- Layer 4: Vignette -->
  <div class="closer-vignette"></div>

  <!-- Layer 5: Gold accent lines -->
  <div class="closer-line-top"></div>
  <div class="closer-line-bottom"></div>

  <!-- Centered vertical stack -->
  <div class="closer-stack">
    <!-- ASCII Brand with bloom glow -->
    <pre class="closer-ascii">${ASCII_BRAND}</pre>

    <!-- Subtitle -->
    <div class="closer-subtitle">Marketing Technology Audit</div>

    <!-- Glowing divider -->
    <div class="closer-rule"></div>

    <!-- Domain -->
    <h2 class="closer-domain-name">${esc(ctx.domain)}</h2>

    <!-- Score -->
    ${score != null ? `
    <div class="closer-score-num" style="color:${scoreColor};filter:drop-shadow(0 0 20px ${scoreColor}30)">${score}</div>
    <div class="closer-score-sub">MARKETINGIQ&trade;</div>
    <div class="closer-score-label" style="color:${scoreColor}">${esc(label)}</div>
    ` : ''}

    <!-- Glowing divider -->
    <div class="closer-rule"></div>

    <!-- Date + meta -->
    <div class="closer-meta">${esc(dateFmt)}</div>

    <!-- Sign-off -->
    <p class="closer-signoff">Now you know.</p>
  </div>

  <!-- Footer -->
  <div class="closer-footer-text">
    <span>Automated MarTech Assessment &middot; AlphaScan</span>
  </div>

  <!-- Verification seal — bottom right -->
  ${score != null ? `
  <div class="closer-seal">${sealSvg}</div>
  ` : ''}

  <!-- Bayer dither strip -->
  <div class="closer-dither">${ditherSvg}</div>
</div>`;
}

// ── Bayer 8x8 dither as inline SVG ──────────────────────────────────

function buildDitherSVG(): string {
  const BAYER8 = [
    [ 0,32, 8,40, 2,34,10,42],
    [48,16,56,24,50,18,58,26],
    [12,44, 4,36,14,46, 6,38],
    [60,28,52,20,62,30,54,22],
    [ 3,35,11,43, 1,33, 9,41],
    [51,19,59,27,49,17,57,25],
    [15,47, 7,39,13,45, 5,37],
    [63,31,55,23,61,29,53,21],
  ];

  const cols = 300;
  const rows = 20;
  const rects: string[] = [];
  const r = 59, g = 130, b = 246; // #3B82F6

  for (let y = 0; y < rows; y++) {
    const yRatio = y / rows;
    const vDensity = Math.min(0.35, Math.pow(yRatio, 2));
    for (let x = 0; x < cols; x++) {
      const xRatio = x / cols;
      const hFade = Math.sin(xRatio * Math.PI);
      const intensity = vDensity * hFade * 0.5;
      const threshold = (BAYER8[y % 8]![x % 8]!) / 64;
      if (intensity > threshold) {
        const alpha = Math.round(intensity * 0.6 * 100) / 100;
        rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="rgba(${r},${g},${b},${alpha})"/>`);
      }
    }
  }

  return `<svg viewBox="0 0 ${cols} ${rows}" preserveAspectRatio="none" style="width:100%;height:100%;image-rendering:pixelated">${rects.join('')}</svg>`;
}

// ── Verification seal SVG ───────────────────────────────────────────

function buildSealSVG(score: number | null): string {
  const s = 120, cx = 60, cy = 60;
  const bl = 'rgba(59,130,246,'; // blue accent

  const dots: string[] = [];
  for (let i = 0; i < 24; i++) {
    const angle = ((i * 15) - 90) * Math.PI / 180;
    const x = cx + 54 * Math.cos(angle);
    const y = cy + 54 * Math.sin(angle);
    const r = i % 3 === 0 ? 2 : 1;
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${bl}${r > 1 ? '0.5' : '0.25'})"/>`);
  }

  const diamonds: string[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = ((i * 45) - 90) * Math.PI / 180;
    const x = cx + 57 * Math.cos(angle);
    const y = cy + 57 * Math.sin(angle);
    diamonds.push(`<path d="M ${x.toFixed(1)} ${(y - 2.5).toFixed(1)} L ${(x + 1).toFixed(1)} ${y.toFixed(1)} L ${x.toFixed(1)} ${(y + 2.5).toFixed(1)} L ${(x - 1).toFixed(1)} ${y.toFixed(1)} Z" fill="${bl}0.4)"/>`);
  }

  return `<svg viewBox="0 0 ${s} ${s}" style="width:100%;height:100%">
    <circle cx="${cx}" cy="${cy}" r="56" fill="none" stroke="${bl}0.35)" stroke-width="1.2"/>
    ${dots.join('')}
    ${diamonds.join('')}
    <circle cx="${cx}" cy="${cy}" r="44" fill="none" stroke="${bl}0.18)" stroke-width="0.5" stroke-dasharray="3 3"/>
    <circle cx="${cx}" cy="${cy}" r="40" fill="none" stroke="${bl}0.12)" stroke-width="0.5"/>
    <text x="${cx}" y="${cy - 18}" text-anchor="middle" dominant-baseline="central" style="font-size:6.5px;font-family:'Sora',sans-serif;fill:${bl}0.55);letter-spacing:2.5px">ALPHASCAN</text>
    <line x1="${cx - 22}" y1="${cy - 10}" x2="${cx + 22}" y2="${cy - 10}" stroke="${bl}0.2)" stroke-width="0.5"/>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" style="font-size:11px;font-family:'Sora',sans-serif;font-weight:700;fill:${bl}0.65);letter-spacing:2px">VERIFIED</text>
    <text x="${cx}" y="${cy + 13}" text-anchor="middle" dominant-baseline="central" style="font-size:7px;font-family:'Sora',sans-serif;fill:${bl}0.45);letter-spacing:3px">AUDIT</text>
    <line x1="${cx - 22}" y1="${cy + 21}" x2="${cx + 22}" y2="${cy + 21}" stroke="${bl}0.2)" stroke-width="0.5"/>
    ${score != null ? `<text x="${cx}" y="${cy + 32}" text-anchor="middle" dominant-baseline="central" style="font-size:9px;font-family:'Sora',sans-serif;font-weight:700;fill:${bl}0.5);letter-spacing:1px">MIQ ${score}</text>` : ''}
  </svg>`;
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
html, body { width: 14in; background: #0A0E1A; }
body { font-family: 'DM Sans', system-ui, sans-serif; font-size: 13px; color: #1E293B; }

/* ── Print Banner ─────────────────────────────────── */
.print-banner {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  background: #0A0E1A; color: #E2E8F0; padding: 10px 24px;
  font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 500;
  display: flex; align-items: center; justify-content: center; gap: 16px;
  border-bottom: 1px solid rgba(59,130,246,0.3);
}
.print-banner button {
  background: #3B82F6; color: #fff; border: none; padding: 8px 28px;
  font-family: 'Sora', sans-serif; font-weight: 600; font-size: 12px;
  border-radius: 6px; cursor: pointer; letter-spacing: 0.05em;
  text-transform: uppercase; transition: background 0.2s;
}
.print-banner button:hover { background: #2563EB; }
@media print {
  .print-banner { display: none; }
  body { margin-top: 0; }
  .page { overflow: visible !important; }
  .cover-bottom-bar,
  .footer-dark,
  .actions-band {
    background: linear-gradient(135deg, rgba(6,10,20,0.92) 0%, rgba(10,22,40,0.90) 30%, rgba(14,31,58,0.90) 60%, rgba(10,22,40,0.92) 100%) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .cover-bottom-bar > span,
  .footer-dark > span {
    color: rgba(255,255,255,0.55) !important;
  }
  .footer-light {
    background: linear-gradient(135deg, rgba(235,238,243,0.92) 0%, rgba(232,236,242,0.90) 30%, rgba(234,236,240,0.90) 60%, rgba(235,238,243,0.92) 100%) !important;
  }
  .cover-bottom-bar::before,
  .cover-bottom-bar::after,
  .footer-dark::before,
  .footer-dark::after,
  .footer-light::before,
  .footer-light::after,
  .actions-band::before,
  .actions-band::after {
    content: '' !important;
    display: block !important;
  }
  .bar-grain,
  .bar-grain-light,
  .results-grain,
  .closer-grain {
    opacity: 0 !important;
  }
}
@media screen { body { margin-top: 50px; } }

/* ── Page base ────────────────────────────────────── */
.page {
  width: 14in; height: 8.5in; position: relative; overflow: hidden;
  page-break-after: always; break-inside: avoid;
}
.page:last-child { page-break-after: auto; }
.dark-page { background: #0A0E1A; color: #E2E8F0; }
.light-page { background: #F8FAFC; color: #1E293B; }
.page-inner { padding: 0.6in 0.75in; height: calc(100% - 36px); position: relative; z-index: 2; }

/* ── Shared ───────────────────────────────────────── */
/* Grain overlays */
.bar-grain {
  position: absolute; inset: 0; pointer-events: none;
  filter: url(#grain); opacity: 0.08; z-index: 0;
}
.bar-grain-light {
  position: absolute; inset: 0; pointer-events: none;
  filter: url(#grain); opacity: 0.08; z-index: 0;
}

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

/* ═══ WINS v3 — Split layout (light header → dark data band → light stats) ═══ */
.wins-page {
  background: #F8FAFC;
  display: flex; flex-direction: column;
}
.wins-top-section {
  padding: 0.55in 0.75in 0;
  flex-shrink: 0;
}
.wins-top-inner { }
.wins-header-strip {
  display: flex; align-items: flex-start; gap: 40px; margin-bottom: 16px;
}
.wins-header-left { flex: 1; min-width: 0; }
.wins-title-sm {
  font-size: 28px !important; margin-bottom: 6px !important; line-height: 1.1;
}
.wins-narrative-sm {
  font-size: 13px; color: #475569; line-height: 1.6;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.wins-pills {
  display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0; padding-top: 6px;
}
.str-pill {
  display: inline-block; font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  padding: 4px 12px; border-radius: 4px; white-space: nowrap;
}

/* ── Dark data band ─────────────────────────────── */
.wins-dark-band {
  position: relative; overflow: hidden;
  background: linear-gradient(135deg, #060A14 0%, #0A1628 30%, #0E1F3A 60%, #0A1628 100%);
  border-top: 3px solid #3B82F6;
  margin: 0 0.35in;
  border-radius: 14px;
  flex: 1;
}
.wins-band-glow-1 {
  position: absolute; z-index: 0; pointer-events: none;
  top: -30%; left: -10%; width: 55%; height: 160%;
  background: radial-gradient(ellipse at center, rgba(59,130,246,0.1) 0%, transparent 60%);
}
.wins-band-glow-2 {
  position: absolute; z-index: 0; pointer-events: none;
  bottom: -40%; right: -10%; width: 50%; height: 160%;
  background: radial-gradient(ellipse at center, rgba(139,92,246,0.06) 0%, transparent 55%);
}
.wins-band-grain {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  filter: url(#grain); opacity: 0.08;
}
.wins-band-inner {
  position: relative; z-index: 2;
  padding: 24px 28px;
}

/* Widget grid — auto height, no stretch */
.wins-widget-grid {
  display: grid; gap: 16px;
}
.widget {
  display: flex; overflow: hidden;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  backdrop-filter: blur(6px);
}
.widget-accent {
  width: 4px; flex-shrink: 0; border-radius: 2px 0 0 2px;
}
.widget-body {
  flex: 1; padding: 14px 18px;
}
.widget-hdr {
  display: flex; align-items: center; gap: 7px;
  margin-bottom: 10px;
}
.widget-icon {
  font-size: 12px; line-height: 1;
}
.widget-title {
  font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 0.14em; color: #64748B; text-transform: uppercase;
}
.widget-verdict {
  font-family: 'Sora', sans-serif; font-size: 10px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase; text-align: center;
  margin-top: 8px; color: #22C55E;
}
.widget-badge {
  display: inline-block; font-family: 'Sora', sans-serif; font-size: 10px; font-weight: 700;
  letter-spacing: 0.06em; padding: 3px 10px; border-radius: 4px;
  background: rgba(59,130,246,0.15); color: #60A5FA;
  text-align: center;
}

/* CWV gauges */
.cwv-row { display: flex; justify-content: center; gap: 20px; }
.cwv-gauge { text-align: center; }
.cwv-val {
  font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 800;
  margin-top: -2px; line-height: 1;
}
.cwv-lbl {
  font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 0.12em; color: #64748B; margin-top: 2px;
}

/* Paid ads */
.ads-hero {
  font-family: 'Sora', sans-serif; font-size: 32px; font-weight: 800;
  color: #FFFFFF; line-height: 1; text-align: center; margin-bottom: 4px;
}
.ads-platforms { margin-top: 8px; }
.ads-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: #CBD5E1; font-weight: 500; margin-top: 4px;
}
.ads-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.ads-name { flex: 1; }
.ads-count {
  font-family: 'Sora', sans-serif; font-weight: 700; color: #22C55E; font-size: 12px;
}
.ads-pixels {
  font-size: 11px; color: #64748B; font-style: italic; margin-top: 6px;
}

/* Sentiment */
.sentiment-total {
  font-family: 'Sora', sans-serif; font-size: 28px; font-weight: 800;
  color: #FFFFFF; line-height: 1; text-align: center;
}
.sentiment-sub-label {
  font-size: 10px; font-weight: 500; letter-spacing: 0.08em;
  color: #64748B; text-align: center; margin-top: 2px;
}
.sentiment-bar {
  display: flex; height: 7px; border-radius: 4px; overflow: hidden;
  background: rgba(255,255,255,0.08); gap: 1px; margin: 8px 0 6px;
}
.sentiment-legend {
  display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;
}
.sent-pos { color: #22C55E; }
.sent-neg { color: #EF4444; }

/* Traffic */
.traffic-hero {
  font-family: 'Sora', sans-serif; font-size: 32px; font-weight: 800;
  color: #FFFFFF; line-height: 1; text-align: center;
}
.traffic-tier {
  font-size: 10px; color: #64748B; text-align: center;
  letter-spacing: 0.04em; margin: 2px 0 8px;
}
.traffic-bar-wrap { margin-bottom: 4px; }
.traffic-bar {
  display: flex; height: 6px; border-radius: 3px; overflow: hidden;
  background: rgba(255,255,255,0.06);
}
.traffic-bar-org { background: #22C55E; border-radius: 3px 0 0 3px; }
.traffic-bar-paid { background: #F59E0B; border-radius: 0 3px 3px 0; }
.traffic-legend {
  display: flex; justify-content: space-between; margin-top: 4px;
  font-size: 11px; font-weight: 600; color: #CBD5E1;
}
.traf-org, .traf-paid { display: flex; align-items: center; gap: 5px; }
.traf-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.traffic-country {
  font-size: 12px; color: #64748B; text-align: center; margin-top: 6px;
}
.country-code {
  font-family: 'Sora', sans-serif; font-weight: 800; color: #FFFFFF; font-size: 14px;
  margin-left: 4px;
}

/* Top keyword */
.kw-name {
  font-family: 'Source Code Pro', monospace; font-size: 17px; font-weight: 700;
  color: #FFFFFF; text-align: center; line-height: 1.2;
  word-break: break-word;
}
.kw-pos {
  font-size: 13px; color: #CBD5E1; text-align: center; font-weight: 500; margin-top: 4px;
}
.kw-rank {
  font-family: 'Sora', sans-serif; font-weight: 800; color: #60A5FA; font-size: 15px;
}
.kw-meta {
  display: flex; justify-content: center; gap: 12px; margin-top: 6px;
}
.kw-vol, .kw-total {
  font-size: 11px; color: #64748B;
}

/* ── AI stat cards (below dark band) ─────────────── */
.wins-bottom-section {
  padding: 16px 0.75in 0;
  flex-shrink: 0;
}
.wins-stats-row {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
}
.stat-card-sm {
  display: flex; overflow: hidden;
  border-radius: 10px;
  background: #FFFFFF; border: 1px solid #E2E8F0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.stat-accent {
  width: 4px; flex-shrink: 0;
  background: linear-gradient(180deg, #3B82F6, #6366F1);
}
.stat-content {
  padding: 18px 20px; flex: 1;
}
.stat-val-sm {
  font-family: 'Sora', sans-serif; font-size: 28px; font-weight: 800;
  color: #0F172A; line-height: 1; letter-spacing: -0.02em;
  margin-bottom: 6px;
}
.stat-lbl-sm {
  font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: #3B82F6; margin-bottom: 6px;
}
.stat-ctx-sm {
  font-size: 12px; color: #64748B; line-height: 1.45;
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

/* Layer 5: Noise grain */
.results-grain {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  filter: url(#grain); opacity: 0.10;
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

/* Noise grain */
.closer-grain {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  filter: url(#grain); opacity: 0.12;
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
