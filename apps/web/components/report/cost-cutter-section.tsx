'use client';

import type { ModuleResult } from '@marketing-alpha/types';
import { ReportSection } from './report-section';
import { cn } from '@/lib/utils';

interface CostCutterSectionProps {
  m45Result: ModuleResult | undefined;
}

export function CostCutterSection({ m45Result }: CostCutterSectionProps) {
  const data = m45Result?.data as Record<string, unknown> | undefined;
  const costAnalysis = data?.['costAnalysis'] as Record<string, unknown> | undefined;

  if (!costAnalysis) {
    // Fallback to old `costItems` format
    const costItems = (data?.['costItems'] as Array<Record<string, string>>) ?? [];
    if (costItems.length === 0) return null;

    return (
      <ReportSection title="Cost Optimization Opportunities">
        <div className="space-y-3">
          {costItems.map((item, i) => (
            <div key={i} className="border border-border rounded-lg p-4">
              <span className="text-sm font-medium text-primary">{item['tool']}</span>
              <p className="text-xs text-secondary mt-1">{item['issue']}</p>
              <p className="text-xs text-success font-medium mt-1">Est. savings: {item['estimatedSavings']}</p>
            </div>
          ))}
        </div>
      </ReportSection>
    );
  }

  const redundancies = (costAnalysis['redundancies'] as Array<Record<string, unknown>>) ?? [];
  const abandoned = (costAnalysis['abandoned_tools'] as Array<Record<string, unknown>>) ?? [];
  const alternatives = (costAnalysis['cheaper_alternatives'] as Array<Record<string, unknown>>) ?? [];
  const summary = (costAnalysis['stack_health_summary'] as Record<string, unknown>) ?? {};

  if (redundancies.length === 0 && abandoned.length === 0 && alternatives.length === 0) return null;

  return (
    <ReportSection title="Cost Optimization Opportunities">
      {/* Stack Health Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#FAFBFC] rounded-lg p-3 text-center">
          <div className="text-xs text-muted">Tools Detected</div>
          <div className="font-mono font-bold text-lg text-primary">{String(summary['total_tools_detected'] ?? 0)}</div>
        </div>
        <div className="bg-[#FAFBFC] rounded-lg p-3 text-center">
          <div className="text-xs text-muted">Redundant Pairs</div>
          <div className="font-mono font-bold text-lg text-warning">{String(summary['redundant_pairs'] ?? 0)}</div>
        </div>
        <div className="bg-[#FAFBFC] rounded-lg p-3 text-center">
          <div className="text-xs text-muted">Abandoned</div>
          <div className="font-mono font-bold text-lg text-error">{String(summary['inactive_or_abandoned'] ?? 0)}</div>
        </div>
        <div className="bg-[#FAFBFC] rounded-lg p-3 text-center">
          <div className="text-xs text-muted">Est. Annual Savings</div>
          <div className="font-mono font-bold text-lg text-success">{String(summary['estimated_annual_savings'] ?? 'N/A')}</div>
        </div>
      </div>

      {/* Redundancies */}
      {redundancies.length > 0 && (
        <div className="mb-6">
          <h3 className="font-heading text-sm font-700 text-primary mb-3">Redundant Tools</h3>
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
                    r['effort_to_consolidate'] === 'S' ? 'bg-success/10 text-success' :
                    r['effort_to_consolidate'] === 'M' ? 'bg-warning/10 text-warning' :
                    'bg-error/10 text-error',
                  )}>
                    {r['effort_to_consolidate'] as string} effort
                  </span>
                </div>
                <p className="text-xs text-secondary">{r['recommendation'] as string}</p>
                <p className="text-xs text-success font-medium mt-1">
                  Est. savings: {r['estimated_monthly_savings'] as string}/mo
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Abandoned Tools */}
      {abandoned.length > 0 && (
        <div className="mb-6">
          <h3 className="font-heading text-sm font-700 text-primary mb-3">Abandoned / Inactive Tools</h3>
          <div className="space-y-3">
            {abandoned.map((a, i) => (
              <div key={i} className="border border-border rounded-lg p-4">
                <span className="text-sm font-medium text-primary">{a['tool'] as string}</span>
                <p className="text-xs text-secondary mt-1">{a['evidence'] as string}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted">Est. cost: {a['estimated_monthly_cost'] as string}/mo</span>
                  <span className="text-xs text-success font-medium">{a['recommendation'] as string}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cheaper Alternatives */}
      {alternatives.length > 0 && (
        <div>
          <h3 className="font-heading text-sm font-700 text-primary mb-3">Cheaper Alternatives</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-heading font-700 text-muted text-xs">Current Tool</th>
                  <th className="py-2 pr-4 font-heading font-700 text-muted text-xs">Alternative</th>
                  <th className="py-2 pr-4 font-heading font-700 text-muted text-xs">Current Cost</th>
                  <th className="py-2 pr-4 font-heading font-700 text-muted text-xs">Alt. Cost</th>
                  <th className="py-2 font-heading font-700 text-muted text-xs">Savings</th>
                </tr>
              </thead>
              <tbody>
                {alternatives.map((alt, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-secondary">{alt['current_tool'] as string}</td>
                    <td className="py-2 pr-4 text-secondary font-medium">{alt['alternative'] as string}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-muted">{alt['current_estimated_cost'] as string}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-success">{alt['alternative_cost'] as string}</td>
                    <td className="py-2 font-mono text-xs text-success font-bold">{alt['savings'] as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ReportSection>
  );
}
