'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  scoreColor,
  SvgGauge,
  StatBlock,
  SkippedSlide,
} from './module-slide-template';

/**
 * M03 Slide — Performance & Web Vitals
 * ═════════════════════════════════════
 *
 * Layout A: SlideShell with SvgGauge arcs for LCP, CLS, FCP,
 * plus a stats row for Lighthouse score, Page Weight, and TTI.
 */

export function M03Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M03');
  const mod = getModuleResult(scan, 'M03');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Performance & Web Vitals" scan={scan} sourceLabel="Source: Lighthouse audit, resource timing API, network waterfall" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Core Web Vitals and page performance analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const metrics = (raw?.['metrics'] as Record<string, unknown> | undefined) ?? null;
  const crux = (raw?.['cruxFieldData'] as Record<string, unknown> | undefined) ?? null;

  // CrUX field data helper — extracts p75 value from { p75, category } shape
  const cruxP75 = (field: string): number | null => {
    const m = crux?.[field] as Record<string, unknown> | undefined;
    return typeof m?.['p75'] === 'number' ? m['p75'] as number : null;
  };

  // Checkpoint evidence fallback — engine stores computed values in checkpoint evidence
  // when PerformanceObserver doesn't fire (e.g. "LCP: 3989ms", "CLS: 0.000")
  const cpVal = (cpId: string, pattern: RegExp): number | null => {
    const cp = mod?.checkpoints?.find(c => c.id === cpId);
    if (!cp?.evidence) return null;
    const match = cp.evidence.match(pattern);
    return match ? parseFloat(match[1]!) : null;
  };

  // LCP: metrics.lcp → CrUX p75 → checkpoint evidence
  const lcpMs = typeof metrics?.['lcp'] === 'number' ? metrics['lcp'] as number
    : cruxP75('lcp')
    ?? cpVal('m03-lcp', /LCP:\s*([\d.]+)ms/);
  const lcpSec = lcpMs != null ? lcpMs / 1000 : null;

  // CLS: metrics.cls → CrUX p75 → checkpoint evidence
  const cls = typeof metrics?.['cls'] === 'number' ? metrics['cls'] as number
    : cruxP75('cls')
    ?? cpVal('m03-cls', /CLS:\s*([\d.]+)/);

  // FCP: metrics.fcp → CrUX p75
  const fcpMs = typeof metrics?.['fcp'] === 'number' ? metrics['fcp'] as number : cruxP75('fcp');
  const fcpSec = fcpMs != null ? fcpMs / 1000 : null;

  // TTI approximation (domContentLoaded as proxy)
  const ttiMs = typeof metrics?.['domContentLoaded'] === 'number' ? metrics['domContentLoaded'] as number : null;
  const ttiSec = ttiMs != null ? ttiMs / 1000 : null;

  // Total bytes
  const totalBytes = typeof metrics?.['totalBytes'] === 'number' ? metrics['totalBytes'] as number : null;
  const totalMB = totalBytes != null ? (totalBytes / (1024 * 1024)).toFixed(1) : null;

  // Lighthouse score from CrUX
  const lighthouseScore = typeof crux?.['lighthouseScore'] === 'number' ? crux['lighthouseScore'] as number : null;
  const performanceScore = typeof crux?.['performance_score'] === 'number' ? crux['performance_score'] as number : lighthouseScore;

  // Compression and cache
  const compressionRatio = typeof raw?.['compressionRatio'] === 'number' ? raw['compressionRatio'] as number : null;
  const cacheRatio = typeof raw?.['cacheRatio'] === 'number' ? raw['cacheRatio'] as number : null;

  // Resource count
  const totalResources = typeof metrics?.['totalResources'] === 'number' ? metrics['totalResources'] as number : null;

  return (
    <SlideShell
      moduleName="Performance & Web Vitals"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Lighthouse audit, resource timing API, network waterfall"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    >
      {/* ═══ Web Vitals Gauges + Stats ═══ */}
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0',
        borderTop: '1px solid rgba(255,178,239,0.06)',
        borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        {/* Gauge row */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '0.6em' }}>
          {/* LCP Gauge */}
          {lcpSec != null ? (
            <SvgGauge
              value={lcpSec}
              max={6}
              label="LCP (sec)"
              thresholds={{ good: 2.5 / 6, warn: 4.0 / 6 }}
            />
          ) : (
            <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
              <svg width="90" height="52" viewBox="0 0 90 52">
                <path d="M 7 50 A 38 38 0 0 1 83 50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round" />
              </svg>
              <p className="font-data" style={{ fontSize: 'clamp(1px, 1.12cqi, 18px)', color: 'var(--gs-mid)', marginTop: '-0.6em' }}>—</p>
              <p className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', marginTop: '0.15em' }}>LCP</p>
            </div>
          )}

          {/* CLS Gauge */}
          {cls != null ? (
            <SvgGauge
              value={cls}
              max={0.5}
              label="CLS"
              thresholds={{ good: 0.1 / 0.5, warn: 0.25 / 0.5 }}
            />
          ) : (
            <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
              <svg width="90" height="52" viewBox="0 0 90 52">
                <path d="M 7 50 A 38 38 0 0 1 83 50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round" />
              </svg>
              <p className="font-data" style={{ fontSize: 'clamp(1px, 1.12cqi, 18px)', color: 'var(--gs-mid)', marginTop: '-0.6em' }}>—</p>
              <p className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', marginTop: '0.15em' }}>CLS</p>
            </div>
          )}

          {/* FCP Gauge */}
          {fcpSec != null ? (
            <SvgGauge
              value={fcpSec}
              max={5}
              label="FCP (sec)"
              thresholds={{ good: 1.8 / 5, warn: 3.0 / 5 }}
            />
          ) : (
            <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
              <svg width="90" height="52" viewBox="0 0 90 52">
                <path d="M 7 50 A 38 38 0 0 1 83 50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round" />
              </svg>
              <p className="font-data" style={{ fontSize: 'clamp(1px, 1.12cqi, 18px)', color: 'var(--gs-mid)', marginTop: '-0.6em' }}>—</p>
              <p className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', marginTop: '0.15em' }}>FCP</p>
            </div>
          )}
        </div>

        {/* Stats tiles — full width row */}
        <div style={{ display: 'flex', gap: '0.5em' }}>
          {[
            performanceScore != null ? { value: performanceScore, label: 'Perf Score', color: scoreColor(performanceScore) } : null,
            totalMB != null ? { value: `${totalMB}MB`, label: 'Page Weight', color: parseFloat(totalMB) > 3 ? 'var(--gs-warning)' : 'var(--gs-light)' } : null,
            ttiSec != null ? { value: `${ttiSec.toFixed(1)}s`, label: 'DOM Ready', color: ttiSec > 4 ? 'var(--gs-warning)' : ttiSec > 2 ? 'var(--gs-light)' : 'var(--gs-terminal)' } : null,
            totalResources != null ? { value: totalResources, label: 'Requests', color: totalResources > 100 ? 'var(--gs-warning)' : 'var(--gs-light)' } : null,
            compressionRatio != null ? { value: `${Math.round(compressionRatio * 100)}%`, label: 'Compressed', color: compressionRatio > 0.7 ? 'var(--gs-terminal)' : 'var(--gs-warning)' } : null,
            cacheRatio != null ? { value: `${Math.round(cacheRatio * 100)}%`, label: 'Cached', color: cacheRatio > 0.5 ? 'var(--gs-terminal)' : 'var(--gs-warning)' } : null,
          ].filter((s) => s != null).map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: '0.5em 0.4em', borderRadius: '4px', textAlign: 'center',
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
    </SlideShell>
  );
}
