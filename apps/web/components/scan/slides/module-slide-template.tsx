'use client';

import React from 'react';
import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';

/**
 * Shared utilities and base layout for custom module slides.
 * Import these helpers instead of duplicating across every slide file.
 */

// ── M41 Summary interface ─────────────────────────────────────────────
export interface M41Summary {
  executive_summary?: string;
  analysis?: string;
  module_score?: number;
  key_findings?: Array<{ finding: string; severity: string; evidence: string; detail?: string; business_impact?: string }>;
  recommendations?: Array<{ action: string; priority: string; effort?: string; expected_impact?: string }>;
  score_breakdown?: Array<{ criterion: string; score: number; weight: number }>;
}

// ── Color helpers ─────────────────────────────────────────────────────
export function severityColor(s: string) {
  return s === 'critical' ? 'var(--gs-critical)' : s === 'warning' ? 'var(--gs-warning)' : s === 'positive' ? 'var(--gs-terminal)' : 'var(--gs-mid)';
}

export function severityLabel(s: string) {
  return s === 'critical' ? 'CRIT' : s === 'warning' ? 'WARN' : s === 'positive' ? 'GOOD' : 'INFO';
}

export function scoreColor(n: number) {
  return n >= 70 ? 'var(--gs-terminal)' : n >= 40 ? 'var(--gs-warning)' : 'var(--gs-critical)';
}

// ── Data extraction helpers ───────────────────────────────────────────
export function getM41Summary(scan: ScanWithResults, moduleId: string): M41Summary | undefined {
  const rm = new Map<string, ModuleResult>(scan.moduleResults.map((r) => [r.moduleId, r]));
  const m41 = rm.get('M41');
  const sums = (m41?.data?.['moduleSummaries'] as Record<string, M41Summary> | undefined) ?? {};
  return sums[moduleId];
}

export function getModuleResult(scan: ScanWithResults, moduleId: string): ModuleResult | undefined {
  return scan.moduleResults.find((r) => r.moduleId === moduleId);
}

// ── Slide shell — consistent wrapper for all module slides ────────────
interface SlideShellProps {
  moduleName: string;
  score: number | null;
  headline: string;
  execSummary: string;
  scan: ScanWithResults;
  sourceLabel: string;
  /** Custom visualization between exec summary and the 3-col grid */
  children?: React.ReactNode;
  findings: M41Summary['key_findings'];
  recommendations: M41Summary['recommendations'];
  scoreBreakdown: M41Summary['score_breakdown'];
  /** When true, children area flexes to fill remaining space while bottom columns stay at natural height */
  flexViz?: boolean;
}

