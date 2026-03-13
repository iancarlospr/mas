'use client';

import type { ModuleResult } from '@marketing-alpha/types';
import { ReportSection } from './report-section';
import { cn } from '@/lib/utils';

interface CostCutterSectionProps {
  m45Result: ModuleResult | undefined;
}

export function CostCutterSection({ m45Result }: CostCutterSectionProps) {
  const data = m45Result?.data as Record<string, unknown> | undefined;
  const analysis = data?.['stackAnalysis'] as Record<string, unknown> | undefined;

  if (!analysis) return null;

  const currentStack = (analysis['currentStack'] as Record<string, unknown>) ?? {};
  const categories = (currentStack['categories'] as Array<{ name: string; tools: string[] }>) ?? [];
  const assessment = (currentStack['assessment'] as string) ?? '';
  const totalTools = (currentStack['totalTools'] as number) ?? 0;
  const activeTools = (currentStack['activeTools'] as number) ?? 0;
  const abandonedCount = (currentStack['abandonedTools'] as number) ?? 0;
  const redundantPairs = (currentStack['redundantPairs'] as number) ?? 0;

  const abandonedTools = (analysis['abandonedTools'] as Array<Record<string, unknown>>) ?? [];
  const redundancies = (analysis['redundancies'] as Array<Record<string, unknown>>) ?? [];
  const leanStack = (analysis['leanStack'] as Record<string, unknown>) ?? {};
  const optimalStack = (analysis['optimalStack'] as Record<string, unknown>) ?? {};
  const methodology = (analysis['methodology'] as string) ?? '';

  const leanRemovals = (leanStack['removals'] as Array<{ tool: string; reason: string }>) ?? [];
  const leanTools = (leanStack['tools'] as Array<Record<string, unknown>>) ?? [];
  const optimalGaps = (optimalStack['gaps'] as Array<Record<string, unknown>>) ?? [];
  const optimalUpgrades = (optimalStack['upgrades'] as Array<Record<string, unknown>>) ?? [];

  if (categories.length === 0 && redundancies.length === 0 && abandonedTools.length === 0) return null;

  return (
    <ReportSection title="Stack Analysis">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#FAFBFC] rounded-lg p-3 text-center">
          <div className="text-xs text-muted">Tools Detected</div>
          <div className="font-mono font-bold text-lg text-primary">{totalTools}</div>
        </div>
        <div className="bg-[#FAFBFC] rounded-lg p-3 text-center">
          <div className="text-xs text-muted">Active</div>
          <div className="font-mono font-bold text-lg text-success">{activeTools}</div>
        </div>
        <div className="bg-[#FAFBFC] rounded-lg p-3 text-center">
          <div className="text-xs text-muted">Redundant Pairs</div>
          <div className="font-mono font-bold text-lg text-warning">{redundantPairs}</div>
        </div>
        <div className="bg-[#FAFBFC] rounded-lg p-3 text-center">
          <div className="text-xs text-muted">Abandoned</div>
          <div className="font-mono font-bold text-lg text-error">{abandonedCount}</div>
        </div>
      </div>

      {/* Assessment */}
      {assessment && (
        <p className="text-sm text-primary/80 mb-6">{assessment}</p>
      )}

      {/* Current stack by category */}
      {categories.length > 0 && (
        <div className="mb-6">
          <h3 className="font-heading text-sm font-700 text-primary mb-3">Current Stack</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {categories.map((cat, i) => (
              <div key={i} className="bg-[#FAFBFC] rounded-lg p-3 border border-[#E2E8F0]">
                <p className="text-xs font-heading font-600 text-muted uppercase tracking-wide mb-1">{cat.name}</p>
                <p className="text-xs text-primary/80">{cat.tools.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Abandoned tools */}
      {abandonedTools.length > 0 && (
        <div className="mb-6">
          <h3 className="font-heading text-sm font-700 text-error mb-3">Abandoned Tools</h3>
          <div className="space-y-3">
            {abandonedTools.map((a, i) => (
              <div key={i} className="border border-border rounded-lg p-4">
                <span className="text-sm font-medium text-primary">{a['tool'] as string}</span>
                <span className="text-xs text-muted ml-2">({a['sourceModule'] as string})</span>
                <p className="text-xs text-secondary mt-1">{a['evidence'] as string}</p>
                <p className="text-xs text-success font-medium mt-1">{a['recommendation'] as string}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Redundancies */}
      {redundancies.length > 0 && (
        <div className="mb-6">
          <h3 className="font-heading text-sm font-700 text-warning mb-3">Redundant Tools</h3>
          <div className="space-y-3">
            {redundancies.map((r, i) => (
              <div key={i} className="border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <span className="text-sm font-medium text-primary">
                      {(r['tools'] as string[])?.join(' + ')}
                    </span>
                    <span className="text-xs text-muted ml-2">{r['function'] as string}</span>
                  </div>
                  <span className={cn(
                    'inline-flex px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                    r['effortToConsolidate'] === 'S' ? 'bg-success/10 text-success' :
                    r['effortToConsolidate'] === 'M' ? 'bg-warning/10 text-warning' :
                    'bg-error/10 text-error',
                  )}>
                    {r['effortToConsolidate'] as string} effort
                  </span>
                </div>
                <p className="text-xs text-secondary">{r['recommendation'] as string}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lean Stack */}
      {(leanRemovals.length > 0 || leanTools.length > 0) && (
        <div className="mb-6 border-l-4 border-success bg-success/5 rounded-r-lg p-4">
          <h3 className="font-heading text-sm font-700 text-success mb-2">Lean Stack</h3>
          {leanStack['description'] != null && (
            <p className="text-xs text-primary/80 mb-3">{String(leanStack['description'])}</p>
          )}
          {leanRemovals.length > 0 && (
            <div className="space-y-1 mb-3">
              <p className="text-xs font-heading font-600 text-muted uppercase tracking-wide">Remove</p>
              {leanRemovals.map((r, i) => (
                <p key={i} className="text-xs text-primary/80">
                  <span className="font-mono text-error mr-1">-</span>
                  <span className="font-medium">{r.tool}</span>
                  <span className="text-muted ml-1">— {r.reason}</span>
                </p>
              ))}
            </div>
          )}
          {leanStack['keyBenefit'] != null && (
            <p className="text-xs text-success font-medium">{String(leanStack['keyBenefit'])}</p>
          )}
          <p className="text-xs text-muted mt-2">
            Result: {leanStack['totalToolsAfter'] as number} tools (from {totalTools})
          </p>
        </div>
      )}

      {/* Optimal Stack */}
      {(optimalGaps.length > 0 || optimalUpgrades.length > 0) && (
        <div className="mb-6 border-l-4 border-[#0F3460] bg-[#0F3460]/5 rounded-r-lg p-4">
          <h3 className="font-heading text-sm font-700 text-[#0F3460] mb-2">Optimal Stack</h3>
          {optimalStack['description'] != null && (
            <p className="text-xs text-primary/80 mb-3">{String(optimalStack['description'])}</p>
          )}
          {optimalGaps.length > 0 && (
            <div className="space-y-1 mb-3">
              <p className="text-xs font-heading font-600 text-muted uppercase tracking-wide">Gaps to Fill</p>
              {optimalGaps.map((g, i) => (
                <p key={i} className="text-xs text-primary/80">
                  <span className="font-mono text-success mr-1">+</span>
                  <span className="font-medium">{g['capability'] as string}</span>
                  <span className="text-muted ml-1">— {g['recommendation'] as string}</span>
                </p>
              ))}
            </div>
          )}
          {optimalUpgrades.length > 0 && (
            <div className="space-y-1 mb-3">
              <p className="text-xs font-heading font-600 text-muted uppercase tracking-wide">Upgrades</p>
              {optimalUpgrades.map((u, i) => (
                <p key={i} className="text-xs text-primary/80">
                  <span className="font-medium">{u['currentTool'] as string}</span>
                  <span className="text-muted mx-1">&rarr;</span>
                  <span className="font-medium">{u['suggestedTool'] as string}</span>
                </p>
              ))}
            </div>
          )}
          {optimalStack['keyBenefit'] != null && (
            <p className="text-xs text-[#0F3460] font-medium">{String(optimalStack['keyBenefit'])}</p>
          )}
          <p className="text-xs text-muted mt-2">
            Result: {optimalStack['totalToolsAfter'] as number} tools
          </p>
        </div>
      )}

      {/* Methodology */}
      {methodology && (
        <p className="text-xs italic text-muted">{methodology}</p>
      )}
    </ReportSection>
  );
}
