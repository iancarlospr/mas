'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  scoreColor,
  SegmentedBar,
  RankedBar,
  StatBlock,
  SkippedSlide,
} from './module-slide-template';

/**
 * M26 Slide — Keyword Rankings
 * =============================
 * Layout A (SlideShell + SegmentedBar): position distribution + top keywords table.
 *
 * Visualization:
 *   - SegmentedBar showing ranking position distribution (#1, 2-3, 4-10, 11-20, 21+)
 *   - Hero stats row (Total Organic, Top-10 Count)
 *   - Top 5 keywords with search volume as RankedBars
 */

interface TopKeyword {
  keyword: string;
  searchVolume: number;
  cpc: number;
  rankAbsolute: number;
  etv: number;
}

export function M26Slide({ scan, onAskChloe }: { scan: ScanWithResults; onAskChloe?: () => void }) {
  const syn = getM41Summary(scan, 'M26');
  const mod = getModuleResult(scan, 'M26');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Keyword Rankings" scan={scan} sourceLabel="Source: SERP position tracking, organic keyword analysis" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Organic keyword ranking assessment';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Raw data extraction ────────────────────────────────────────────────
  const totalOrganic = typeof raw?.['totalOrganic'] === 'number' ? raw['totalOrganic'] as number : 0;
  const top10Count = typeof raw?.['top10Count'] === 'number' ? raw['top10Count'] as number : 0;
  const rawKeywords = (raw?.['topKeywords'] as TopKeyword[] | undefined) ?? [];

  // Compute position distribution from topKeywords
  let pos1 = 0, pos2to3 = 0, pos4to10 = 0, pos11to20 = 0, pos21plus = 0;
  for (const kw of rawKeywords) {
    const pos = kw.rankAbsolute;
    if (pos === 1) pos1++;
    else if (pos >= 2 && pos <= 3) pos2to3++;
    else if (pos >= 4 && pos <= 10) pos4to10++;
    else if (pos >= 11 && pos <= 20) pos11to20++;
    else pos21plus++;
  }

  const segments = [
    { value: pos1, color: 'var(--gs-terminal)', label: '#1' },
    { value: pos2to3, color: 'oklch(0.72 0.17 150)', label: '#2-3' },
    { value: pos4to10, color: 'var(--gs-warning)', label: '#4-10' },
    { value: pos11to20, color: 'oklch(0.6 0.15 30)', label: '#11-20' },
    { value: pos21plus, color: 'var(--gs-critical)', label: '#21+' },
  ];

  const topFive = [...rawKeywords].sort((a, b) => b.searchVolume - a.searchVolume).slice(0, 5);
  const maxVolume = topFive.reduce((max, k) => Math.max(max, k.searchVolume), 1);

  return (
    <SlideShell
      moduleName="Keyword Rankings"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: SERP position tracking, organic keyword analysis"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      onAskChloe={onAskChloe}
    >
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        {/* Hero stats in cards */}
        <div style={{ display: 'flex', gap: '0.6em', marginBottom: '0.6em' }}>
          <div style={{
            flex: 1, padding: '0.6em 0.8em', borderRadius: '4px', textAlign: 'center',
            background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
          }}>
            <p className="font-data tabular-nums" style={{
              fontSize: 'clamp(1px, 1.65cqi, 26px)', fontWeight: 700, lineHeight: 1,
              color: totalOrganic > 0 ? scoreColor(modScore ?? 50) : 'var(--gs-mid)',
            }}>
              {totalOrganic > 0 ? totalOrganic.toLocaleString() : '—'}
            </p>
            <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.08em', marginTop: '0.3em' }}>
              Total Organic Keywords
            </p>
          </div>
          <div style={{
            flex: 1, padding: '0.6em 0.8em', borderRadius: '4px', textAlign: 'center',
            background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
          }}>
            <p className="font-data tabular-nums" style={{
              fontSize: 'clamp(1px, 1.65cqi, 26px)', fontWeight: 700, lineHeight: 1,
              color: top10Count >= 5 ? 'var(--gs-terminal)' : top10Count > 0 ? 'var(--gs-warning)' : 'var(--gs-critical)',
            }}>
              {top10Count}
            </p>
            <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.08em', marginTop: '0.3em' }}>
              In Top 10
            </p>
          </div>
          {rawKeywords.length > 0 && rawKeywords[0] && (
            <div style={{
              flex: 2, padding: '0.6em 0.8em', borderRadius: '4px', textAlign: 'center',
              background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
            }}>
              <p className="font-data" style={{ fontSize: 'clamp(1px, 1.12cqi, 18px)', color: 'var(--gs-light)', fontWeight: 600, lineHeight: 1.2 }}>
                &ldquo;{rawKeywords[0].keyword}&rdquo; <span style={{ color: 'var(--gs-terminal)', fontWeight: 700 }}>#{rawKeywords[0].rankAbsolute}</span>
              </p>
              <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.08em', marginTop: '0.3em' }}>
                Top Keyword
              </p>
            </div>
          )}
        </div>

        {/* Position distribution bar */}
        {(pos1 + pos2to3 + pos4to10 + pos11to20 + pos21plus) > 0 && (
          <div style={{ marginBottom: '0.5em' }}>
            <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.25em' }}>
              Position Distribution
            </p>
            <SegmentedBar segments={segments} />
          </div>
        )}

        {/* Top keywords — horizontal bars */}
        {topFive.length > 0 && (
          <div>
            <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.25em' }}>
              Top Keywords by Volume
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15em' }}>
              {topFive.map((kw, i) => {
                const pct = maxVolume > 0 ? Math.min(100, (kw.searchVolume / maxVolume) * 100) : 0;
                const rankColor = kw.rankAbsolute <= 3 ? 'var(--gs-terminal)' : kw.rankAbsolute <= 10 ? 'var(--gs-warning)' : 'var(--gs-mid)';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4em' }}>
                    <span className="font-data tabular-nums" style={{
                      fontSize: 'clamp(1px, 0.83cqi, 13px)', fontWeight: 700, minWidth: '2.2em', textAlign: 'right',
                      color: rankColor, flexShrink: 0,
                    }}>
                      #{kw.rankAbsolute}
                    </span>
                    <span className="font-data" style={{
                      fontSize: 'clamp(1px, 0.86cqi, 14px)', color: 'var(--gs-light)',
                      minWidth: '8em', maxWidth: '14em', flexShrink: 0,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {kw.keyword}
                    </span>
                    <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--gs-base)', borderRadius: '4px', minWidth: pct > 0 ? '3px' : 0 }} />
                    </div>
                    <span className="font-data tabular-nums" style={{
                      fontSize: 'clamp(1px, 0.86cqi, 14px)', color: 'var(--gs-light)', fontWeight: 600,
                      minWidth: '4.5em', textAlign: 'right', flexShrink: 0,
                    }}>
                      {kw.searchVolume >= 1_000_000 ? `${(kw.searchVolume / 1_000_000).toFixed(1)}M` : kw.searchVolume >= 1000 ? `${(kw.searchVolume / 1000).toFixed(kw.searchVolume >= 10000 ? 0 : 1)}K` : kw.searchVolume}/mo
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </SlideShell>
  );
}
