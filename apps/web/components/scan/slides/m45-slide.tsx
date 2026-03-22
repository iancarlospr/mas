'use client';

import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';

/**
 * M45 Slide — Stack Analyzer
 * ═══════════════════════════
 *
 * Layout:
 *   Row 1: Module bar + tool count
 *   Row 2: Assessment headline (pink left border)
 *   Row 3: Stats strip — total | redundant | abandoned
 *   Row 4: Three-panel layout — Current | Lean | Optimal
 *   Row 5: Methodology footnote
 *
 * Paid module — only renders for paid scans with M45 data.
 */

interface StackCategory { name: string; tools: string[] }
interface Removal { tool: string; reason: string }
interface Gap { capability: string; recommendation: string; rationale: string }
interface Upgrade { currentTool: string; suggestedTool: string; rationale: string }
interface Redundancy { tools: string[]; function: string; effortToConsolidate: string }

// ── Typography scale (cqi) — 12px minimum enforced, body-grade sizing ─
const T = {
  overline:  'clamp(1px, 1.05cqi, 15px)',
  section:   'clamp(1px, 1.20cqi, 16px)',
  body:      'clamp(1px, 1.01cqi, 15px)',
  detail:    'clamp(1px, 0.94cqi, 14px)',
  pill:      'clamp(1px, 0.86cqi, 13px)',
  stat:      'clamp(1px, 2.25cqi, 36px)',
  statLabel: 'clamp(1px, 0.94cqi, 14px)',
};

const DIVIDER = '1px solid rgba(255,178,239,0.06)';
const PINK_BG = 'rgba(255,178,239,0.06)';
const PINK_BORDER = 'rgba(255,178,239,0.08)';

function statColor(n: number, threshold: number) {
  return n > 0 ? (n >= threshold ? 'var(--gs-critical)' : 'var(--gs-warning)') : 'var(--gs-terminal)';
}

