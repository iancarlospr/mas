'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  StatBlock,
  SegmentedBar,
  SkippedSlide,
} from './module-slide-template';

/**
 * M24 Slide — Monthly Traffic
 * ════════════════════════════
 *
 * Layout C: Hero StatBlock row + SegmentedBar for organic vs paid split.
 * Pulls from M24 raw data (organicTraffic, paidTraffic, totalTraffic, keywords).
 */

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return n.toLocaleString();
}

export function M24Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M24');
  const mod = getModuleResult(scan, 'M24');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Monthly Traffic" scan={scan} sourceLabel="Source: Traffic estimation APIs, historical trend data" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Monthly traffic overview';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // Raw traffic data
  const organicTraffic = typeof raw?.['organicTraffic'] === 'number' ? raw['organicTraffic'] as number : 0;
  const paidTraffic = typeof raw?.['paidTraffic'] === 'number' ? raw['paidTraffic'] as number : 0;
  const totalTraffic = typeof raw?.['totalTraffic'] === 'number' ? raw['totalTraffic'] as number : organicTraffic + paidTraffic;
  const organicKeywords = typeof raw?.['organicKeywords'] === 'number' ? raw['organicKeywords'] as number : 0;
  const paidKeywords = typeof raw?.['paidKeywords'] === 'number' ? raw['paidKeywords'] as number : 0;
  const totalKeywords = organicKeywords + paidKeywords;

  return (
    <SlideShell
      moduleName="Monthly Traffic"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Traffic estimation APIs, historical trend data"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    >
      {/* Traffic equation + Keywords — aligned to 3-col grid below */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', flexShrink: 0,
        padding: '0.8em 0', borderTop: '1px solid rgba(255,178,239,0.06)',
      }}>
        {/* Col 1: equation centered over Key Findings */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <StatBlock value={fmtNum(organicTraffic)} label="Organic" color="var(--gs-terminal)" />
          <span className="font-data" style={{ fontSize: 'clamp(8px, 1.8cqi, 22px)', color: 'rgba(255,178,239,0.2)', padding: '0 1.2em', alignSelf: 'flex-start', marginTop: '0.15em', fontWeight: 300 }}>+</span>
          <StatBlock value={fmtNum(paidTraffic)} label="Paid" color="var(--gs-warning)" />
          <span className="font-data" style={{ fontSize: 'clamp(8px, 1.8cqi, 22px)', color: 'rgba(255,178,239,0.2)', padding: '0 1.2em', alignSelf: 'flex-start', marginTop: '0.15em', fontWeight: 300 }}>=</span>
          <StatBlock value={fmtNum(totalTraffic)} label="Total/mo" color="var(--gs-light)" />
        </div>

        {/* Col 2: empty */}
        <div />

        {/* Col 3: keywords centered over Score Breakdown */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <StatBlock value={fmtNum(totalKeywords)} label="Keywords Ranked" color="var(--gs-base)" />
        </div>
      </div>

      {/* Organic vs Paid segmented bar */}
      {totalTraffic > 0 && (
        <div style={{ marginBottom: '0.6em', flexShrink: 0, paddingBottom: '0.5em', borderBottom: '1px solid rgba(255,178,239,0.06)' }}>
          <SegmentedBar segments={[
            { value: organicTraffic, color: 'var(--gs-terminal)', label: 'Organic' },
            { value: paidTraffic, color: 'var(--gs-warning)', label: 'Paid' },
          ]} />
        </div>
      )}
    </SlideShell>
  );
}
