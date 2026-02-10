'use client';

import type { ModuleResult } from '@marketing-alpha/types';
import { ReportSection } from './report-section';
import { ScoreGauge } from '@/components/scan/score-gauge';

interface ExecutiveSummaryProps {
  m42Result: ModuleResult | undefined;
  marketingIq: number | null;
}

export function ExecutiveSummary({ m42Result, marketingIq }: ExecutiveSummaryProps) {
  const data = m42Result?.data as Record<string, unknown> | undefined;
  const synthesis = data?.['synthesis'] as Record<string, unknown> | undefined;

  // New M42 structure (AI-3 spec)
  const executiveBrief = (synthesis?.['executive_brief'] as string) ?? null;
  const criticalFindings = (synthesis?.['critical_findings'] as Array<Record<string, string>>) ?? [];
  const topOpportunities = (synthesis?.['top_opportunities'] as Array<Record<string, string>>) ?? [];
  const techStackSummary = (synthesis?.['tech_stack_summary'] as Record<string, string[]>) ?? {};
  const competitiveContext = (synthesis?.['competitive_context'] as string) ?? null;
  const iqValidation = (synthesis?.['marketing_iq_validation'] as Record<string, unknown>) ?? null;

  // Fallback to old field names if new ones not present
  const executiveSummary = executiveBrief ?? (synthesis?.['executiveSummary'] as string) ?? null;
  const score = (iqValidation?.['algorithmic_score'] as number) ?? marketingIq ?? 0;

  return (
    <ReportSection title="Executive Summary">
      <div className="flex items-start gap-6 mb-6">
        <div className="flex-shrink-0">
          <ScoreGauge score={Math.round(score)} size="md" animate={false} />
        </div>
        <div className="flex-1">
          {executiveSummary ? (
            <p className="text-sm text-secondary leading-relaxed">{executiveSummary}</p>
          ) : (
            <p className="text-sm text-muted">
              MarketingIQ Score: {Math.round(score)}/100. Full AI synthesis provides detailed analysis.
            </p>
          )}
          {iqValidation?.['ai_assessment'] != null && (
            <p className="text-xs text-muted mt-2 italic">
              {String(iqValidation['ai_assessment'])}
            </p>
          )}
        </div>
      </div>

      {/* Critical Findings */}
      {criticalFindings.length > 0 && (
        <div className="mb-4">
          <h3 className="font-heading text-sm font-700 text-error mb-2">Critical Findings</h3>
          <ul className="space-y-2">
            {criticalFindings.slice(0, 5).map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                <span className="text-error mt-0.5 flex-shrink-0 font-bold">!</span>
                <div>
                  <strong>{f['finding']}</strong>
                  {f['source_module'] && (
                    <span className="text-xs text-muted ml-1">[{f['source_module']}]</span>
                  )}
                  {f['business_impact'] && (
                    <p className="text-xs text-muted mt-0.5">{f['business_impact']}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top Opportunities */}
      {topOpportunities.length > 0 && (
        <div className="mb-4">
          <h3 className="font-heading text-sm font-700 text-success mb-2">Top Opportunities</h3>
          <ul className="space-y-2">
            {topOpportunities.slice(0, 5).map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                <span className="text-success mt-0.5 flex-shrink-0">+</span>
                <div>
                  <strong>{o['opportunity']}</strong>
                  {o['estimated_impact'] && (
                    <span className="text-xs text-success ml-1">{o['estimated_impact']}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tech Stack Summary */}
      {Object.keys(techStackSummary).length > 0 && (
        <div className="mb-4">
          <h3 className="font-heading text-sm font-700 text-primary mb-2">Technology Stack</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(techStackSummary).map(([category, tools]) => (
              <div key={category} className="text-xs">
                <span className="font-medium text-muted uppercase tracking-wide">{category}: </span>
                <span className="text-secondary">{Array.isArray(tools) ? tools.join(', ') : String(tools)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitive Context */}
      {competitiveContext && (
        <div className="mt-4 pt-4 border-t border-border">
          <h3 className="font-heading text-sm font-700 text-primary mb-2">Competitive Context</h3>
          <p className="text-xs text-secondary leading-relaxed">{competitiveContext}</p>
        </div>
      )}
    </ReportSection>
  );
}
