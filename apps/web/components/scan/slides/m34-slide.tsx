'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShellAlt,
  getM41Summary,
  getModuleResult,
  StatBlock,
  SkippedSlide,
} from './module-slide-template';

/**
 * M34 Slide — Keyword Movement
 * =============================
 * Layout B (SlideShellAlt): left panel = keyword movement arrows, right = findings/recs.
 *
 * Visualization:
 *   - Net change hero stat
 *   - Gaining keywords (green) with old->new position arrows
 *   - Losing keywords (red) with old->new position arrows
 */

interface KeywordMovement {
  keyword: string;
  searchVolume: number;
  rankGroup: number;
  rankAbsolute: number;
  isUp: boolean | null;
}

export function M34Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M34');
  const mod = getModuleResult(scan, 'M34');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Keyword Movement" scan={scan} sourceLabel="Source: Keyword position tracking, rank change detection" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Keyword ranking movement analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ────────────────────────────────────────────────────
  const totalKeywords = typeof raw?.['totalKeywords'] === 'number' ? raw['totalKeywords'] as number : 0;
  const losingCount = typeof raw?.['losingCount'] === 'number' ? raw['losingCount'] as number : 0;
  const gainingCount = typeof raw?.['gainingCount'] === 'number' ? raw['gainingCount'] as number : 0;
  const losingKeywords = (raw?.['losingKeywords'] as KeywordMovement[] | undefined) ?? [];
  const gainingKeywords = (raw?.['gainingKeywords'] as KeywordMovement[] | undefined) ?? [];

  const netChange = gainingCount - losingCount;
  const netColor = netChange > 0 ? 'var(--gs-terminal)' : netChange < 0 ? 'var(--gs-critical)' : 'var(--gs-mid)';
  const netLabel = netChange > 0 ? `+${netChange}` : String(netChange);

  const topLosing = losingKeywords.slice(0, 5);
  const topGaining = gainingKeywords.slice(0, 5);

  // ── Arrow component ─────────────────────────────────────────────────────
  function MovementRow({ kw, direction }: { kw: KeywordMovement; direction: 'up' | 'down' }) {
    const isUp = direction === 'up';
    const arrowColor = isUp ? 'var(--gs-terminal)' : 'var(--gs-critical)';

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4em', marginBottom: '0.2em' }}>
        {/* Arrow icon */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          {isUp ? (
            <path d="M7 12V3M7 3L3 7M7 3L11 7" stroke={arrowColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M7 2V11M7 11L3 7M7 11L11 7" stroke={arrowColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>

        {/* Keyword name */}
        <span className="font-data" style={{
          fontSize: 'clamp(12px, 1.15cqi, 13px)', color: 'var(--gs-light)', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {kw.keyword}
        </span>

        {/* Position badge */}
        <span className="font-data tabular-nums" style={{
          fontSize: 'clamp(12px, 1.15cqi, 13px)', fontWeight: 600, color: arrowColor,
          flexShrink: 0,
        }}>
          #{kw.rankAbsolute}
        </span>

        {/* Volume */}
        {kw.searchVolume > 0 && (
          <span className="font-data tabular-nums" style={{
            fontSize: 'clamp(12px, 1cqi, 12px)', color: 'var(--gs-mid)', flexShrink: 0,
          }}>
            {kw.searchVolume.toLocaleString()}/mo
          </span>
        )}
      </div>
    );
  }

  // ── Viz content (left panel) ────────────────────────────────────────────
  const vizContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em', height: '100%' }}>
      {/* Net change header in cards */}
      <div style={{ display: 'flex', gap: '0.5em', marginBottom: '0.2em' }}>
        {[
          { value: netLabel, label: 'Net Change', color: netColor, show: true },
          { value: gainingCount, label: 'Gaining', color: 'var(--gs-terminal)', show: true },
          { value: losingCount, label: 'Losing', color: 'var(--gs-critical)', show: true },
          { value: totalKeywords.toLocaleString(), label: 'Total Tracked', color: 'var(--gs-light)', show: totalKeywords > 0 },
        ].filter(s => s.show).map((s, i) => (
          <div key={i} style={{
            flex: 1, padding: '0.5em 0.6em', borderRadius: '4px', textAlign: 'center',
            background: 'rgba(255,178,239,0.04)',
            border: '1px solid rgba(255,178,239,0.08)',
          }}>
            <p className="font-data tabular-nums" style={{
              fontSize: 'clamp(16px, 2cqi, 24px)', fontWeight: 700, lineHeight: 1, color: s.color,
            }}>
              {s.value}
            </p>
            <p className="font-data uppercase" style={{
              fontSize: 'clamp(12px, 1cqi, 12px)', color: 'var(--gs-base)',
              letterSpacing: '0.08em', marginTop: '0.25em',
            }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Two sections: gaining + losing */}
      <div style={{ display: 'flex', flex: 1, gap: '3%', minHeight: 0 }}>
        {/* Gaining */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <p className="font-data uppercase" style={{
            fontSize: 'clamp(12px, 1.1cqi, 13px)', letterSpacing: '0.1em', marginBottom: '0.25em',
            color: 'var(--gs-terminal)',
          }}>
            Gaining Rank
          </p>
          {topGaining.length > 0 ? (
            topGaining.map((kw, i) => <MovementRow key={i} kw={kw} direction="up" />)
          ) : (
            <p className="font-data" style={{ fontSize: 'clamp(12px, 1.1cqi, 13px)', color: 'var(--gs-mid)', opacity: 0.6 }}>
              No gaining keywords detected
            </p>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', background: 'rgba(255,178,239,0.06)', flexShrink: 0 }} />

        {/* Losing */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <p className="font-data uppercase" style={{
            fontSize: 'clamp(12px, 1.1cqi, 13px)', letterSpacing: '0.1em', marginBottom: '0.25em',
            color: 'var(--gs-critical)',
          }}>
            Losing Rank
          </p>
          {topLosing.length > 0 ? (
            topLosing.map((kw, i) => <MovementRow key={i} kw={kw} direction="down" />)
          ) : (
            <p className="font-data" style={{ fontSize: 'clamp(12px, 1.1cqi, 13px)', color: 'var(--gs-mid)', opacity: 0.6 }}>
              No losing keywords detected
            </p>
          )}
        </div>
      </div>

      {/* Stability bar */}
      {(gainingCount + losingCount) > 0 && (
        <div style={{ marginTop: '0.2em' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.1em' }}>
            <span className="font-data" style={{ fontSize: 'clamp(12px, 1cqi, 12px)', color: 'var(--gs-mid)' }}>Stability ratio</span>
            <span className="font-data tabular-nums" style={{ fontSize: 'clamp(12px, 1cqi, 12px)', color: netColor }}>
              {Math.round((gainingCount / (gainingCount + losingCount)) * 100)}% gaining
            </span>
          </div>
          <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${(gainingCount / (gainingCount + losingCount)) * 100}%`, background: 'var(--gs-terminal)', minWidth: gainingCount > 0 ? '2px' : 0 }} />
            <div style={{ width: `${(losingCount / (gainingCount + losingCount)) * 100}%`, background: 'var(--gs-critical)', minWidth: losingCount > 0 ? '2px' : 0 }} />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <SlideShellAlt
      moduleName="Keyword Movement"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Keyword position tracking, rank change detection"
      vizContent={vizContent}
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    />
  );
}