export function M45Slide({ scan }: { scan: ScanWithResults; chloeCallout?: import('react').ReactNode }) {
  const rm = new Map<string, ModuleResult>(scan.moduleResults.map((r) => [r.moduleId, r]));
  const m45 = rm.get('M45');
  if (!m45 || m45.status !== 'success') return null;

  const analysis = (m45.data as Record<string, unknown>)?.['stackAnalysis'] as Record<string, unknown> | undefined;
  if (!analysis) return null;

  // ── Extract data ──
  const current = (analysis['currentStack'] as Record<string, unknown>) ?? {};
  const categories = (current['categories'] as StackCategory[]) ?? [];
  const assessment = (current['assessment'] as string) ?? '';
  const totalTools = (current['totalTools'] as number) ?? 0;
  const redundantPairs = (current['redundantPairs'] as number) ?? 0;
  const abandonedCount = (current['abandonedTools'] as number) ?? 0;

  const redundancies = (analysis['redundancies'] as Redundancy[]) ?? [];
  const leanStack = (analysis['leanStack'] as Record<string, unknown>) ?? {};
  const leanRemovals = (leanStack['removals'] as Removal[]) ?? [];
  const leanToolsAfter = (leanStack['totalToolsAfter'] as number) ?? totalTools;
  const leanBenefit = (leanStack['keyBenefit'] as string) ?? '';

  const optimalStack = (analysis['optimalStack'] as Record<string, unknown>) ?? {};
  const optimalGaps = (optimalStack['gaps'] as Gap[]) ?? [];
  const optimalUpgrades = (optimalStack['upgrades'] as Upgrade[]) ?? [];
  const optimalToolsAfter = (optimalStack['totalToolsAfter'] as number) ?? totalTools;
  const optimalBenefit = (optimalStack['keyBenefit'] as string) ?? '';

  const methodology = (analysis['methodology'] as string) ?? '';

  return (
    <div
      className="slide-card relative overflow-hidden select-none"
      data-slide-id="Stack Analyzer"
      style={{ aspectRatio: '14 / 8.5', background: 'var(--gs-void)', borderRadius: '2px', containerType: 'inline-size' }}
    >
      <div className="relative z-10 h-full flex flex-col overflow-hidden" style={{ padding: '1.5% 3.5% 0', paddingBottom: 'clamp(1px, 2.10cqi, 28px)' }}>

        {/* ═══ Module bar ═══ */}
        <div style={{ marginBottom: '0.4em', flexShrink: 0 }}>
          <span className="font-display uppercase" style={{ fontSize: T.overline, letterSpacing: '0.18em', color: 'var(--gs-base)' }}>
            Stack Analyzer
          </span>
        </div>

        {/* ═══ Assessment headline ═══ */}
        <h2 className="font-data" style={{
          fontSize: T.body, fontWeight: 400, lineHeight: 1.5, color: 'var(--gs-light)',
          marginBottom: '0.6em', flexShrink: 0,
          borderLeft: '3px solid var(--gs-base)', paddingLeft: '0.6em',
          opacity: 0.9,
        }}>
          {assessment}
        </h2>

        {/* ═══ Stats strip ═══ */}
        <div style={{
          display: 'flex', gap: '2%', marginBottom: '0.7em', flexShrink: 0,
          borderTop: DIVIDER, borderBottom: DIVIDER, padding: '0.5em 0',
        }}>
          <StatBlock label="Detected" value={totalTools} color="var(--gs-light)" />
          <StatBlock label="Active" value={(totalTools - abandonedCount)} color="var(--gs-terminal)" />
          <StatBlock label="Redundant" value={redundantPairs} color={statColor(redundantPairs, 3)} />
          <StatBlock label="Abandoned" value={abandonedCount} color={statColor(abandonedCount, 2)} />
        </div>

        {/* ═══ Three-panel layout ═══ */}
        <div style={{ display: 'flex', flex: '1 1 0', minHeight: 0, gap: '0' }}>

          {/* ── Panel 1: Current Stack ── */}
          <div style={{ flex: '1 1 38%', overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingRight: '2%' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5em', marginBottom: '0.5em', flexShrink: 0 }}>
              <h4 className="font-display uppercase" style={{
                fontSize: T.section, letterSpacing: '0.18em', color: 'var(--gs-base)',
              }}>
                Current Stack
              </h4>
              <span className="font-data tabular-nums" style={{ fontSize: T.body, color: 'var(--gs-light)', opacity: 0.5 }}>
                {totalTools} tools
              </span>
            </div>
            <div style={{ flex: '1 1 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
              {categories.map((cat, i) => (
                <div key={i}>
                  <p className="font-data" style={{ fontSize: T.body, color: 'var(--gs-mid)', marginBottom: '0.2em', fontWeight: 600 }}>
                    {cat.name}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25em' }}>
                    {cat.tools.map((tool) => (
                      <ToolPill key={tool} name={tool} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Redundancies inline */}
              {redundancies.length > 0 && (
                <div style={{ marginTop: '0.3em', borderTop: DIVIDER, paddingTop: '0.4em' }}>
                  <p className="font-data" style={{ fontSize: T.body, color: 'var(--gs-warning)', marginBottom: '0.2em', fontWeight: 600 }}>
                    Redundancies
                  </p>
                  {redundancies.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '0.4em', marginBottom: '0.15em' }}>
                      <span className="font-data" style={{ fontSize: T.body, color: 'var(--gs-warning)', fontWeight: 700, flexShrink: 0 }}>~</span>
                      <p className="font-data" style={{ fontSize: T.body, color: 'var(--gs-light)', opacity: 0.8, lineHeight: 1.4 }}>
                        {r.tools.join(' + ')} — {r.function}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'rgba(255,178,239,0.06)', flexShrink: 0 }} />

          {/* ── Panel 2: Lean Stack ── */}
          <div style={{ flex: '1 1 28%', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 2%' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5em', marginBottom: '0.3em', flexShrink: 0 }}>
              <h4 className="font-display uppercase" style={{
                fontSize: T.section, letterSpacing: '0.18em', color: 'var(--gs-base)',
              }}>
                Lean Stack
              </h4>
              <span className="font-data tabular-nums" style={{ fontSize: T.body, color: 'var(--gs-light)', opacity: 0.5 }}>
                {leanToolsAfter} tools
              </span>
            </div>
            {leanBenefit && (
              <p className="font-data" style={{
                fontSize: T.body, color: 'var(--gs-light)', lineHeight: 1.4,
                marginBottom: '0.5em', flexShrink: 0, fontWeight: 400, opacity: 0.8,
              }}>
                {leanBenefit}
              </p>
            )}
            <div style={{ flex: '1 1 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
              {leanRemovals.length > 0 && (
                <>
                  <p className="font-data uppercase" style={{ fontSize: T.body, color: 'var(--gs-critical)', letterSpacing: '0.1em', fontWeight: 700, flexShrink: 0, opacity: 0.7 }}>
                    Remove
                  </p>
                  {leanRemovals.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4em' }}>
                      <span className="font-display" style={{ fontSize: T.body, color: 'var(--gs-critical)', fontWeight: 700, lineHeight: 1, marginTop: '0.15em', flexShrink: 0 }}>
                        &minus;
                      </span>
                      <div>
                        <span className="font-data" style={{ fontSize: T.body, color: 'var(--gs-light)', fontWeight: 600 }}>
                          {r.tool}
                        </span>
                        <p className="font-data" style={{ fontSize: T.body, color: 'var(--gs-mid)', lineHeight: 1.35, opacity: 0.7 }}>
                          {r.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {leanRemovals.length === 0 && (
                <p className="font-data" style={{ fontSize: T.body, color: 'var(--gs-mid)', opacity: 0.5, fontStyle: 'italic' }}>
                  No tools flagged for removal.
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'rgba(255,178,239,0.06)', flexShrink: 0 }} />

          {/* ── Panel 3: Optimal Stack ── */}
          <div style={{ flex: '1 1 34%', overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingLeft: '2%' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5em', marginBottom: '0.3em', flexShrink: 0 }}>
              <h4 className="font-display uppercase" style={{
                fontSize: T.section, letterSpacing: '0.18em', color: 'var(--gs-base)',
              }}>
                Optimal Stack
              </h4>
              <span className="font-data tabular-nums" style={{ fontSize: T.body, color: 'var(--gs-light)', opacity: 0.5 }}>
                {optimalToolsAfter} tools
              </span>
            </div>
            {optimalBenefit && (
              <p className="font-data" style={{
                fontSize: T.body, color: 'var(--gs-base)', lineHeight: 1.4,
                marginBottom: '0.5em', flexShrink: 0, fontWeight: 500,
              }}>
                {optimalBenefit}
              </p>
            )}
            <div style={{ flex: '1 1 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
              {/* Gaps */}
              {optimalGaps.length > 0 && (
                <>
                  <p className="font-data uppercase" style={{ fontSize: T.body, color: 'var(--gs-terminal)', letterSpacing: '0.1em', fontWeight: 700, flexShrink: 0, opacity: 0.7 }}>
                    Add
                  </p>
                  {optimalGaps.map((g, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4em' }}>
                      <span className="font-display" style={{ fontSize: T.body, color: 'var(--gs-terminal)', fontWeight: 700, lineHeight: 1, marginTop: '0.15em', flexShrink: 0 }}>
                        +
                      </span>
                      <div>
                        <span className="font-data" style={{ fontSize: T.body, color: 'var(--gs-light)', fontWeight: 600 }}>
                          {g.capability}
                        </span>
                        <p className="font-data" style={{ fontSize: T.body, color: 'var(--gs-mid)', lineHeight: 1.35, opacity: 0.7 }}>
                          {g.recommendation}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Upgrades */}
              {optimalUpgrades.length > 0 && (
                <>
                  <p className="font-data uppercase" style={{
                    fontSize: T.body, color: 'var(--gs-base)', letterSpacing: '0.1em', fontWeight: 700,
                    flexShrink: 0, opacity: 0.7, marginTop: optimalGaps.length > 0 ? '0.3em' : 0,
                  }}>
                    Upgrade
                  </p>
                  {optimalUpgrades.map((u, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '0.4em' }}>
                      <span className="font-display" style={{ fontSize: T.body, color: 'var(--gs-base)', fontWeight: 700, flexShrink: 0 }}>
                        &uarr;
                      </span>
                      <p className="font-data" style={{ fontSize: T.body, color: 'var(--gs-light)', lineHeight: 1.35 }}>
                        <span style={{ opacity: 0.5, textDecoration: 'line-through' }}>{u.currentTool}</span>
                        <span style={{ color: 'var(--gs-mid)', margin: '0 0.3em' }}>&rarr;</span>
                        <span style={{ fontWeight: 600 }}>{u.suggestedTool}</span>
                      </p>
                    </div>
                  ))}
                </>
              )}

              {optimalGaps.length === 0 && optimalUpgrades.length === 0 && (
                <p className="font-data" style={{ fontSize: T.body, color: 'var(--gs-mid)', opacity: 0.5, fontStyle: 'italic' }}>
                  Stack is well-optimized for this business scale.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Methodology footnote ═══ */}
        <div
          style={{
            padding: '1.2% 3.5% 1.5%',
            borderTop: '1px solid rgba(255,178,239,0.06)',
            background: 'rgba(255,178,239,0.015)',
            margin: '0 -3.5%',
            marginTop: 'auto',
            flexShrink: 0,
          }}
        >
          <p
            className="font-data"
            style={{
              fontSize: T.detail,
              lineHeight: 1.55,
              color: 'var(--gs-mid)',
              fontStyle: 'italic',
            }}
          >
            {methodology || 'AI-powered analysis based on detected tools, business context, and industry best practices.'}
          </p>
        </div>
      </div>

      {/* Brand strip */}
      <div
        className="absolute left-0 right-0 bottom-0 overflow-hidden"
        style={{
          background: 'var(--gs-base)',
          height: 'clamp(1px, 2.10cqi, 28px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <pre
          className="font-data leading-none whitespace-pre select-none"
          style={{
            fontSize: 'clamp(1.5px, 0.25cqi, 3px)',
            lineHeight: '1.1',
            color: '#080808',
          }}
        >
{` █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`}
        </pre>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function StatBlock({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: '3em' }}>
      <p className="font-data tabular-nums" style={{ fontSize: T.stat, fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </p>
      <p className="font-data" style={{ fontSize: T.statLabel, color: 'var(--gs-mid)', opacity: 0.6, marginTop: '0.15em' }}>
        {label}
      </p>
    </div>
  );
}

function ToolPill({ name }: { name: string }) {
  return (
    <span
      className="font-data"
      style={{
        fontSize: T.pill,
        color: 'var(--gs-light)',
        padding: '0.15em 0.45em',
        borderRadius: '3px',
        background: PINK_BG,
        border: `1px solid ${PINK_BORDER}`,
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </span>
  );
}
