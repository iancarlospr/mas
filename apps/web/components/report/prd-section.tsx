'use client';

import type { ModuleResult } from '@marketing-alpha/types';
import { ReportSection } from './report-section';
import { cn } from '@/lib/utils';

interface PRDSectionProps {
  m43Result: ModuleResult | undefined;
}

export function PRDSection({ m43Result }: PRDSectionProps) {
  const data = m43Result?.data as Record<string, unknown> | undefined;
  const prdData = data?.['prd'] as Record<string, unknown> | undefined;

  // New structured format (AI-4)
  if (prdData && typeof prdData === 'object' && 'workstreams' in prdData) {
    return <StructuredPRD prdData={prdData} />;
  }

  // Fallback: old markdown text format
  const prd = (data?.['prd'] as string) ?? null;
  if (!prd || typeof prd !== 'string') return null;

  return (
    <ReportSection title="Recommendations Document">
      <div className="prose prose-sm max-w-none text-secondary">
        {prd.split('\n').map((line, i) => {
          if (line.startsWith('# ')) return <h3 key={i} className="font-heading text-h4 text-primary mt-6 mb-2">{line.slice(2)}</h3>;
          if (line.startsWith('## ')) return <h4 key={i} className="font-heading text-sm font-700 text-primary mt-4 mb-2">{line.slice(3)}</h4>;
          if (line.startsWith('### ')) return <h5 key={i} className="font-heading text-xs font-700 text-primary mt-3 mb-1">{line.slice(4)}</h5>;
          if (line.startsWith('- ')) return <li key={i} className="text-sm text-secondary ml-4 list-disc">{line.slice(2)}</li>;
          if (line.trim() === '') return <div key={i} className="h-2" />;
          return <p key={i} className="text-sm text-secondary leading-relaxed">{line}</p>;
        })}
      </div>
    </ReportSection>
  );
}

function StructuredPRD({ prdData }: { prdData: Record<string, unknown> }) {
  const workstreams = (prdData['workstreams'] as Array<Record<string, unknown>>) ?? [];
  const timeline = (prdData['implementation_timeline'] as Record<string, unknown>) ?? {};
  const risks = (prdData['risk_register'] as Array<Record<string, unknown>>) ?? [];
  const outcomes = (prdData['expected_outcomes'] as Record<string, unknown>) ?? {};

  return (
    <ReportSection title="Remediation Roadmap">
      {/* Workstreams */}
      {workstreams.map((ws, i) => (
        <div key={i} className="mb-6 last:mb-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-mono text-muted bg-[#F1F5F9] px-2 py-0.5 rounded">
              {ws['id'] as string}
            </span>
            <h3 className="font-heading text-sm font-700 text-primary">
              {ws['name'] as string}
            </h3>
            {ws['priority'] != null && (
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                ws['priority'] === 'P0' ? 'bg-error/10 text-error' :
                ws['priority'] === 'P1' ? 'bg-warning/10 text-warning' :
                'bg-muted/10 text-muted',
              )}>
                {ws['priority'] as string}
              </span>
            )}
          </div>
          {ws['objective'] != null && (
            <p className="text-xs text-secondary mb-3">{ws['objective'] as string}</p>
          )}

          {/* Tasks */}
          {(ws['tasks'] as Array<Record<string, unknown>> | undefined)?.map((task, j) => (
            <div key={j} className="ml-4 mb-2 pl-3 border-l-2 border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted">{task['id'] as string}</span>
                <span className="text-xs font-medium text-secondary">{task['action'] as string}</span>
                {task['effort'] != null && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium',
                    task['effort'] === 'S' ? 'bg-success/10 text-success' :
                    task['effort'] === 'M' ? 'bg-warning/10 text-warning' :
                    task['effort'] === 'L' ? 'bg-error/10 text-error' :
                    'bg-error/10 text-error',
                  )}>
                    {task['effort'] as string}
                  </span>
                )}
              </div>
              {task['success_criteria'] != null && (
                <p className="text-[10px] text-muted mt-0.5 ml-6">
                  Success: {task['success_criteria'] as string}
                </p>
              )}
              {(task['dependencies'] as string[] | undefined)?.length && (
                <p className="text-[10px] text-muted mt-0.5 ml-6">
                  Depends on: {(task['dependencies'] as string[]).join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Timeline */}
      {Object.keys(timeline).length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <h3 className="font-heading text-sm font-700 text-primary mb-3">Implementation Timeline</h3>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {timeline['phase_1'] != null && (
              <div className="bg-success/5 rounded-lg p-3">
                <div className="font-medium text-success mb-1">Phase 1 (Weeks 1-4)</div>
                <p className="text-secondary">{String(timeline['phase_1'])}</p>
              </div>
            )}
            {timeline['phase_2'] != null && (
              <div className="bg-warning/5 rounded-lg p-3">
                <div className="font-medium text-warning mb-1">Phase 2 (Weeks 5-8)</div>
                <p className="text-secondary">{String(timeline['phase_2'])}</p>
              </div>
            )}
            {timeline['phase_3'] != null && (
              <div className="bg-accent/5 rounded-lg p-3">
                <div className="font-medium text-accent mb-1">Phase 3 (Weeks 9-12)</div>
                <p className="text-secondary">{String(timeline['phase_3'])}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Risk Register */}
      {risks.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <h3 className="font-heading text-sm font-700 text-primary mb-3">Risk Register</h3>
          <div className="space-y-2">
            {risks.map((risk, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={cn(
                  'inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 mt-0.5',
                  risk['severity'] === 'high' ? 'bg-error/10 text-error' :
                  risk['severity'] === 'medium' ? 'bg-warning/10 text-warning' :
                  'bg-muted/10 text-muted',
                )}>
                  {risk['severity'] as string}
                </span>
                <div>
                  <span className="text-secondary font-medium">{risk['risk'] as string}</span>
                  {risk['mitigation'] != null && (
                    <span className="text-muted ml-1">— {risk['mitigation'] as string}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ReportSection>
  );
}
