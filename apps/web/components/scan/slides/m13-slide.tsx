'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  scoreColor,
  StatBlock,
  CheckItem,
  RankedBar,
  SkippedSlide,
} from './module-slide-template';

/**
 * M13 Slide — Sustainability & Carbon
 * ════════════════════════════════════
 *
 * Layout C: SlideShell with StatBlock hero (CO2 number), green hosting badge,
 * and horizontal bars for top third-party domains by bytes.
 */

interface ThirdPartyEntry {
  domain?: string;
  category?: string;
  totalBytes?: number;
  bytes?: number;
  requestCount?: number;
  toolName?: string;
}

export function M13Slide({ scan, onAskChloe }: { scan: ScanWithResults; onAskChloe?: () => void }) {
  const syn = getM41Summary(scan, 'M13');
  const mod = getModuleResult(scan, 'M13');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Sustainability & Carbon" scan={scan} sourceLabel="Source: Resource breakdown, CO2 estimation, green hosting check" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Page carbon footprint and sustainability analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const co2PerView = typeof raw?.['co2PerView'] === 'string' ? raw['co2PerView'] as string : null;
  const co2Grams = typeof raw?.['co2Grams'] === 'number' ? raw['co2Grams'] as number : null;
  const greenHosting = raw?.['greenHosting'] === true;
  const greenProvider = typeof raw?.['greenProvider'] === 'string' ? raw['greenProvider'] as string : null;

  const metrics = (raw?.['metrics'] as Record<string, unknown> | undefined) ?? null;
  const totalBytes = typeof metrics?.['totalBytes'] === 'number' ? metrics['totalBytes'] as number : 0;
  const imageBytes = typeof metrics?.['imageBytes'] === 'number' ? metrics['imageBytes'] as number : 0;
  const scriptBytes = typeof metrics?.['scriptBytes'] === 'number' ? metrics['scriptBytes'] as number : 0;
  const styleBytes = typeof metrics?.['styleBytes'] === 'number' ? metrics['styleBytes'] as number : 0;
  const fontBytes = typeof metrics?.['fontBytes'] === 'number' ? metrics['fontBytes'] as number : 0;

  // Third-party breakdown
  const thirdPartyBreakdown = (raw?.['thirdPartyBreakdown'] as ThirdPartyEntry[] | undefined) ?? [];

  // CO2 thresholds for color
  const co2Color = co2Grams != null
    ? co2Grams < 0.5 ? 'var(--gs-terminal)' : co2Grams < 1.0 ? 'var(--gs-warning)' : 'var(--gs-critical)'
    : 'var(--gs-mid)';

  // Max bytes for bar scaling
  const maxTpBytes = thirdPartyBreakdown.length > 0
    ? Math.max(...thirdPartyBreakdown.map(e => (typeof e.totalBytes === 'number' ? e.totalBytes : typeof e.bytes === 'number' ? e.bytes : 0)))
    : 1;

  return (
    <SlideShell
      moduleName="Sustainability & Carbon"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Resource breakdown, CO2 estimation, green hosting check"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      onAskChloe={onAskChloe}
    >
      {/* ═══ Hero CO2 + Green Hosting + Resource Bars ═══ */}
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0',
        borderTop: '1px solid rgba(255,178,239,0.06)',
        borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        <div style={{ display: 'flex', gap: '3%' }}>
          {/* Left: CO2 hero + Green hosting + Resource weight breakdown */}
          <div style={{ flex: '1 1 45%', display: 'flex', flexDirection: 'column', gap: '0.4em' }}>
            {/* CO2 hero — big number */}
            <div style={{
              padding: '0.7em 1em', borderRadius: '4px', textAlign: 'center', marginBottom: '0.4em',
              background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
              display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '0.5em',
            }}>
              <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 2.62cqi, 42px)', fontWeight: 700, color: co2Color, lineHeight: 1 }}>
                {co2PerView ?? (co2Grams != null ? `${co2Grams.toFixed(2)}g` : '—')}
              </span>
              <span className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em' }}>
                CO₂ per view
              </span>
            </div>

            {/* 6 tiles — 3x2 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4em' }}>
              {[
                { value: greenHosting ? '✓' : '✗', label: 'Green Host', color: greenHosting ? 'var(--gs-terminal)' : 'var(--gs-critical)' },
                { value: totalBytes > 0 ? `${Math.round(totalBytes / 1024)}KB` : '—', label: 'Total Weight', color: 'var(--gs-light)' },
                { value: imageBytes > 0 ? `${Math.round(imageBytes / 1024)}KB` : '—', label: 'Images', color: 'var(--gs-base)' },
                { value: scriptBytes > 0 ? `${Math.round(scriptBytes / 1024)}KB` : '—', label: 'Scripts', color: 'var(--gs-warning)' },
                { value: styleBytes > 0 ? `${Math.round(styleBytes / 1024)}KB` : '—', label: 'CSS', color: 'var(--gs-light)' },
                { value: fontBytes > 0 ? `${Math.round(fontBytes / 1024)}KB` : '—', label: 'Fonts', color: 'var(--gs-light)' },
              ].map((s, i) => (
                <div key={i} style={{
                  padding: '0.5em 0.4em', borderRadius: '4px', textAlign: 'center',
                  background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
                }}>
                  <p className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.35cqi, 22px)', fontWeight: 700, lineHeight: 1, color: s.color }}>
                    {s.value}
                  </p>
                  <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.68cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.06em', marginTop: '0.25em' }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Third-party domains by bytes */}
          <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: '0.2em' }}>
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.15em' }}>
              Top Third-Party Domains
            </h4>
            {thirdPartyBreakdown.length > 0 ? (
              thirdPartyBreakdown.slice(0, 8).map((entry, i) => {
                const domain = typeof entry.domain === 'string' ? entry.domain : 'unknown';
                const bytes = typeof entry.totalBytes === 'number' ? entry.totalBytes : typeof entry.bytes === 'number' ? entry.bytes : 0;
                const kbVal = Math.round(bytes / 1024);
                return (
                  <RankedBar
                    key={i}
                    label={domain.length > 25 ? domain.slice(0, 22) + '...' : domain}
                    value={kbVal}
                    max={Math.round(maxTpBytes / 1024)}
                    color={bytes > 100000 ? 'var(--gs-warning)' : 'var(--gs-base)'}
                    suffix="KB"
                  />
                );
              })
            ) : (
              <p className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)' }}>
                No third-party domain breakdown available.
              </p>
            )}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}