export function SlideShell({
  moduleName, score, headline, execSummary, scan, sourceLabel,
  children, findings = [], recommendations = [], scoreBreakdown = [],
  flexViz = false,
}: SlideShellProps) {
  return (
    <div
      className="slide-card relative overflow-hidden select-none"
      data-slide-id={moduleName}
      style={{ aspectRatio: '14 / 8.5', background: 'var(--gs-void)', borderRadius: '2px', containerType: 'inline-size' }}
    >
      <div className="relative z-10 h-full flex flex-col overflow-hidden" style={{ padding: '1.5% 3.5% 1%' }}>

        {/* Module bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5em', flexShrink: 0 }}>
          <span className="font-display uppercase" style={{ fontSize: 'clamp(1px, 1.05cqi, 15px)', letterSpacing: '0.18em', color: 'var(--gs-base)' }}>
            {moduleName}
          </span>
          {score != null && (
            <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.12cqi, 17px)', fontWeight: 700, color: scoreColor(score) }}>
              {score}<span style={{ fontWeight: 400, color: 'var(--gs-mid)', fontSize: '0.75em' }}>/100</span>
            </span>
          )}
        </div>

        {/* Headline */}
        <h2 className="font-display" style={{
          fontSize: 'clamp(1px, 2.10cqi, 32px)', fontWeight: 700, lineHeight: 1.15,
          color: 'var(--gs-light)', marginBottom: '0.5em', flexShrink: 0,
          borderLeft: '3px solid var(--gs-base)', paddingLeft: '0.6em',
        }}>
          {headline}
        </h2>

        {/* Executive Summary */}
        {execSummary && (
          <div style={{ marginBottom: '0.6em', flexShrink: 0 }}>
            <p className="font-data" style={{ fontSize: 'clamp(1px, 1.01cqi, 15px)', lineHeight: 1.6, color: 'var(--gs-light)', opacity: 0.85 }}>
              {execSummary}
            </p>
          </div>
        )}

        {/* Custom visualization area */}
        {flexViz ? (
          <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        ) : children}

        {/* Three columns: Findings | Recs | Score Breakdown */}
        <div style={{
          display: 'flex', gap: '3%', borderTop: '1px solid rgba(255,178,239,0.06)', paddingTop: '0.6em',
          ...(flexViz ? { flexShrink: 0 } : { flex: '1 1 0', minHeight: 0 }),
        }}>

          {/* Findings */}
          {findings && findings.length > 0 && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.98cqi, 14px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
                Key Findings
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
                {findings.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.4em', alignItems: 'flex-start' }}>
                    <span className="font-data uppercase flex-shrink-0" style={{
                      fontSize: 'clamp(1px, 0.98cqi, 14px)', padding: '0.1em 0.3em', borderRadius: '2px',
                      background: `color-mix(in srgb, ${severityColor(f.severity)} 15%, transparent)`,
                      color: severityColor(f.severity), marginTop: '0.15em', fontWeight: 600,
                    }}>
                      {severityLabel(f.severity)}
                    </span>
                    <p className="font-data" style={{ fontSize: 'clamp(1px, 1.01cqi, 15px)', color: 'var(--gs-light)', lineHeight: 1.4 }}>
                      {f.finding}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          {findings && findings.length > 0 && recommendations && recommendations.length > 0 && (
            <div style={{ width: '1px', background: 'rgba(255,178,239,0.06)', flexShrink: 0 }} />
          )}

          {/* Recommendations */}
          {recommendations && recommendations.length > 0 && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.98cqi, 14px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
                Recommendations
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
                {recommendations.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.4em', alignItems: 'flex-start' }}>
                    <span className="font-data uppercase flex-shrink-0" style={{
                      fontSize: 'clamp(1px, 0.98cqi, 14px)', padding: '0.1em 0.3em', borderRadius: '2px',
                      background: 'rgba(255,178,239,0.08)', color: 'var(--gs-base)',
                      marginTop: '0.15em', fontWeight: 600,
                    }}>
                      {r.priority}
                    </span>
                    <p className="font-data" style={{ fontSize: 'clamp(1px, 1.01cqi, 15px)', color: 'var(--gs-light)', lineHeight: 1.4 }}>
                      {r.action}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          {scoreBreakdown && scoreBreakdown.length > 0 && (
            <div style={{ width: '1px', background: 'rgba(255,178,239,0.06)', flexShrink: 0 }} />
          )}

          {/* Score Breakdown */}
          {scoreBreakdown && scoreBreakdown.length > 0 && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.98cqi, 14px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
                Score Breakdown
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
                {scoreBreakdown.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                    <span className="font-data" style={{ fontSize: 'clamp(1px, 1.01cqi, 15px)', color: 'var(--gs-light)', flex: 1 }}>
                      {s.criterion}
                    </span>
                    <div style={{ width: '50px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ width: `${s.score}%`, height: '100%', background: scoreColor(s.score), borderRadius: '2px' }} />
                    </div>
                    <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.01cqi, 15px)', fontWeight: 600, color: scoreColor(s.score), minWidth: '2em', textAlign: 'right' }}>
                      {s.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footnote */}
        <div style={{ padding: '0.6em 0 0', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.4 }}>
            {sourceLabel}
          </span>
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.4 }}>
            {scan.domain} — AlphaScan
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Stat block — big number with label, used in visualization areas.
 */
export function StatBlock({ value, label, color = 'var(--gs-light)' }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.88cqi, 30px)', fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </p>
      <p className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', marginTop: '0.2em' }}>
        {label}
      </p>
    </div>
  );
}

/**
 * Horizontal bar — inline SVG bar for score visualization.
 */
export function HorizontalBar({ value, max = 100, color, width = '100%' }: { value: number; max?: number; color: string; width?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ width, height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px' }} />
    </div>
  );
}

// ── Viz Section wrapper ────────────────────────────────────────────────
export function VizSection({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: '0.6em', flexShrink: 0,
      padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
    }}>
      {children}
    </div>
  );
}

// ── SvgGauge — semi-circle arc gauge with threshold coloring ───────────
export function SvgGauge({ value, max = 100, label, thresholds }: {
  value: number; max?: number; label: string;
  thresholds?: { good: number; warn: number };
}) {
  const pct = Math.min(1, Math.max(0, value / max));
  const t = thresholds ?? { good: 0.7, warn: 0.4 };
  const color = pct >= t.good ? 'var(--gs-terminal)' : pct >= t.warn ? 'var(--gs-warning)' : 'var(--gs-critical)';
  const r = 38;
  const circumHalf = Math.PI * r;
  const dashLen = circumHalf * pct;
  return (
    <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
      <svg width="120" height="68" viewBox="0 0 90 52">
        <path d={`M 7 50 A ${r} ${r} 0 0 1 83 50`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round" />
        <path d={`M 7 50 A ${r} ${r} 0 0 1 83 50`} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${dashLen} ${circumHalf}`} />
      </svg>
      <p className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.50cqi, 22px)', fontWeight: 700, color, marginTop: '-0.6em', lineHeight: 1 }}>
        {typeof value === 'number' ? (value % 1 !== 0 ? value.toFixed(value < 1 ? 3 : 1) : value) : value}
      </p>
      <p className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', marginTop: '0.15em' }}>
        {label}
      </p>
    </div>
  );
}

// ── SegmentedBar — horizontal bar with colored segments ─────────────────
export function SegmentedBar({ segments }: { segments: Array<{ value: number; color: string; label: string }> }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;
  return (
    <div>
      <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color, minWidth: s.value > 0 ? '2px' : 0 }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '1em', marginTop: '0.3em' }}>
        {segments.filter(s => s.value > 0).map((s, i) => (
          <span key={i} className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: s.color }}>
            {s.label}: {s.value.toLocaleString()} ({Math.round((s.value / total) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  );
}

// ── MatrixGrid — rows x columns with status cells ───────────────────────
export function MatrixGrid({ rows, columns }: {
  rows: Array<{ label: string; cells: Array<{ status: 'pass' | 'fail' | 'warn' | 'na'; detail?: string }> }>;
  columns: string[];
}) {
  const statusStyle = { pass: { bg: 'rgba(74,222,128,0.12)', color: 'var(--gs-terminal)', sym: '\u2713' }, fail: { bg: 'rgba(239,68,68,0.12)', color: 'var(--gs-critical)', sym: '\u2717' }, warn: { bg: 'rgba(251,191,36,0.12)', color: 'var(--gs-warning)', sym: '~' }, na: { bg: 'transparent', color: 'var(--gs-mid)', sym: '\u2014' } } as const;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${columns.length}, 1fr)`, gap: '1px' }}>
      <div />
      {columns.map(c => (
        <div key={c} className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', textAlign: 'center', padding: '0.2em', letterSpacing: '0.05em' }}>
          {c}
        </div>
      ))}
      {rows.map(r => (
        <React.Fragment key={r.label}>
          <div className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-light)', padding: '0.2em 0.4em 0.2em 0', whiteSpace: 'nowrap' }}>
            {r.label}
          </div>
          {r.cells.map((c, ci) => {
            const s = statusStyle[c.status];
            return (
              <div key={`${r.label}-${ci}`} style={{ background: s.bg, textAlign: 'center', padding: '0.2em', borderRadius: '2px' }}>
                <span className="font-display" style={{ fontSize: 'clamp(1px, 1.05cqi, 16px)', color: s.color, fontWeight: 700 }}>
                  {s.sym}
                </span>
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── StackLayer — horizontal labeled row for architecture diagrams ────────
export function StackLayer({ label, value, confidence }: { label: string; value: string; confidence?: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.6em', padding: '0.35em 0.8em',
      background: `rgba(255,178,239,${(confidence ?? 0.8) * 0.08})`,
      borderLeft: '3px solid var(--gs-base)', borderRadius: '0 3px 3px 0',
    }}>
      <span className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', minWidth: '6em', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span className="font-data" style={{ fontSize: 'clamp(1px, 0.98cqi, 15px)', color: 'var(--gs-light)', fontWeight: 600 }}>
        {value}
      </span>
      {confidence != null && (
        <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', marginLeft: 'auto' }}>
          {Math.round(confidence * 100)}% conf.
        </span>
      )}
    </div>
  );
}

// ── StarRating — 5 SVG stars filled proportionally ──────────────────────
export function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  const stars = Array.from({ length: max }, (_, i) => {
    const fill = Math.min(1, Math.max(0, rating - i));
    return fill;
  });
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {stars.map((fill, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 16 16">
          <defs><clipPath id={`star-${i}`}><rect x="0" y="0" width={fill * 16} height="16" /></clipPath></defs>
          <path d="M8 1l2.2 4.5 5 .7-3.6 3.5.85 5-4.45-2.35L3.55 14.7l.85-5L.8 6.2l5-.7z" fill="rgba(255,255,255,0.08)" />
          <path d="M8 1l2.2 4.5 5 .7-3.6 3.5.85 5-4.45-2.35L3.55 14.7l.85-5L.8 6.2l5-.7z" fill="var(--gs-warning)" clipPath={`url(#star-${i})`} />
        </svg>
      ))}
    </div>
  );
}

// ── FreshnessBar — gradient bar green-to-red ────────────────────────────
export function FreshnessBar({ daysAgo, maxDays = 365 }: { daysAgo: number; maxDays?: number }) {
  const pct = Math.min(1, daysAgo / maxDays);
  const color = pct < 0.25 ? 'var(--gs-terminal)' : pct < 0.5 ? 'var(--gs-warning)' : 'var(--gs-critical)';
  const label = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo}d ago`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: `linear-gradient(90deg, var(--gs-terminal), ${color})`, borderRadius: '3px' }} />
      </div>
      <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );
}

// ── CheckItem — pass/fail/warn with label and detail ────────────────────
export function CheckItem({ status, label, detail }: { status: 'pass' | 'fail' | 'warn'; label: string; detail?: string }) {
  const s = { pass: { color: 'var(--gs-terminal)', sym: '\u2713' }, fail: { color: 'var(--gs-critical)', sym: '\u2717' }, warn: { color: 'var(--gs-warning)', sym: '~' } } as const;
  const st = s[status];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4em' }}>
      <span className="font-display" style={{ fontSize: 'clamp(1px, 1.12cqi, 17px)', fontWeight: 700, color: st.color, lineHeight: 1, flexShrink: 0, marginTop: '0.05em' }}>
        {st.sym}
      </span>
      <div>
        <p className="font-data" style={{ fontSize: 'clamp(1px, 0.94cqi, 14px)', color: 'var(--gs-light)', lineHeight: 1.3 }}>
          {label}
        </p>
        {detail && (
          <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-mid)', lineHeight: 1.3 }}>
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

// ── RankedBar — horizontal bar with label and value ─────────────────────
export function RankedBar({ label, value, max, color = 'var(--gs-base)', suffix = '' }: { label: string; value: number; max: number; color?: string; suffix?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
      <span className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-light)', minWidth: '30%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', minWidth: value > 0 ? '3px' : 0 }} />
      </div>
      <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-light)', fontWeight: 600, minWidth: '4em', textAlign: 'right' }}>
        {value.toLocaleString()}{suffix}
      </span>
    </div>
  );
}

// ── Pill — compact tag ─────────────────────────────────────────────────
export function Pill({ text, color = 'var(--gs-light)' }: { text: string; color?: string }) {
  return (
    <span className="font-data" style={{
      fontSize: 'clamp(1px, 0.75cqi, 13px)', color, padding: '0.15em 0.5em', borderRadius: '3px',
      background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 15%, transparent)`,
    }}>
      {text}
    </span>
  );
}

// ── SlideShellAlt — two-column variant: left panel (viz) + right panel (findings/recs) ──
interface SlideShellAltProps {
  moduleName: string;
  score: number | null;
  headline: string;
  execSummary: string;
  scan: ScanWithResults;
  sourceLabel: string;
  /** Left side — visualization */
  vizContent: React.ReactNode;
  findings: M41Summary['key_findings'];
  recommendations: M41Summary['recommendations'];
  scoreBreakdown: M41Summary['score_breakdown'];
}

export function SlideShellAlt({
  moduleName, score, headline, execSummary, scan, sourceLabel,
  vizContent, findings = [], recommendations = [], scoreBreakdown = [],
}: SlideShellAltProps) {
  return (
    <div
      className="slide-card relative overflow-hidden select-none"
      data-slide-id={moduleName}
      style={{ aspectRatio: '14 / 8.5', background: 'var(--gs-void)', borderRadius: '2px', containerType: 'inline-size' }}
    >
      <div className="relative z-10 h-full flex flex-col overflow-hidden" style={{ padding: '1.5% 3.5% 1%' }}>
        {/* Module bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5em', flexShrink: 0 }}>
          <span className="font-display uppercase" style={{ fontSize: 'clamp(1px, 1.05cqi, 15px)', letterSpacing: '0.18em', color: 'var(--gs-base)' }}>
            {moduleName}
          </span>
          {score != null && (
            <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.12cqi, 17px)', fontWeight: 700, color: scoreColor(score) }}>
              {score}<span style={{ fontWeight: 400, color: 'var(--gs-mid)', fontSize: '0.75em' }}>/100</span>
            </span>
          )}
        </div>

        {/* Headline */}
        <h2 className="font-display" style={{
          fontSize: 'clamp(1px, 1.80cqi, 28px)', fontWeight: 700, lineHeight: 1.15,
          color: 'var(--gs-light)', marginBottom: '0.4em', flexShrink: 0,
          borderLeft: '3px solid var(--gs-base)', paddingLeft: '0.6em',
        }}>
          {headline}
        </h2>

        {/* Exec summary */}
        {execSummary && (
          <p className="font-data" style={{ fontSize: 'clamp(1px, 0.94cqi, 14px)', lineHeight: 1.5, color: 'var(--gs-light)', opacity: 0.85, marginBottom: '0.5em', flexShrink: 0 }}>
            {execSummary}
          </p>
        )}

        {/* Two columns: Left (viz) | Right (findings + recs) */}
        <div style={{ display: 'flex', flex: '1 1 0', minHeight: 0, gap: '3%', borderTop: '1px solid rgba(255,178,239,0.06)', paddingTop: '0.5em' }}>
          {/* Left: Visualization */}
          <div style={{ flex: '1 1 48%', overflow: 'hidden' }}>
            {vizContent}
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'rgba(255,178,239,0.06)', flexShrink: 0 }} />

          {/* Right: Findings + Recs + Scores stacked */}
          <div style={{ flex: '1 1 48%', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
            {findings && findings.length > 0 && (
              <div>
                <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.3em' }}>
                  Key Findings
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25em' }}>
                  {findings.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.3em', alignItems: 'flex-start' }}>
                      <span className="font-data uppercase flex-shrink-0" style={{
                        fontSize: 'clamp(1px, 0.86cqi, 13px)', padding: '0.05em 0.25em', borderRadius: '2px',
                        background: `color-mix(in srgb, ${severityColor(f.severity)} 15%, transparent)`,
                        color: severityColor(f.severity), marginTop: '0.1em', fontWeight: 600,
                      }}>
                        {severityLabel(f.severity)}
                      </span>
                      <p className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-light)', lineHeight: 1.35 }}>
                        {f.finding}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {recommendations && recommendations.length > 0 && (
              <div>
                <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.3em' }}>
                  Recommendations
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25em' }}>
                  {recommendations.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.3em', alignItems: 'flex-start' }}>
                      <span className="font-data uppercase flex-shrink-0" style={{
                        fontSize: 'clamp(1px, 0.86cqi, 13px)', padding: '0.05em 0.25em', borderRadius: '2px',
                        background: 'rgba(255,178,239,0.08)', color: 'var(--gs-base)',
                        marginTop: '0.1em', fontWeight: 600,
                      }}>
                        {r.priority}
                      </span>
                      <p className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-light)', lineHeight: 1.35 }}>
                        {r.action}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {scoreBreakdown && scoreBreakdown.length > 0 && (
              <div>
                <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.3em' }}>
                  Scores
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2em' }}>
                  {scoreBreakdown.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4em' }}>
                      <span className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-light)', flex: 1 }}>{s.criterion}</span>
                      <div style={{ width: '36px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ width: `${s.score}%`, height: '100%', background: scoreColor(s.score), borderRadius: '2px' }} />
                      </div>
                      <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', fontWeight: 600, color: scoreColor(s.score), minWidth: '1.5em', textAlign: 'right' }}>{s.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footnote */}
        <div style={{ padding: '0.5em 0 0', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.4 }}>
            {sourceLabel}
          </span>
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.4 }}>
            {scan.domain} — AlphaScan
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Skipped/unavailable state ──────────────────────────────────────────
export function SkippedSlide({ moduleName, scan, sourceLabel }: { moduleName: string; scan: ScanWithResults; sourceLabel: string }) {
  return (
    <div className="slide-card relative overflow-hidden select-none"
      data-slide-id={moduleName}
      style={{ aspectRatio: '14 / 8.5', background: 'var(--gs-void)', borderRadius: '2px', containerType: 'inline-size' }}>
      <div className="relative z-10 h-full flex flex-col overflow-hidden" style={{ padding: '1.5% 3.5% 1%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5em', flexShrink: 0 }}>
          <span className="font-display uppercase" style={{ fontSize: 'clamp(1px, 1.05cqi, 15px)', letterSpacing: '0.18em', color: 'var(--gs-base)' }}>{moduleName}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center" style={{ gap: '1em' }}>
          <p className="font-data" style={{ fontSize: 'clamp(1px, 1.20cqi, 18px)', color: 'var(--gs-mid)', textAlign: 'center', maxWidth: '70%' }}>
            This module was not available for this scan.
          </p>
          <p className="font-data" style={{ fontSize: 'clamp(1px, 0.98cqi, 15px)', color: 'var(--gs-mid)', opacity: 0.6, textAlign: 'center' }}>
            Re-run the scan to generate this analysis.
          </p>
        </div>
        <div style={{ padding: '0.6em 0 0', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.4 }}>{sourceLabel}</span>
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.4 }}>{scan.domain} — AlphaScan</span>
        </div>
      </div>
    </div>
  );
}
