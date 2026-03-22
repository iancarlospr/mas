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
 * M27 Slide — Global Rankings
 * ════════════════════════════
 *
 * Layout A: SlideShell with hero global rank + keyword position distribution
 * as a SegmentedBar. Shows ranking positions (#1, #2-3, #4-10, etc.).
 */

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return n.toLocaleString();
}

export function M27Slide({ scan, chloeCallout }: { scan: ScanWithResults; chloeCallout?: React.ReactNode }) {
  const syn = getM41Summary(scan, 'M27');
  const mod = getModuleResult(scan, 'M27');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Global Rankings" scan={scan} sourceLabel="Source: Global rank APIs, search visibility metrics" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Search ranking visibility analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // Raw rankings data
  const rankingsObj = (raw?.['rankings'] as Record<string, number> | undefined) ?? {};
  const pos1 = typeof rankingsObj['pos1'] === 'number' ? rankingsObj['pos1'] : 0;
  const pos2_3 = typeof rankingsObj['pos2_3'] === 'number' ? rankingsObj['pos2_3'] : 0;
  const pos4_10 = typeof rankingsObj['pos4_10'] === 'number' ? rankingsObj['pos4_10'] : 0;
  const totalKeywords = typeof rankingsObj['totalKeywords'] === 'number' ? rankingsObj['totalKeywords'] : 0;
  const rest = Math.max(0, totalKeywords - pos1 - pos2_3 - pos4_10);

  const organicKeywords = typeof raw?.['organicKeywords'] === 'number' ? raw['organicKeywords'] as number : totalKeywords;
  const organicEtv = typeof raw?.['organicEtv'] === 'number' ? raw['organicEtv'] as number : 0;
  const countriesTracked = typeof raw?.['countriesTracked'] === 'number' ? raw['countriesTracked'] as number : 0;

  const topPositions = pos1 + pos2_3;
  const hasRankingData = totalKeywords > 0 || pos1 > 0;

  return (
    <SlideShell
      moduleName="Global Rankings"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Global rank APIs, search visibility metrics"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      chloeCallout={chloeCallout}
    >
      {/* Stats — 3-col grid aligned to findings/recs/scores below */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', flexShrink: 0,
        padding: '0.8em 0', borderTop: '1px solid rgba(255,178,239,0.06)',
      }}>
        {/* Col 1: organic keywords */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <StatBlock value={fmtNum(organicKeywords)} label="Organic Keywords" color="var(--gs-base)" />
        </div>

        {/* Col 2: empty */}
        <div />

        {/* Col 3: page 1 positions */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <StatBlock value={fmtNum(pos4_10)} label="Page 1 (#4-10)" color="var(--gs-light)" />
        </div>
      </div>

      {/* Keyword position distribution */}
      {hasRankingData && (
        <div style={{ marginBottom: '0.6em', flexShrink: 0, paddingBottom: '0.5em', borderBottom: '1px solid rgba(255,178,239,0.06)' }}>
          <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.4em' }}>
            Keyword Position Distribution
          </p>
          <SegmentedBar segments={[
            { value: pos1, color: 'var(--gs-terminal)', label: '#1' },
            { value: pos2_3, color: '#4ade80', label: '#2-3' },
            { value: pos4_10, color: 'var(--gs-base)', label: '#4-10' },
            { value: rest, color: 'var(--gs-mid)', label: '11+' },
          ]} />
        </div>
      )}
    </SlideShell>
  );
}
