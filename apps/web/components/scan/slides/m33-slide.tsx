'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  StatBlock,
  RankedBar,
  SkippedSlide,
} from './module-slide-template';

/**
 * M33 Slide — Brand Search
 * ═════════════════════════
 *
 * Layout C: Hero total brand volume StatBlock + top branded keywords
 * with search volume as RankedBars. Shows brand demand ecosystem.
 */

interface BrandKeyword {
  keyword?: string;
  searchVolume?: number;
  volume?: number;
  ratioToBrand?: number;
  position?: number;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return n.toLocaleString();
}

export function M33Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M33');
  const mod = getModuleResult(scan, 'M33');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Brand Search" scan={scan} sourceLabel="Source: Branded keyword volume, brand SERP analysis" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Brand search demand analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // Raw brand keyword data
  const brandKeywordsRaw = (raw?.['brandKeywords'] as BrandKeyword[] | undefined) ?? [];
  const totalBrandVolume = typeof raw?.['totalBrandVolume'] === 'number' ? raw['totalBrandVolume'] as number : 0;
  const brandVolume = typeof raw?.['brandVolume'] === 'number' ? raw['brandVolume'] as number : 0;
  const brandedTraffic = typeof raw?.['brandedTraffic'] === 'number' ? raw['brandedTraffic'] as number : 0;

  // Normalize keywords
  const keywords = brandKeywordsRaw.map((k) => ({
    keyword: typeof k.keyword === 'string' ? k.keyword : '—',
    volume: typeof k.searchVolume === 'number' ? k.searchVolume
      : typeof k.volume === 'number' ? k.volume
      : 0,
    ratio: typeof k.ratioToBrand === 'number' ? k.ratioToBrand : null,
  })).filter(k => k.volume > 0);

  // Split: core brand term (first) vs intent keywords
  const coreBrand = keywords[0] ?? null;
  const intentKeywords = keywords.slice(1).sort((a, b) => b.volume - a.volume);
  const maxVolume = intentKeywords.length > 0 ? Math.max(...intentKeywords.map(k => k.volume), 1) : 1;

  return (
    <SlideShell
      moduleName="Brand Search"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Branded keyword volume, brand SERP analysis"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    >
      <div style={{
        display: 'flex', gap: '3%', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
        marginBottom: '0.6em',
      }}>
        {/* Left: Hero stats */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6em', justifyContent: 'center' }}>
          {/* Hero tile — volume + core brand term unified */}
          <div style={{
            padding: '1em 1em', borderRadius: '4px', textAlign: 'center',
            background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
          }}>
            <p className="font-data tabular-nums" style={{
              fontSize: 'clamp(14px, 3.5cqi, 42px)', fontWeight: 700, lineHeight: 1, color: 'var(--gs-light)',
            }}>
              {fmtNum(totalBrandVolume || brandVolume)}
            </p>
            <p className="font-data uppercase" style={{
              fontSize: 'clamp(7px, 1.1cqi, 13px)', color: 'var(--gs-base)',
              letterSpacing: '0.1em', marginTop: '0.3em',
            }}>
              Total Brand Searches/mo
            </p>
            {coreBrand && (<>
              <div style={{
                width: '40px', height: '1px', margin: '0.7em auto',
                background: 'rgba(255,178,239,0.15)',
              }} />
              <p className="font-data" style={{
                fontSize: 'clamp(12px, 2.8cqi, 34px)', fontWeight: 700, color: 'var(--gs-base)', lineHeight: 1,
              }}>
                &ldquo;{coreBrand.keyword}&rdquo;
              </p>
              <p className="font-data uppercase" style={{
                fontSize: 'clamp(7px, 0.9cqi, 12px)', color: 'var(--gs-mid)',
                letterSpacing: '0.08em', marginTop: '0.25em',
              }}>
                Core Brand Term
              </p>
            </>)}
          </div>

          {brandedTraffic > 0 && (
            <div style={{ textAlign: 'center' }}>
              <p className="font-data tabular-nums" style={{
                fontSize: 'clamp(10px, 2cqi, 24px)', fontWeight: 700, lineHeight: 1, color: 'var(--gs-terminal)',
              }}>
                {fmtNum(brandedTraffic)}
              </p>
              <p className="font-data uppercase" style={{
                fontSize: 'clamp(7px, 0.9cqi, 12px)', color: 'var(--gs-mid)',
                letterSpacing: '0.06em', marginTop: '0.2em',
              }}>
                Branded Traffic
              </p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', background: 'rgba(255,178,239,0.1)', flexShrink: 0 }} />

        {/* Right: Intent keywords ranked bars */}
        <div style={{ flex: 2 }}>
          <p className="font-data uppercase" style={{ fontSize: 'clamp(7px, 1.1cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.35em' }}>
            Brand Intent Keywords
          </p>
          {intentKeywords.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
              {intentKeywords.map((k, i) => {
                // Color code by intent type
                const kw = k.keyword.toLowerCase();
                const color = kw.includes('alternative') || kw.includes(' vs')
                  ? 'var(--gs-warning)'    // churn risk
                  : kw.includes('review')
                  ? 'var(--gs-terminal)'   // social proof
                  : kw.includes('pricing') || kw.includes('demo')
                  ? 'var(--gs-base)'       // funnel intent
                  : 'rgba(255,178,239,0.6)';

                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                    <span className="font-data" style={{
                      fontSize: 'clamp(7px, 1.2cqi, 14px)', color: 'var(--gs-light)',
                      minWidth: '40%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {k.keyword}
                    </span>
                    <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${(k.volume / maxVolume) * 100}%`, height: '100%',
                        background: color, borderRadius: '4px', minWidth: k.volume > 0 ? '3px' : 0,
                      }} />
                    </div>
                    <span className="font-data tabular-nums" style={{ fontSize: 'clamp(7px, 1.2cqi, 14px)', color: 'var(--gs-light)', fontWeight: 600, minWidth: '4em', textAlign: 'right' }}>
                      {fmtNum(k.volume)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="font-data" style={{ fontSize: 'clamp(7px, 1.25cqi, 14px)', color: 'var(--gs-mid)' }}>
              No brand intent keywords detected
            </p>
          )}
        </div>
      </div>
    </SlideShell>
  );
}
