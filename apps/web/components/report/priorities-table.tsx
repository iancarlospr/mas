'use client';

import type { ModuleResult } from '@marketing-alpha/types';
import { ReportSection } from './report-section';
import { cn } from '@/lib/utils';

interface PrioritiesTableProps {
  m42Result: ModuleResult | undefined;
}

export function PrioritiesTable({ m42Result }: PrioritiesTableProps) {
  const synthesis = (m42Result?.data as Record<string, unknown> | undefined)?.['synthesis'] as Record<string, unknown> | undefined;
  const priorities = (synthesis?.['priorities'] as Array<Record<string, unknown>>) ?? [];

  if (priorities.length === 0) return null;

  return (
    <ReportSection title="Priority Action Items">
      <p className="text-sm text-muted mb-4">
        Ranked by expected impact and implementation effort.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-4 font-heading font-700 text-muted w-8">#</th>
              <th className="py-2 pr-4 font-heading font-700 text-muted">Action</th>
              <th className="py-2 pr-4 font-heading font-700 text-muted">Expected Impact</th>
              <th className="py-2 font-heading font-700 text-muted">Effort</th>
            </tr>
          </thead>
          <tbody>
            {priorities.map((p, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-3 pr-4 font-heading font-800 text-accent">{(p['rank'] as number) ?? i + 1}</td>
                <td className="py-3 pr-4 text-secondary font-medium">{p['action'] as string}</td>
                <td className="py-3 pr-4 text-muted text-xs">{p['expectedImpact'] as string}</td>
                <td className="py-3">
                  <span className={cn(
                    'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                    p['effort'] === 'low' ? 'bg-success/10 text-success' :
                    p['effort'] === 'medium' ? 'bg-warning/10 text-warning' :
                    'bg-error/10 text-error',
                  )}>
                    {p['effort'] as string}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportSection>
  );
}
