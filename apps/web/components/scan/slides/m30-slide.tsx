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
 * M30 Slide — Traffic Sources (Referring Domains)
 * ════════════════════════════════════════════════
 *
 * Treemap visualization — rectangles sized by backlink count.
 * Shows concentration vs diversification of referring domain profile.
 * Stats panel overlaid or beside.
 */

interface TopSource {
  domain?: string;
  rank?: number;
  backlinks?: number;
  referringPages?: number;
  firstSeen?: string | null;
  dofollow?: number;
  traffic?: number;
  platformTypes?: Record<string, number>;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return n.toLocaleString();
}

/** Rank → fill color (higher quality domains get brighter pink) */
function rankFill(r: number): string {
  if (r > 0 && r <= 10_000) return 'rgba(255,178,239,0.55)';      // high authority — bright pink
  if (r > 0 && r <= 100_000) return 'rgba(255,178,239,0.30)';     // mid authority — pink
  if (r > 0) return 'rgba(255,178,239,0.14)';                     // low authority — dim pink
  return 'rgba(255,178,239,0.08)';                                 // unknown
}

function rankBorder(r: number): string {
  if (r > 0 && r <= 10_000) return 'rgba(255,178,239,0.40)';
  if (r > 0 && r <= 100_000) return 'rgba(255,178,239,0.20)';
  return 'rgba(255,178,239,0.08)';
}

/**
 * Simple squarified treemap layout.
 * Takes items with `value` and lays them into a rect { x, y, w, h }.
 * Returns array of rects in the same order.
 */
interface TreemapRect { x: number; y: number; w: number; h: number }

function layoutTreemap(
  items: { value: number }[],
  bounds: { x: number; y: number; w: number; h: number },
): TreemapRect[] {
  const total = items.reduce((s, it) => s + it.value, 0);
  if (total === 0 || items.length === 0) return [];

  const rects: TreemapRect[] = new Array(items.length);

  // Slice-and-dice: alternate horizontal/vertical splits
  function layout(
    indices: number[],
    bx: number, by: number, bw: number, bh: number,
    depth: number,
  ) {
    if (indices.length === 0) return;
    if (indices.length === 1) {
      rects[indices[0]!] = { x: bx, y: by, w: bw, h: bh };
      return;
    }

    const sum = indices.reduce((s, i) => s + items[i]!.value, 0);
    const horizontal = bw >= bh;

    // Find split point closest to half
    let acc = 0;
    let splitIdx = 0;
    const half = sum / 2;
    for (let i = 0; i < indices.length - 1; i++) {
      acc += items[indices[i]!]!.value;
      if (acc >= half) { splitIdx = i + 1; break; }
      splitIdx = i + 1;
    }
    if (splitIdx === 0) splitIdx = 1;

    const leftIndices = indices.slice(0, splitIdx);
    const rightIndices = indices.slice(splitIdx);
    const leftSum = leftIndices.reduce((s, i) => s + items[i]!.value, 0);
    const ratio = sum > 0 ? leftSum / sum : 0.5;

    if (horizontal) {
      const splitX = bw * ratio;
      layout(leftIndices, bx, by, splitX, bh, depth + 1);
      layout(rightIndices, bx + splitX, by, bw - splitX, bh, depth + 1);
    } else {
      const splitY = bh * ratio;
      layout(leftIndices, bx, by, bw, splitY, depth + 1);
      layout(rightIndices, bx, by + splitY, bw, bh - splitY, depth + 1);
    }
  }

  const sortedIndices = items
    .map((_, i) => i)
    .sort((a, b) => items[b]!.value - items[a]!.value);

  layout(sortedIndices, bounds.x, bounds.y, bounds.w, bounds.h, 0);
  return rects;
}

