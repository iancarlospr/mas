'use client';

import { useMemo } from 'react';
import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  StatBlock,
  SkippedSlide,
  scoreColor,
} from './module-slide-template';

/**
 * M31 Slide — Domain Trust
 * ═════════════════════════
 *
 * Layout C: Hero stats row (Domain Rank, Total Backlinks, Referring Domains,
 * Broken Backlinks in red) + anchor text distribution as RankedBars.
 */

interface AnchorEntry {
  anchor?: string;
  text?: string;
  backlinks?: number;
  count?: number;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return n.toLocaleString();
}

/**
 * Word cloud — archimedean spiral placement with conservative bounding box collision.
 * Largest word centered, others spiral out. No overlaps.
 */
const CLOUD_W = 600;
const CLOUD_H = 240;
// Monospace: overestimate char width to guarantee zero overlap in SVG rendering.
const CHAR_W_RATIO = 0.75;
const PAD = 14;

interface PlacedWord {
  text: string; x: number; y: number; fontSize: number;
  pct: number; isEmpty: boolean; opacity: number; weight: number;
}
interface BBox { l: number; t: number; r: number; b: number }

function bbox(text: string, fs: number, x: number, y: number): BBox {
  const hw = (text.length * fs * CHAR_W_RATIO) / 2 + PAD;
  const hh = fs / 2 + PAD;
  return { l: x - hw, r: x + hw, t: y - hh, b: y + hh };
}

function hits(a: BBox, b: BBox) {
  return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
}

function layoutCloud(anchors: { text: string; count: number }[], maxCount: number, totalCount: number): PlacedWord[] {
  const sorted = [...anchors].sort((a, b) => b.count - a.count);
  const placed: PlacedWord[] = [];
  const boxes: BBox[] = [];
  const cx = CLOUD_W / 2;
  const cy = CLOUD_H / 2;
  const aspect = CLOUD_W / CLOUD_H;

  for (const a of sorted) {
    const ratio = a.count / maxCount;
    const t = Math.sqrt(ratio);
    const fontSize = 14 + t * 38;
    const pct = totalCount > 0 ? Math.round((a.count / totalCount) * 100) : 0;
    const label = a.text || '(empty)';
    const isEmpty = !a.text || a.text === '(empty)' || a.text.trim() === '';
    const opacity = isEmpty ? 0.3 : 0.2 + t * 0.7;
    const weight = ratio > 0.3 ? 700 : ratio > 0.1 ? 600 : 400;

    let ok = false;
    for (let s = 0; s < 2000; s++) {
      const angle = s * 0.12;
      const r = s * 0.35;
      const px = cx + aspect * r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      const b = bbox(label, fontSize, px, py);

      if (b.l < 0 || b.r > CLOUD_W || b.t < 0 || b.b > CLOUD_H) continue;

      let collide = false;
      for (const ex of boxes) { if (hits(b, ex)) { collide = true; break; } }
      if (collide) continue;

      boxes.push(b);
      placed.push({ text: label, x: px, y: py, fontSize, pct, isEmpty, opacity, weight });
      ok = true;
      break;
    }
    if (!ok) { /* word doesn't fit — skip */ }
  }
  return placed;
}

function AnchorCloud({ anchors, totalCount }: {
  anchors: { text: string; count: number }[];
  totalCount: number;
}) {
  const maxCount = Math.max(...anchors.map(a => a.count), 1);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const placed = useMemo(
    () => layoutCloud(anchors, maxCount, totalCount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchors.length, maxCount, totalCount],
  );

  return (
    <svg
      viewBox={`0 0 ${CLOUD_W} ${CLOUD_H}`}
      width="100%"
      height="100%"
      style={{ display: 'block' }}
      preserveAspectRatio="xMidYMid meet"
    >
      {placed.map((w, i) => (
        <g key={i}>
          <text
            x={w.x} y={w.y}
            textAnchor="middle" dominantBaseline="central"
            fill={w.isEmpty ? 'var(--gs-mid)' : 'var(--gs-light)'}
            opacity={w.opacity}
            fontSize={w.fontSize}
            fontFamily="var(--font-geist-mono), monospace"
            fontWeight={w.weight}
            fontStyle={w.isEmpty ? 'italic' : 'normal'}
          >
            {w.text}
          </text>
          <text
            x={w.x + (w.text.length * w.fontSize * CHAR_W_RATIO) / 2 + 3}
            y={w.y - w.fontSize * 0.32}
            textAnchor="start" dominantBaseline="central"
            fill="var(--gs-mid)" opacity={0.35}
            fontSize={Math.max(8, w.fontSize * 0.32)}
            fontFamily="var(--font-geist-mono), monospace"
          >
            {w.pct}%
          </text>
        </g>
      ))}
    </svg>
  );
}

