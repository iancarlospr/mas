'use client';

import type { ModuleResult } from '@marketing-alpha/types';
import { ReportSection } from './report-section';
import { ROIImpactBar } from '@/components/charts/roi-impact-bar';
import { formatters } from '@/lib/chart-config';

interface ROISectionProps {
  m44Result: ModuleResult | undefined;
}

export function ROISection({ m44Result }: ROISectionProps) {
  const data = m44Result?.data as Record<string, unknown> | undefined;
  const roi = data?.['roi'] as Record<string, unknown> | undefined;

  if (!roi) return null;

  // Build chart data from the new M44 structure (AI-5)
  const chartData: Array<{ category: string; wastedSpend: number; missedRevenue: number; inefficiencyCost: number }> = [];

  const trackingGap = roi['tracking_gap_cost'] as Record<string, unknown> | undefined;
  const attributionWaste = roi['attribution_waste'] as Record<string, unknown> | undefined;
  const perfImpact = roi['performance_impact'] as Record<string, unknown> | undefined;
  const complianceRisk = roi['compliance_risk'] as Record<string, unknown> | undefined;
  const toolRedundancy = roi['tool_redundancy_waste'] as Record<string, unknown> | undefined;
  const summary = roi['summary'] as Record<string, unknown> | undefined;

  if (trackingGap) {
    chartData.push({
      category: 'Tracking Gaps',
      wastedSpend: parseAmount(trackingGap['monthly_untracked_revenue']),
      missedRevenue: parseAmount(trackingGap['annual_impact']),
      inefficiencyCost: 0,
    });
  }

  if (attributionWaste) {
    chartData.push({
      category: 'Attribution',
      wastedSpend: parseAmount(attributionWaste['wasted_monthly_spend']),
      missedRevenue: 0,
      inefficiencyCost: parseAmount(attributionWaste['optimization_opportunity']),
    });
  }

  if (perfImpact) {
    chartData.push({
      category: 'Performance',
      wastedSpend: 0,
      missedRevenue: parseAmount(perfImpact['estimated_monthly_revenue_loss']),
      inefficiencyCost: 0,
    });
  }

  if (complianceRisk) {
    chartData.push({
      category: 'Compliance',
      wastedSpend: 0,
      missedRevenue: 0,
      inefficiencyCost: parseAmount(complianceRisk['estimated_exposure']),
    });
  }

  if (toolRedundancy) {
    chartData.push({
      category: 'Tool Redundancy',
      wastedSpend: parseAmount(toolRedundancy['monthly_waste']),
      missedRevenue: 0,
      inefficiencyCost: 0,
    });
  }

  // Fallback: try old `scenarios` format
  if (chartData.length === 0) {
    const scenarios = (data?.['scenarios'] as Array<Record<string, unknown>>) ?? [];
    for (const s of scenarios) {
      chartData.push({
        category: (s['name'] as string) ?? 'Unknown',
        wastedSpend: parseAmount(s['annualImpact']),
        missedRevenue: 0,
        inefficiencyCost: 0,
      });
    }
  }

  if (chartData.length === 0) return null;

  return (
    <ReportSection title="ROI Impact Analysis">
      <p className="text-sm text-muted mb-4">
        Estimated return on investment for implementing recommended improvements.
      </p>
      <ROIImpactBar data={chartData} height={280} />
      {summary && (
        <div className="mt-4 p-4 bg-[#FAFBFC] rounded-lg">
          <h4 className="font-heading text-sm font-700 text-primary mb-2">Summary</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {summary['total_monthly_impact'] != null && (
              <div>
                <span className="text-muted">Monthly Impact:</span>
                <div className="font-mono font-bold text-error text-sm">{String(summary['total_monthly_impact'])}</div>
              </div>
            )}
            {summary['total_annual_impact'] != null && (
              <div>
                <span className="text-muted">Annual Impact:</span>
                <div className="font-mono font-bold text-error text-sm">{String(summary['total_annual_impact'])}</div>
              </div>
            )}
            {summary['confidence_level'] != null && (
              <div>
                <span className="text-muted">Confidence:</span>
                <div className="font-mono font-bold text-primary text-sm">{String(summary['confidence_level'])}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </ReportSection>
  );
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
  return 0;
}