export function M30Slide({ scan, onAskChloe }: { scan: ScanWithResults; onAskChloe?: () => void }) {
  const syn = getM41Summary(scan, 'M30');
  const mod = getModuleResult(scan, 'M30');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Traffic Sources" scan={scan} sourceLabel="Source: Referring domain analysis, traffic channel breakdown" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Referring domain analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // Raw data
  const totalReferringDomains = typeof raw?.['totalReferringDomains'] === 'number' ? raw['totalReferringDomains'] as number : 0;
  const topSourcesRaw = (raw?.['topSources'] as TopSource[] | undefined) ?? [];
  const totalBacklinks = typeof raw?.['totalBacklinks'] === 'number' ? raw['totalBacklinks'] as number : 0;

  // Normalize sources — take more for treemap (fills space better)
  const sources = topSourcesRaw.slice(0, 12).map((s) => ({
    domain: typeof s.domain === 'string' ? s.domain : '—',
    backlinks: typeof s.backlinks === 'number' ? s.backlinks : 0,
    rank: typeof s.rank === 'number' ? s.rank : 0,
  })).filter(s => s.backlinks > 0);

  const totalSourceBacklinks = sources.reduce((s, x) => s + x.backlinks, 0);

  // Treemap layout (SVG viewBox coordinates)
  const mapW = 600;
  const mapH = 200;
  const gap = 2;
  const treemapItems = sources.map(s => ({ value: s.backlinks }));
  const rawRects = layoutTreemap(treemapItems, { x: 0, y: 0, w: mapW, h: mapH });

  // Apply gap inset
  const rects = rawRects.map(r => ({
    x: r.x + gap / 2,
    y: r.y + gap / 2,
    w: Math.max(0, r.w - gap),
    h: Math.max(0, r.h - gap),
  }));

  return (
    <SlideShell
      moduleName="Traffic Sources"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Referring domain analysis, traffic channel breakdown"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      onAskChloe={onAskChloe}
    >
      <div style={{
        display: 'flex', gap: '3%', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
        marginBottom: '0.6em',
      }}>
        {/* Treemap */}
        <div style={{ flex: 2 }}>
          <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.35em' }}>
            Top Referring Domains
          </p>
          {sources.length > 0 ? (
            <svg
              viewBox={`0 0 ${mapW} ${mapH}`}
              width="100%"
              style={{ display: 'block', borderRadius: '3px' }}
              preserveAspectRatio="none"
            >
              {sources.map((s, i) => {
                const r = rects[i];
                if (!r || r.w < 1 || r.h < 1) return null;
                const pct = totalSourceBacklinks > 0 ? Math.round((s.backlinks / totalSourceBacklinks) * 100) : 0;
                // Only show text if rect is large enough
                const showDomain = r.w > 60 && r.h > 28;
                const showCount = r.w > 40 && r.h > 20;
                const showPct = r.w > 55 && r.h > 40;

                return (
                  <g key={i}>
                    <rect
                      x={r.x} y={r.y} width={r.w} height={r.h}
                      rx={3} ry={3}
                      fill={rankFill(s.rank)}
                      stroke={rankBorder(s.rank)}
                      strokeWidth={1}
                    />
                    {showDomain && (
                      <text
                        x={r.x + 6} y={r.y + 14}
                        fill="var(--gs-light)"
                        fontSize={r.w > 120 ? 11 : 9}
                        fontFamily="var(--font-geist-mono), monospace"
                        fontWeight={600}
                      >
                        {s.domain.length > (r.w > 120 ? 22 : 12)
                          ? s.domain.slice(0, r.w > 120 ? 20 : 10) + '…'
                          : s.domain}
                      </text>
                    )}
                    {showCount && (
                      <text
                        x={r.x + 6} y={r.y + (showDomain ? 28 : 14)}
                        fill="var(--gs-mid)"
                        fontSize={9}
                        fontFamily="var(--font-geist-mono), monospace"
                      >
                        {fmtNum(s.backlinks)}
                      </text>
                    )}
                    {showPct && (
                      <text
                        x={r.x + 6} y={r.y + 42}
                        fill="var(--gs-mid)"
                        fontSize={8}
                        fontFamily="var(--font-geist-mono), monospace"
                        opacity={0.6}
                      >
                        {pct}%
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          ) : (
            <p className="font-data" style={{ fontSize: 'clamp(1px, 0.94cqi, 14px)', color: 'var(--gs-mid)' }}>
              No referring domain data available
            </p>
          )}
        </div>

        {/* Stats panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8em', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          {/* Hero referring domains count */}
          <div style={{
            padding: '0.8em 1em', borderRadius: '4px', width: '100%',
            background: 'rgba(255,178,239,0.04)',
            border: '1px solid rgba(255,178,239,0.08)',
            textAlign: 'center',
          }}>
            <p className="font-data tabular-nums" style={{
              fontSize: 'clamp(1px, 2.62cqi, 42px)', fontWeight: 700, lineHeight: 1,
              color: 'var(--gs-light)',
            }}>
              {fmtNum(totalReferringDomains)}
            </p>
            <p className="font-data uppercase" style={{
              fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)',
              letterSpacing: '0.1em', marginTop: '0.3em',
            }}>
              Referring Domains
            </p>
          </div>

          {totalBacklinks > 0 && (
            <div style={{ padding: '0 1em' }}>
              <p className="font-data tabular-nums" style={{
                fontSize: 'clamp(1px, 1.35cqi, 22px)', fontWeight: 600, lineHeight: 1,
                color: 'var(--gs-base)',
              }}>
                {fmtNum(totalBacklinks)}
              </p>
              <p className="font-data" style={{
                fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', marginTop: '0.15em',
              }}>
                Total Backlinks
              </p>
            </div>
          )}

          {/* Top source highlight */}
          {sources[0] && sources[0].rank > 0 && (
            <div style={{
              padding: '0.6em 1em', borderRadius: '4px', width: '100%',
              border: `1px solid ${sources[0].rank <= 10_000 ? 'rgba(74,222,128,0.15)' : 'rgba(255,178,239,0.08)'}`,
              background: 'rgba(255,178,239,0.03)',
              textAlign: 'center',
            }}>
              <p className="font-data uppercase" style={{
                fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)',
                letterSpacing: '0.1em', marginBottom: '0.2em',
              }}>
                Top Source Rank
              </p>
              <p className="font-data tabular-nums" style={{
                fontSize: 'clamp(1px, 2.10cqi, 34px)', fontWeight: 700, lineHeight: 1,
                color: sources[0].rank <= 10_000 ? 'var(--gs-terminal)' : sources[0].rank <= 100_000 ? 'var(--gs-base)' : 'var(--gs-mid)',
              }}>
                #{sources[0].rank.toLocaleString()}
              </p>
              <p className="font-data" style={{
                fontSize: 'clamp(1px, 0.86cqi, 14px)', color: 'var(--gs-light)',
                marginTop: '0.2em', opacity: 0.7,
              }}>
                {sources[0].domain}
              </p>
            </div>
          )}
        </div>
      </div>
    </SlideShell>
  );
}
