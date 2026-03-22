'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  StatBlock,
  SkippedSlide,
} from './module-slide-template';

/**
 * M29 Slide — Competitor Landscape
 * ==================================
 * Layout E (RankedBars): competitor overlap bars + stats.
 *
 * Visualization:
 *   - Hero stats: Total Competitors, Seed Keywords, Top Competitor
 *   - Competitor domain bars — width proportional to keywords count or ETV
 *   - Per-competitor: avg position, keyword count, ETV
 */

export function M29Slide({ scan, onAskChloe }: { scan: ScanWithResults; onAskChloe?: () => void }) {
  const syn = getM41Summary(scan, 'M29');
  const mod = getModuleResult(scan, 'M29');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Competitor Landscape" scan={scan} sourceLabel="Source: Competitor overlap analysis, shared keyword intelligence" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Competitive landscape assessment';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Raw data extraction ────────────────────────────────────────────────
  const totalCompetitors = typeof raw?.['totalCompetitors'] === 'number' ? raw['totalCompetitors'] as number : 0;
  const seedKeywords = typeof raw?.['seedKeywords'] === 'number' ? raw['seedKeywords'] as number : 0;
  const topKeywordBySpend = raw?.['topKeywordBySpend'] as string | undefined;

  const rawCompetitors = (raw?.['topCompetitors'] as Array<Record<string, unknown>> | undefined) ?? [];
  // Handle both current shape (domain, avgPosition, keywordsCount, etv) and legacy (domain, commonKeywords, overlapScore)
  const competitors = rawCompetitors.map(c => ({
    domain: typeof c['domain'] === 'string' ? c['domain'] : '',
    avgPosition: typeof c['avgPosition'] === 'number' ? c['avgPosition'] : typeof c['avg_position'] === 'number' ? c['avg_position'] : 0,
    keywordsCount: typeof c['keywordsCount'] === 'number' ? c['keywordsCount'] : typeof c['commonKeywords'] === 'number' ? c['commonKeywords'] : typeof c['keywords_count'] === 'number' ? c['keywords_count'] : 0,
    etv: typeof c['etv'] === 'number' ? c['etv'] : 0,
    rating: typeof c['rating'] === 'number' ? c['rating'] : 0,
    visibility: typeof c['visibility'] === 'number' ? c['visibility'] : 0,
  })).filter(c => c.domain);

  const topEight = competitors.slice(0, 8);
  const topCompetitorDomain = topEight.length > 0 ? topEight[0]!.domain : null;

  return (
    <SlideShell
      moduleName="Competitor Landscape"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Competitor overlap analysis, shared keyword intelligence"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      onAskChloe={onAskChloe}
    >
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        {/* Hero stats tiles */}
        <div style={{ display: 'flex', gap: '0.5em', marginBottom: '0.6em' }}>
          {[
            { value: totalCompetitors > 0 ? totalCompetitors : '—', label: 'Competitors Found', color: totalCompetitors > 0 ? 'var(--gs-light)' : 'var(--gs-mid)', show: true },
            { value: seedKeywords, label: 'Seed Keywords', color: 'var(--gs-mid)', show: seedKeywords > 0 },
            { value: topCompetitorDomain ?? '', label: 'Top Competitor', color: 'var(--gs-base)', show: !!topCompetitorDomain },
            { value: topKeywordBySpend ? `\u201C${topKeywordBySpend}\u201D` : '', label: 'Top Keyword by Spend', color: 'var(--gs-light)', show: !!topKeywordBySpend },
          ].filter(s => s.show).map((s, i) => (
            <div key={i} style={{
              flex: (s.label === 'Top Competitor' || s.label === 'Top Keyword by Spend') ? 2 : 1,
              padding: '0.5em 0.4em', borderRadius: '4px', textAlign: 'center',
              background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <p className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.20cqi, 20px)', fontWeight: 700, lineHeight: 1.2, color: s.color }}>
                {s.value}
              </p>
              <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.68cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.06em', marginTop: '0.25em' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Competitor table */}
        {topEight.length > 0 && (
          <div>
            <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.25em' }}>
              Competitor Overlap
            </p>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 5em 4em 5em',
              gap: '0 0.6em', padding: '0 0 0.2em', borderBottom: '1px solid rgba(255,178,239,0.06)',
            }}>
              <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)' }}>Domain</span>
              <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', textAlign: 'right' }}>Shared KWs</span>
              <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', textAlign: 'right' }}>Avg Pos</span>
              <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', textAlign: 'right' }}>ETV</span>
            </div>
            {/* Table rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topEight.map((comp, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr 5em 4em 5em',
                  gap: '0 0.6em', padding: '0.2em 0',
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                }}>
                  <span className="font-data" style={{
                    fontSize: 'clamp(1px, 0.86cqi, 14px)', color: 'var(--gs-light)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {comp.domain}
                  </span>
                  <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', fontWeight: 600, textAlign: 'right' }}>
                    {comp.keywordsCount.toLocaleString()}
                  </span>
                  <span className="font-data tabular-nums" style={{
                    fontSize: 'clamp(1px, 0.83cqi, 13px)', textAlign: 'right', fontWeight: 600,
                    color: comp.avgPosition <= 10 ? 'var(--gs-terminal)' : comp.avgPosition <= 20 ? 'var(--gs-warning)' : 'var(--gs-mid)',
                  }}>
                    {comp.avgPosition > 0 ? `#${comp.avgPosition.toFixed(0)}` : '\u2014'}
                  </span>
                  <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', textAlign: 'right' }}>
                    {comp.etv > 0 ? (comp.etv >= 1000 ? `${(comp.etv / 1000).toFixed(comp.etv >= 10000 ? 0 : 1)}K` : comp.etv.toLocaleString()) : '\u2014'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No competitors message */}
        {topEight.length === 0 && (
          <p className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.6, textAlign: 'center', padding: '0.5em 0' }}>
            No competitors identified — niche market or insufficient keyword data
          </p>
        )}
      </div>
    </SlideShell>
  );
}
