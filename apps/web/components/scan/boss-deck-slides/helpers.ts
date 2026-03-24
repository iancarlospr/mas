/**
 * Boss Deck shared helpers — pure utility functions extracted from boss-deck-html.ts.
 * Used by React page components for data extraction and formatting.
 */

import type { BossDeckRenderContext } from '@/lib/report/boss-deck-html';

// ── Formatting ──────────────────────────────────────────────

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function lightColor(light: string): string {
  if (light === 'green') return '#22C55E';
  if (light === 'yellow') return '#EAB308';
  return '#EF4444';
}

export function lightBg(light: string): string {
  if (light === 'green') return 'rgba(34,197,94,0.12)';
  if (light === 'yellow') return 'rgba(234,179,8,0.12)';
  return 'rgba(239,68,68,0.12)';
}

export function ownerColor(owner: string): string {
  const map: Record<string, string> = {
    'Content Team': '#3B82F6',
    'Dev Team': '#8B5CF6',
    'Marketing Ops': '#F59E0B',
    'Design Team': '#EC4899',
    'Leadership': '#EF4444',
  };
  return map[owner] ?? '#64748B';
}

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return Math.round(n / 1_000) + 'K';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export function healthColor(h: string): string {
  return h === 'good' ? '#22C55E' : h === 'warn' ? '#EAB308' : '#EF4444';
}

// ── Urgency colors ──────────────────────────────────────────

export function urgencyColors(urgency: string): { bg: string; text: string; label: string } {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    immediate: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444', label: 'IMMEDIATE' },
    this_week: { bg: 'rgba(234,179,8,0.15)', text: '#EAB308', label: 'THIS WEEK' },
    this_month: { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6', label: 'THIS MONTH' },
  };
  return colors[urgency] ?? colors['this_month']!;
}

// ── Country codes ───────────────────────────────────────────

export const COUNTRY_CODES: Record<string, string> = {
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

// ── Widget Data Extractors ──────────────────────────────────

export interface CWVMetric { sec: number; health: string; label: string; max: number; }
export interface CWVData { metrics: CWVMetric[]; }

export function extractCWV(m03: Record<string, unknown> | null | undefined): CWVData | null {
  if (!m03) return null;
  const raw = m03['metrics'] as Record<string, unknown> | undefined;
  const crux = m03['cruxFieldData'] as Record<string, unknown> | undefined;
  const cruxP75 = (f: string) => { const m = crux?.[f] as Record<string, unknown> | undefined; return typeof m?.['p75'] === 'number' ? m['p75'] as number : null; };
  const health = (sec: number, good: number, warn: number) => sec <= good ? 'good' : sec <= warn ? 'warn' : 'poor';
  const good: CWVMetric[] = [];
  const lcpMs = typeof raw?.['lcp'] === 'number' ? raw['lcp'] as number : cruxP75('lcp');
  if (lcpMs != null && lcpMs > 0) { const s = lcpMs / 1000; const h = health(s, 2.5, 4.0); if (h === 'good') good.push({ sec: s, health: h, label: 'LCP', max: 6 }); }
  const fcpMs = typeof raw?.['fcp'] === 'number' ? raw['fcp'] as number : cruxP75('fcp');
  if (fcpMs != null && fcpMs > 0) { const s = fcpMs / 1000; const h = health(s, 1.8, 3.0); if (h === 'good') good.push({ sec: s, health: h, label: 'FCP', max: 5 }); }
  const cls = typeof raw?.['cls'] === 'number' ? raw['cls'] as number : cruxP75('cls');
  if (cls != null && cls >= 0 && cls < 0.1) good.push({ sec: cls, health: 'good', label: 'CLS', max: 0.5 });
  if (good.length === 0) return null;
  return { metrics: good };
}

export interface PaidAdsData { fbActive: boolean; googleActive: boolean; fbAds: number; googleAds: number; totalAds: number; tierLabel: string; pixelCount: number; }

export function extractPaidAds(m21: Record<string, unknown> | null | undefined, m06: Record<string, unknown> | null | undefined): PaidAdsData | null {
  if (!m21) return null;
  const summary = (m21['summary'] as Record<string, unknown>) ?? {};
  const fbActive = summary['facebookActive'] === true;
  const googleActive = summary['googleSearchActive'] === true;
  const fbObj = m21['facebook'] as Record<string, unknown> | undefined;
  const googleObj = m21['google'] as Record<string, unknown> | undefined;
  const fbAds = typeof fbObj?.['totalAdsVisible'] === 'number' ? fbObj['totalAdsVisible'] as number : 0;
  const googleAds = typeof googleObj?.['totalAdsVisible'] === 'number' ? googleObj['totalAdsVisible'] as number : 0;
  const totalAds = fbAds + googleAds;
  if (totalAds < 10) return null;
  const tierLabel = totalAds >= 1000 ? '1,000+' : totalAds >= 200 ? '200+' : totalAds >= 50 ? '50+' : totalAds >= 20 ? '20+' : '10+';
  const pixelCount = typeof m06?.['pixelCount'] === 'number' ? m06['pixelCount'] as number : 0;
  return { fbActive, googleActive, fbAds, googleAds, totalAds, tierLabel, pixelCount };
}

export interface SentimentData { positive: number; neutral: number; negative: number; total: number; overall: string; posPct: number; negPct: number; neuPct: number; }

export function extractSentiment(m22: Record<string, unknown> | null | undefined): SentimentData | null {
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
  if (overall === 'negative' || overall === 'mixed') return null;
  if (positive <= negative) return null;
  const pct = (n: number) => total > 0 ? Math.round(n / total * 100) : 0;
  return { positive, neutral, negative, total, overall, posPct: pct(positive), negPct: pct(negative), neuPct: pct(neutral) };
}

export interface TrafficData { organic: number; paid: number; total: number; totalFmt: string; tierLabel: string; topCountry: string | null; topCountryCode: string | null; organicKeywords: number; }

export function extractTraffic(m24: Record<string, unknown> | null | undefined, m25: Record<string, unknown> | null | undefined): TrafficData | null {
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

export interface TopKeywordData { keyword: string; position: number; volume: number; volumeFmt: string; totalOrganic: number; }

export function extractTopKeyword(m26: Record<string, unknown> | null | undefined): TopKeywordData | null {
  if (!m26) return null;
  const kws = (m26['topKeywords'] as Array<{ keyword: string; rankAbsolute: number; searchVolume: number }>) ?? [];
  if (kws.length === 0) return null;
  const top = kws[0]!;
  const totalOrganic = typeof m26['totalOrganic'] === 'number' ? m26['totalOrganic'] as number : kws.length;
  return { keyword: top.keyword, position: top.rankAbsolute, volume: top.searchVolume, volumeFmt: fmtNum(top.searchVolume), totalOrganic };
}

export function getStrengths(ctx: BossDeckRenderContext): { name: string; light: string }[] {
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
