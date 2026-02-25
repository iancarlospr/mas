'use client';

import { useState } from 'react';
import type { ModuleResult } from '@marketing-alpha/types';
import { UnlockOverlay } from './unlock-overlay';

interface PaidSlidesProps {
  scanId: string;
  isPaid: boolean;
  resultMap: Map<string, ModuleResult>;
}

const SYNTHESIS_SLIDES = [
  { moduleId: 'M42', label: 'Executive Brief', icon: '📋' },
  { moduleId: 'M44', label: 'Impact Scenarios', icon: '💰' },
  { moduleId: 'M43', label: 'Remediation Roadmap', icon: '🗺️' },
  { moduleId: 'M45', label: 'Stack Analyzer', icon: '✂️' },
] as const;

export function PaidSlides({ scanId, isPaid, resultMap }: PaidSlidesProps) {
  return (
    <>
      {SYNTHESIS_SLIDES.map(({ moduleId, label, icon }) => {
        const result = resultMap.get(moduleId);
        return (
          <div
            key={moduleId}
            id={`slide-${moduleId}`}
            className="module-panel relative w-full overflow-hidden"
          >
            {/* Header bar */}
            <div className="module-panel-header">
              <span className="font-data text-data-xs text-gs-muted">{moduleId}</span>
              <span className="flex-1 truncate">{label}</span>
              {!isPaid && (
                <span className="font-system text-os-xs text-gs-red">🔒 Paid</span>
              )}
            </div>

            {/* Content */}
            <div className="p-6 h-[calc(100%-48px)] overflow-hidden">
              {isPaid && result ? (
                <SynthesisContent moduleId={moduleId} result={result} />
              ) : (
                <LockedPlaceholder icon={icon} label={label} />
              )}
            </div>

            {/* Unlock overlay for free tier */}
            {!isPaid && <UnlockOverlay scanId={scanId} />}
          </div>
        );
      })}
    </>
  );
}

function SynthesisContent({ moduleId, result }: { moduleId: string; result: ModuleResult }) {
  const data = result.data as Record<string, unknown>;

  if (moduleId === 'M42') return <ExecutiveBriefContent data={data} />;
  if (moduleId === 'M44') return <ROIContent data={data} />;
  if (moduleId === 'M43') return <RoadmapContent data={data} />;
  if (moduleId === 'M45') return <StackAnalyzerContent data={data} />;
  return null;
}

