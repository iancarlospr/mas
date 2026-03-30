'use client';

import type { ModuleResult, CategoryScore } from '@marketing-alpha/types';
import { ExecutiveSummary } from './executive-summary';
import { CategoryDeepDive } from './category-deep-dive';
import { PrioritiesTable } from './priorities-table';
import { ROISection } from './roi-section';
import { CostCutterSection } from './cost-cutter-section';
import { PRDSection } from './prd-section';

interface ReportBodyProps {
  moduleResults: ModuleResult[];
  categories: CategoryScore[];
  marketingIq: number | null;
}

export function ReportBody({ moduleResults, categories, marketingIq }: ReportBodyProps) {
  const resultMap = new Map(moduleResults.map(r => [r.moduleId, r]));

  const m42 = resultMap.get('M42');
  const m43 = resultMap.get('M43');
  const m44 = resultMap.get('M44');
  const m45 = resultMap.get('M45');

  return (
    <div className="space-y-2">
      {/* Executive Summary */}
      <ExecutiveSummary m42Result={m42} marketingIq={marketingIq} />

      {/* Priority Actions */}
      <PrioritiesTable m42Result={m42} />

      {/* Category Deep Dives */}
      <CategoryDeepDive categories={categories} moduleResults={moduleResults} />

      {/* ROI Analysis */}
      <ROISection m44Result={m44} />

      {/* Cost Optimization */}
      <CostCutterSection m45Result={m45} />

      {/* Recommendations Document */}
      <PRDSection m43Result={m43} />
    </div>
  );
}
