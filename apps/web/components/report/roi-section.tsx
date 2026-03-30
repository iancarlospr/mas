'use client';

import type { ModuleResult } from '@marketing-alpha/types';
import { ReportSection } from './report-section';
import { ROIImpactBar } from '@/components/charts/roi-impact-bar';

interface ROISectionProps {
  m44Result: ModuleResult | undefined;
}

export function ROISection({ m44Result }: ROISectionProps) {
  const data = m44Result?.data as Record<string, unknown> | undefined;
  const roi = data?.['roi'] as Record<string, unknown> | undefined;

  if (!roi) return null;

  const scenarios = (roi['scenarios'] as Array<Record<string, unknown>>) ?? [];
  const methodology = (roi['methodology'] as string) ?? '';
  const headline = (roi['headline'] as string) ?? '';

  if (scenarios.length === 0) return null;

  // Build chart data from moderate scenario (or first available)
  const moderate = scenarios.find(s => s['id'] === 'moderate') ?? scenarios[1] ?? scenarios[0];
  if (!moderate) return null;

  const impactAreas = (moderate['impactAreas'] as Array<Record<string, unknown>>) ?? [];

  const chartData = impactAreas
    .filter(a => ((a['monthlyImpact'] as number) ?? 0) > 0)
    .map(a => ({
      category: (a['title'] as string) ?? '',
      wastedSpend: (a['monthlyImpact'] as number) ?? 0,
      missedRevenue: 0,
      inefficiencyCost: 0,
    }));

  if (chartData.length === 0) return null;

  // Build summary row from all 3 scenarios
  const conservative = scenarios.find(s => s['id'] === 'conservative');
  const aggressive = scenarios.find(s => s['id'] === 'aggressive');

  return (
    <ReportSection title="Impact Scenarios">
      {headline && (
        <p className="text-sm text-primary/80 mb-4">{headline}</p>
      )}

      <ROIImpactBar data={chartData} height={280} />

      {/* Scenario comparison */}
      {scenarios.length > 1 && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[conservative, moderate, aggressive].map(s => {
            if (!s) return null;
            const total = (s['totalMonthlyImpact'] as number) ?? 0;
            return (
              <div
                key={s['id'] as string}
                className="bg-[#FAFBFC] rounded-lg p-3 border border-[#E2E8F0] text-center"
              >
                <p className="text-xs font-heading font-600 text-muted uppercase tracking-wide">
                  {(s['label'] as string) ?? (s['id'] as string)}
                </p>
                <p className="font-mono font-bold text-primary text-lg mt-1">
                  {formatDollar(total)}
                  <span className="text-xs font-normal text-muted">/mo</span>
                </p>
              </div>
            );
          })}
        </div>
      )}

      {methodology && (
        <p className="mt-4 text-xs text-muted italic">{methodology}</p>
      )}
    </ReportSection>
  );
}

function formatDollar(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}