function ExecutiveBriefContent({ data }: { data: Record<string, unknown> }) {
  const summary = (data.executiveSummary as string) ?? '';
  const findings = (data.keyFindings as Array<{ finding: string; severity: string }>) ?? [];

  return (
    <div className="space-y-4 h-full overflow-y-auto">
      {summary && (
        <div>
          <h4 className="text-xs font-system font-bold text-gs-muted uppercase tracking-wide mb-2">
            Executive Summary
          </h4>
          <p className="text-sm text-gs-ink/80 leading-relaxed">{summary}</p>
        </div>
      )}
      {findings.length > 0 && (
        <div>
          <h4 className="text-xs font-system font-bold text-gs-muted uppercase tracking-wide mb-2">
            Key Findings
          </h4>
          <div className="space-y-2">
            {findings.slice(0, 6).map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <SeverityDot severity={f.severity} />
                <span className="text-gs-ink/80">{f.finding}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ROIContent({ data }: { data: Record<string, unknown> }) {
  const roi = data['roi'] as Record<string, unknown> | undefined;
  const scenarios = (roi?.['scenarios'] as Array<Record<string, unknown>>) ?? [];
  const methodology = (roi?.['methodology'] as string) ?? '';
  const [activeId, setActiveId] = useState<string>('moderate');

  const active = scenarios.find(s => s['id'] === activeId) ?? scenarios[1] ?? scenarios[0];

  if (!active) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gs-muted">
        Impact scenario data unavailable.
      </div>
    );
  }

  const impactAreas = (active['impactAreas'] as Array<Record<string, unknown>>) ?? [];
  const totalMonthly = (active['totalMonthlyImpact'] as number) ?? 0;
  const totalAnnual = (active['totalAnnualImpact'] as number) ?? 0;
  const keyAssumptions = (active['keyAssumptions'] as string[]) ?? [];
  const description = (active['description'] as string) ?? '';

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const CONFIDENCE_COLORS: Record<string, string> = {
    high: 'text-gs-terminal',
    medium: 'text-gs-warning',
    low: 'text-gs-muted',
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Scenario tabs */}
      <div className="flex items-center gap-2 mb-3">
        {scenarios.map((s) => {
          const id = s['id'] as string;
          const label = (s['label'] as string) ?? id;
          const isActive = id === activeId;
          return (
            <button
              key={id}
              onClick={() => setActiveId(id)}
              className={`px-3 py-1 bevel-button text-xs font-system font-semibold transition-colors ${
                isActive
                  ? 'bg-gs-red/10 text-gs-red'
                  : 'bg-gs-paper text-gs-muted hover:bg-gs-chrome'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Scenario description */}
      {description && (
        <p className="text-[11px] text-gs-muted italic mb-3">{description}</p>
      )}

      {/* Impact area cards */}
      {impactAreas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {impactAreas.map((a, i) => {
            const impact = (a['monthlyImpact'] as number) ?? 0;
            const confidence = (a['confidence'] as string) ?? 'low';
            return (
              <div key={i} className="bg-gs-paper bevel-sunken p-2.5 text-center">
                <p className="text-[10px] font-system font-semibold text-gs-ink truncate">
                  {(a['title'] as string) ?? ''}
                </p>
                <p className="text-sm font-data font-bold text-gs-ink mt-0.5">
                  {impact > 0 ? fmt(impact) : 'N/A'}
                </p>
                <p className="text-[10px] text-gs-muted">/mo</p>
                <p className={`text-[9px] font-medium mt-0.5 ${CONFIDENCE_COLORS[confidence] ?? 'text-gs-muted'}`}>
                  {confidence} confidence
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Hero totals */}
      <div className="text-center py-2 border-t border-gs-chrome-dark/30">
        <div className="flex items-center justify-center gap-6">
          <div>
            <p className="text-[10px] font-system font-semibold text-gs-muted uppercase tracking-wide">Monthly</p>
            <p className="text-lg font-data font-bold text-gs-ink">{fmt(totalMonthly)}</p>
          </div>
          <div>
            <p className="text-[10px] font-system font-semibold text-gs-muted uppercase tracking-wide">Annual</p>
            <p className="text-lg font-data font-bold text-gs-terminal">{fmt(totalAnnual)}</p>
          </div>
        </div>
      </div>

      {/* Assumptions */}
      {keyAssumptions.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gs-chrome-dark/30">
          <p className="text-[10px] font-system font-semibold text-gs-muted uppercase tracking-wide mb-1">
            Key Assumptions
          </p>
          <ul className="space-y-0.5">
            {keyAssumptions.slice(0, 4).map((a, i) => (
              <li key={i} className="text-[10px] text-gs-muted leading-tight">
                &middot; {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Methodology disclaimer */}
      {methodology && (
        <p className="mt-auto pt-2 text-[9px] text-gs-muted/60 italic leading-tight">
          {methodology}
        </p>
      )}
    </div>
  );
}

function RoadmapContent({ data }: { data: Record<string, unknown> }) {
  const metadata = data['metadata'] as Record<string, unknown> | undefined;
  const p0 = (metadata?.['p0Count'] as number | undefined) ?? 0;
  const p1 = (metadata?.['p1Count'] as number | undefined) ?? 0;
  const p2 = (metadata?.['p2Count'] as number | undefined) ?? 0;
  const p3 = (metadata?.['p3Count'] as number | undefined) ?? 0;
  const total = (metadata?.['totalFindings'] as number | undefined) ?? (p0 + p1 + p2 + p3);
  const weeks = (metadata?.['estimatedTimelineWeeks'] as number | undefined) ?? 0;

  // Extract scan ID from the nearest context for download link
  // The parent component passes the scan ID through the URL

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4 py-6">
      <h4 className="text-xs font-system font-bold text-gs-muted uppercase tracking-wide">
        Remediation Plan
      </h4>

      <div className="text-center space-y-2">
        <p className="text-2xl font-system font-bold text-gs-ink">
          {total} Findings
        </p>
        <div className="flex items-center justify-center gap-3 text-xs font-data">
          {p0 > 0 && (
            <span className="bg-gs-critical/10 text-gs-critical px-2 py-0.5 bevel-raised">
              {p0} P0
            </span>
          )}
          {p1 > 0 && (
            <span className="bg-gs-warning/10 text-gs-warning px-2 py-0.5 bevel-raised">
              {p1} P1
            </span>
          )}
          {p2 > 0 && (
            <span className="bg-gs-warning/10 text-gs-warning px-2 py-0.5 bevel-raised">
              {p2} P2
            </span>
          )}
          {p3 > 0 && (
            <span className="bg-gs-chrome text-gs-muted px-2 py-0.5 bevel-raised">
              {p3} P3
            </span>
          )}
        </div>
        {weeks > 0 && (
          <p className="text-xs text-gs-muted">
            Estimated timeline: ~{weeks} weeks
          </p>
        )}
      </div>

      <p className="text-xs text-gs-muted text-center max-w-xs">
        A detailed, step-by-step remediation document with implementation
        instructions, verification checklists, and timeline.
      </p>

      <p className="text-xs text-gs-muted italic">
        Available as a downloadable PDF in the report section.
      </p>
    </div>
  );
}

function StackAnalyzerContent({ data }: { data: Record<string, unknown> }) {
  const analysis = data['stackAnalysis'] as Record<string, unknown> | undefined;
  const [activeTab, setActiveTab] = useState<'current' | 'lean' | 'optimal'>('current');

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gs-muted">
        Stack analysis data unavailable.
      </div>
    );
  }

  const currentStack = (analysis['currentStack'] as Record<string, unknown>) ?? {};
  const categories = (currentStack['categories'] as Array<{ name: string; tools: string[] }>) ?? [];
  const assessment = (currentStack['assessment'] as string) ?? '';
  const totalTools = (currentStack['totalTools'] as number) ?? 0;
  const redundantPairs = (currentStack['redundantPairs'] as number) ?? 0;
  const abandonedCount = (currentStack['abandonedTools'] as number) ?? 0;

  const leanStack = (analysis['leanStack'] as Record<string, unknown>) ?? {};
  const leanToolsAfter = (leanStack['totalToolsAfter'] as number) ?? 0;
  const leanBenefit = (leanStack['keyBenefit'] as string) ?? '';
  const leanRemovals = (leanStack['removals'] as Array<{ tool: string; reason: string }>) ?? [];

  const optimalStack = (analysis['optimalStack'] as Record<string, unknown>) ?? {};
  const optimalToolsAfter = (optimalStack['totalToolsAfter'] as number) ?? 0;
  const optimalBenefit = (optimalStack['keyBenefit'] as string) ?? '';
  const optimalGaps = (optimalStack['gaps'] as Array<{ capability: string; recommendation: string }>) ?? [];
  const optimalUpgrades = (optimalStack['upgrades'] as Array<{ currentTool: string; suggestedTool: string }>) ?? [];

  const EFFORT_COLORS: Record<string, string> = { S: 'text-gs-terminal', M: 'text-gs-warning', L: 'text-gs-critical' };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Summary chips */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="px-2 py-0.5 bg-gs-paper bevel-raised text-[10px] font-data font-semibold text-gs-ink">
          {totalTools} tools
        </span>
        {redundantPairs > 0 && (
          <span className="px-2 py-0.5 bg-gs-warning/10 bevel-raised text-[10px] font-data font-semibold text-gs-warning">
            {redundantPairs} redundant
          </span>
        )}
        {abandonedCount > 0 && (
          <span className="px-2 py-0.5 bg-gs-critical/10 bevel-raised text-[10px] font-data font-semibold text-gs-critical">
            {abandonedCount} abandoned
          </span>
        )}
      </div>

      {/* Assessment */}
      {assessment && (
        <p className="text-[11px] text-gs-muted italic mb-3">{assessment}</p>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-3">
        {([
          { id: 'current' as const, label: `Current (${totalTools})` },
          { id: 'lean' as const, label: `Lean (${leanToolsAfter})` },
          { id: 'optimal' as const, label: `Optimal (${optimalToolsAfter})` },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 bevel-button text-xs font-system font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-gs-red/10 text-gs-red'
                : 'bg-gs-paper text-gs-muted hover:bg-gs-chrome'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'current' && (
          <div className="space-y-2">
            {categories.map((cat, i) => (
              <div key={i}>
                <p className="text-[10px] font-system font-semibold text-gs-muted uppercase tracking-wide">
                  {cat.name}
                </p>
                <p className="text-xs text-gs-ink/80">{cat.tools.join(', ')}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'lean' && (
          <div className="space-y-2">
            {leanBenefit && (
              <p className="text-[11px] text-gs-terminal font-medium">{leanBenefit}</p>
            )}
            {leanRemovals.length > 0 && (
              <>
                <p className="text-[10px] font-system font-semibold text-gs-muted uppercase tracking-wide">Remove</p>
                {leanRemovals.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="text-gs-critical font-data">-</span>
                    <span className="text-gs-ink/80">
                      <span className="font-semibold">{r.tool}</span>
                      <span className="text-gs-muted ml-1">— {r.reason}</span>
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'optimal' && (
          <div className="space-y-2">
            {optimalBenefit && (
              <p className="text-[11px] text-gs-red font-medium">{optimalBenefit}</p>
            )}
            {optimalGaps.length > 0 && (
              <>
                <p className="text-[10px] font-system font-semibold text-gs-muted uppercase tracking-wide">Gaps to Fill</p>
                {optimalGaps.map((g, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="text-gs-terminal font-data">+</span>
                    <span className="text-gs-ink/80">
                      <span className="font-semibold">{g.capability}</span>
                      <span className="text-gs-muted ml-1">— {g.recommendation}</span>
                    </span>
                  </div>
                ))}
              </>
            )}
            {optimalUpgrades.length > 0 && (
              <>
                <p className="text-[10px] font-system font-semibold text-gs-muted uppercase tracking-wide mt-2">Upgrades</p>
                {optimalUpgrades.map((u, i) => (
                  <div key={i} className="text-[11px] text-gs-ink/80">
                    <span className="font-semibold">{u.currentTool}</span>
                    <span className="text-gs-muted mx-1">&rarr;</span>
                    <span className="font-semibold">{u.suggestedTool}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LockedPlaceholder({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-40">
      <span className="text-5xl">{icon}</span>
      <p className="text-sm font-system font-semibold text-gs-ink">{label}</p>
      <p className="text-xs text-gs-muted">Available in the paid report</p>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const color =
    severity === 'critical' ? 'bg-gs-critical' :
    severity === 'warning' ? 'bg-gs-warning' :
    severity === 'positive' ? 'bg-gs-terminal' : 'bg-gs-muted';
  return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${color}`} />;
}
