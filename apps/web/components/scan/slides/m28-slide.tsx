'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  scoreColor,
  StatBlock,
  SkippedSlide,
} from './module-slide-template';

/**
 * M28 Slide — Paid Search Intelligence
 * ======================================
 * Layout C (StatBlock hero): hero stats + top keywords table.
 *
 * Visualization:
 *   - Hero stats: Total Paid Keywords, Avg CPC, Monthly Spend Estimate, Est. Clicks
 *   - Top keywords table with estimated cost as RankedBars
 *   - CPC efficiency indicator
 */

interface PaidKeyword {
  keyword: string;
  cpc: number;
  searchVolume: number;
  estimatedTraffic: number;
  position: number;
}

// ── Format currency with smart abbreviation ─────────────────────────────
function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

export function M28Slide({ scan, onAskChloe, slideNumber }: { scan: ScanWithResults; onAskChloe?: () => void; slideNumber?: string }) {
  const syn = getM41Summary(scan, 'M28');
  const mod = getModuleResult(scan, 'M28');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Paid Search Intelligence" scan={scan} sourceLabel="Source: Paid keyword data, CPC analysis, ad spend estimation" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Paid search and ad spend assessment';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Raw data extraction ────────────────────────────────────────────────
  const totalPaidKeywords = typeof raw?.['totalPaidKeywords'] === 'number' ? raw['totalPaidKeywords'] as number : 0;
  const avgCpc = typeof raw?.['avgCpc'] === 'number' ? raw['avgCpc'] as number : 0;
  const estimatedMonthlyCost = typeof raw?.['estimatedMonthlyCost'] === 'number' ? raw['estimatedMonthlyCost'] as number : 0;
  const totalEstimatedClicks = typeof raw?.['totalEstimatedClicks'] === 'number' ? raw['totalEstimatedClicks'] as number : 0;
  const topKeywords = (raw?.['topKeywords'] as PaidKeyword[] | undefined) ?? [];

  const topFive = topKeywords.slice(0, 6);
  const maxCost = topFive.reduce((max, k) => Math.max(max, k.cpc * k.estimatedTraffic), 1);

  // CPC efficiency color
  const cpcColor = avgCpc <= 2 ? 'var(--gs-terminal)' : avgCpc <= 5 ? 'var(--gs-warning)' : 'var(--gs-critical)';

  return (
    <SlideShell
      moduleName="Paid Search Intelligence"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Paid keyword data, CPC analysis, ad spend estimation"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      onAskChloe={onAskChloe}
      slideNumber={slideNumber}
    >
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        {/* Hero stats in cards */}
        <div style={{ display: 'flex', gap: '0.6em', justifyContent: 'center', marginBottom: '0.6em' }}>
          {[
            { value: totalPaidKeywords > 0 ? totalPaidKeywords.toLocaleString() : '—', label: 'Paid Keywords', color: totalPaidKeywords > 0 ? scoreColor(modScore ?? 50) : 'var(--gs-mid)', show: true },
            { value: avgCpc > 0 ? `$${avgCpc.toFixed(2)}` : '—', label: 'Avg CPC', color: avgCpc > 0 ? cpcColor : 'var(--gs-mid)', show: true },
            { value: estimatedMonthlyCost > 0 ? formatCurrency(estimatedMonthlyCost) : '—', label: 'Est. Monthly Spend', color: estimatedMonthlyCost > 0 ? 'var(--gs-base)' : 'var(--gs-mid)', show: true },
            { value: totalEstimatedClicks >= 1000 ? `${(totalEstimatedClicks / 1000).toFixed(1)}K` : totalEstimatedClicks.toLocaleString(), label: 'Est. Clicks/mo', color: 'var(--gs-light)', show: totalEstimatedClicks > 0 },
          ].filter(s => s.show).map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: '0.6em 0.8em', borderRadius: '4px', textAlign: 'center',
              background: 'rgba(255,178,239,0.04)',
              border: '1px solid rgba(255,178,239,0.08)',
            }}>
              <p className="font-data tabular-nums" style={{
                fontSize: 'clamp(1px, 1.65cqi, 26px)', fontWeight: 700, lineHeight: 1, color: s.color,
              }}>
                {s.value}
              </p>
              <p className="font-data uppercase" style={{
                fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-base)',
                letterSpacing: '0.08em', marginTop: '0.3em',
              }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Top keywords table */}
        {topFive.length > 0 && (
          <div>
            <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.25em' }}>
              Top Keywords by Est. Cost
            </p>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 4em 3.5em 4em 2.5em',
              gap: '0 0.8em', padding: '0 0 0.2em', borderBottom: '1px solid rgba(255,178,239,0.06)',
            }}>
              <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', whiteSpace: 'nowrap' }}>Keyword</span>
              <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', textAlign: 'right', whiteSpace: 'nowrap' }}>Cost</span>
              <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', textAlign: 'right', whiteSpace: 'nowrap' }}>CPC</span>
              <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', textAlign: 'right', whiteSpace: 'nowrap' }}>Volume</span>
              <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', textAlign: 'right', whiteSpace: 'nowrap' }}>Pos</span>
            </div>
            {/* Table rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topFive.map((kw, i) => {
                const estCost = kw.cpc * kw.estimatedTraffic;
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 4em 3.5em 4em 2.5em',
                    gap: '0 0.8em', padding: '0.2em 0',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                  }}>
                    <span className="font-data" style={{
                      fontSize: 'clamp(1px, 0.86cqi, 14px)', color: 'var(--gs-light)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {kw.keyword}
                    </span>
                    <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', fontWeight: 600, textAlign: 'right' }}>
                      {estCost >= 1000 ? `$${(estCost / 1000).toFixed(1)}K` : `$${Math.round(estCost)}`}
                    </span>
                    <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', textAlign: 'right' }}>
                      ${kw.cpc.toFixed(2)}
                    </span>
                    <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', textAlign: 'right' }}>
                      {kw.searchVolume >= 1000 ? `${(kw.searchVolume / 1000).toFixed(0)}K` : kw.searchVolume}
                    </span>
                    <span className="font-data tabular-nums" style={{
                      fontSize: 'clamp(1px, 0.83cqi, 13px)', fontWeight: 600, textAlign: 'right',
                      color: kw.position <= 3 ? 'var(--gs-terminal)' : kw.position <= 10 ? 'var(--gs-warning)' : 'var(--gs-mid)',
                    }}>
                      #{kw.position}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No paid search message */}
        {totalPaidKeywords === 0 && topFive.length === 0 && (
          <p className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.6, textAlign: 'center', padding: '0.5em 0' }}>
            No paid search activity detected — relying on organic or other channels
          </p>
        )}
      </div>
    </SlideShell>
  );
}