export function M31Slide({ scan, onAskChloe }: { scan: ScanWithResults; onAskChloe?: () => void }) {
  const syn = getM41Summary(scan, 'M31');
  const mod = getModuleResult(scan, 'M31');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Domain Trust" scan={scan} sourceLabel="Source: Backlink analysis, domain authority, global rank" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Domain trust and backlink profile';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // Raw data — defensive field name handling
  const domainRank = typeof raw?.['rank'] === 'number' ? raw['rank'] as number
    : typeof raw?.['domainRank'] === 'number' ? raw['domainRank'] as number
    : null;

  const totalBacklinks = typeof raw?.['backlinks'] === 'number' ? raw['backlinks'] as number
    : typeof raw?.['totalBacklinks'] === 'number' ? raw['totalBacklinks'] as number
    : 0;

  const referringDomains = typeof raw?.['referringDomains'] === 'number' ? raw['referringDomains'] as number
    : typeof raw?.['totalReferringDomains'] === 'number' ? raw['totalReferringDomains'] as number
    : 0;

  const brokenBacklinks = typeof raw?.['brokenBacklinks'] === 'number' ? raw['brokenBacklinks'] as number : 0;

  const domainTrust = typeof raw?.['domainTrust'] === 'number' ? raw['domainTrust'] as number : null;

  // Anchor text data
  const topAnchorsRaw = (raw?.['topAnchors'] as AnchorEntry[] | undefined) ?? [];
  const anchors = topAnchorsRaw.slice(0, 8).map((a) => ({
    text: typeof a.anchor === 'string' ? a.anchor : typeof a.text === 'string' ? a.text : '—',
    count: typeof a.backlinks === 'number' ? a.backlinks : typeof a.count === 'number' ? a.count : 0,
  }));
  const totalAnchorCount = anchors.reduce((s, a) => s + a.count, 0);
  const maxAnchorCount = anchors.length > 0 ? Math.max(...anchors.map(a => a.count), 1) : 1;

  return (
    <SlideShell
      moduleName="Domain Trust"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Backlink analysis, domain authority, global rank"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      onAskChloe={onAskChloe}
    >
      {/* Stats left + Anchor text cloud right */}
      <div style={{
        display: 'flex', gap: '3%', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)',
        borderBottom: '1px solid rgba(255,178,239,0.06)',
        marginBottom: '0.6em',
      }}>
        {/* Left: stats panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8em', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          {domainRank != null && domainRank > 0 && (
            <div style={{
              padding: '0.8em 1em', borderRadius: '4px', width: '100%',
              background: 'rgba(255,178,239,0.04)',
              border: '1px solid rgba(255,178,239,0.08)',
              textAlign: 'center',
            }}>
              <p className="font-data tabular-nums" style={{
                fontSize: 'clamp(1px, 2.62cqi, 42px)', fontWeight: 700, lineHeight: 1,
                color: domainRank <= 100_000 ? 'var(--gs-terminal)' : domainRank <= 500_000 ? 'var(--gs-warning)' : 'var(--gs-light)',
              }}>
                #{domainRank.toLocaleString()}
              </p>
              <p className="font-data uppercase" style={{
                fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)',
                letterSpacing: '0.1em', marginTop: '0.3em',
              }}>
                Domain Rank
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1.5em', flexWrap: 'wrap' }}>
            <StatBlock value={fmtNum(totalBacklinks)} label="Total Backlinks" color="var(--gs-light)" />
            <StatBlock value={fmtNum(referringDomains)} label="Referring Domains" color="var(--gs-base)" />
            {brokenBacklinks > 0 && (
              <StatBlock value={fmtNum(brokenBacklinks)} label="Broken Backlinks" color="var(--gs-critical)" />
            )}
          </div>

          {domainTrust != null && (
            <StatBlock value={domainTrust} label="Trust Score" color={scoreColor(domainTrust)} />
          )}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', background: 'rgba(255,178,239,0.1)', flexShrink: 0 }} />

        {/* Right: SVG text cloud filling the rectangle */}
        {anchors.length > 0 ? (
          <div style={{ flex: 2 }}>
            <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.35em' }}>
              Anchor Text Profile
            </p>
            <AnchorCloud anchors={anchors} totalCount={totalAnchorCount} />
          </div>
        ) : (
          <div style={{ flex: 2 }} />
        )}
      </div>
    </SlideShell>
  );
}
