'use client';

import type { CategoryScore, ModuleResult, ModuleId, ScoreCategory } from '@marketing-alpha/types';
import { ReportSection } from './report-section';
import { cn } from '@/lib/utils';

interface CategoryDeepDiveProps {
  categories: CategoryScore[];
  moduleResults: ModuleResult[];
}

const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  analytics_integrity: 'Analytics & Data Integrity',
  paid_media_attribution: 'Paid Media & Attribution',
  performance_ux: 'Performance & User Experience',
  compliance_security: 'Compliance & Security',
  martech_efficiency: 'MarTech Efficiency',
  seo_content: 'SEO & Content',
  market_position: 'Market Position',
  digital_presence: 'Digital Presence',
};

const CATEGORY_DESCRIPTIONS: Record<ScoreCategory, string> = {
  analytics_integrity: 'How well analytics tools are configured, tracking accuracy, and data governance.',
  paid_media_attribution: 'Paid advertising infrastructure, pixel implementation, and attribution setup.',
  performance_ux: 'Page speed, Core Web Vitals, mobile experience, and carbon efficiency.',
  compliance_security: 'Legal compliance, security headers, consent management, and accessibility.',
  martech_efficiency: 'Marketing technology stack health, tool utilization, and integration quality.',
  seo_content: 'Search engine optimization, content structure, and social sharing readiness.',
  market_position: 'Traffic metrics, competitive landscape, brand search demand, and authority.',
  digital_presence: 'Corporate pages, support infrastructure, and investor relations.',
};

// Map categories to module IDs
const CATEGORY_MODULES: Record<ScoreCategory, string[]> = {
  analytics_integrity: ['M05', 'M08', 'M09'],
  paid_media_attribution: ['M06', 'M06b', 'M21', 'M28', 'M29'],
  performance_ux: ['M03', 'M13', 'M14'],
  compliance_security: ['M01', 'M10', 'M11', 'M12'],
  martech_efficiency: ['M07', 'M20'],
  seo_content: ['M04', 'M15', 'M16', 'M34', 'M35'],
  market_position: ['M24', 'M25', 'M26', 'M27', 'M30', 'M31', 'M32', 'M33', 'M36'],
  digital_presence: ['M02', 'M17', 'M18', 'M19', 'M22', 'M23', 'M37', 'M38', 'M39'],
};

const MODULE_NAMES: Record<string, string> = {
  M01: 'DNS & Security', M02: 'CMS & Infrastructure', M03: 'Performance',
  M04: 'Page Metadata', M05: 'Analytics', M06: 'Paid Media',
  M06b: 'PPC Landing Audit', M07: 'MarTech', M08: 'Tag Governance',
  M09: 'Behavioral Intel', M10: 'Accessibility', M11: 'Console Errors',
  M12: 'Compliance', M13: 'Perf & Carbon', M14: 'Mobile & Responsive',
  M15: 'Social & Sharing', M16: 'PR & Media', M17: 'Careers & HR',
  M18: 'Investor Relations', M19: 'Support', M20: 'Ecommerce/SaaS',
  M21: 'Ad Library', M22: 'News Sentiment', M23: 'Social Sentiment',
  M24: 'Market Intelligence', M25: 'Monthly Visits', M26: 'Traffic by Country',
  M27: 'Rankings', M28: 'Paid Traffic Cost', M29: 'Top Paid Keywords',
  M30: 'Competitor Overlap', M31: 'Traffic Sources', M32: 'Domain Trust',
  M33: 'Mobile vs Desktop', M34: 'Brand Demand', M35: 'Losing Keywords',
  M36: 'Bounce Rate', M37: 'Google Shopping', M38: 'Review Velocity',
  M39: 'Local Pack',
};

export function CategoryDeepDive({ categories, moduleResults }: CategoryDeepDiveProps) {
  const resultMap = new Map(moduleResults.map(r => [r.moduleId, r]));

  return (
    <>
      {categories.map((cat) => {
        const moduleIds = CATEGORY_MODULES[cat.category] ?? [];
        const categoryModules = moduleIds
          .map(id => resultMap.get(id as ModuleId))
          .filter((r): r is ModuleResult => r !== undefined);

        return (
          <ReportSection key={cat.category} title={CATEGORY_LABELS[cat.category]}>
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                'w-3 h-3 rounded-full',
                cat.light === 'green' ? 'bg-success' : cat.light === 'yellow' ? 'bg-warning' : 'bg-error',
              )} />
              <span className={cn(
                'font-heading text-xl font-800',
                cat.light === 'green' ? 'text-success' : cat.light === 'yellow' ? 'text-warning' : 'text-error',
              )}>
                {Math.round(cat.score)}/100
              </span>
              <span className="text-sm text-muted">{CATEGORY_DESCRIPTIONS[cat.category]}</span>
            </div>

            {/* Checkpoint table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 font-heading font-700 text-muted">Module</th>
                    <th className="py-2 pr-4 font-heading font-700 text-muted">Checkpoint</th>
                    <th className="py-2 pr-4 font-heading font-700 text-muted">Status</th>
                    <th className="py-2 font-heading font-700 text-muted">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryModules.flatMap((mod) =>
                    mod.checkpoints.map((cp, i) => (
                      <tr key={`${mod.moduleId}-${i}`} className="border-b border-border/50">
                        <td className="py-2 pr-4 text-muted whitespace-nowrap">
                          {MODULE_NAMES[mod.moduleId] ?? mod.moduleId}
                        </td>
                        <td className="py-2 pr-4 text-secondary font-medium whitespace-nowrap">
                          {cp.name}
                        </td>
                        <td className="py-2 pr-4">
                          <span className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                            cp.health === 'excellent' ? 'bg-success/10 text-success' :
                            cp.health === 'good' ? 'bg-success/10 text-success' :
                            cp.health === 'warning' ? 'bg-warning/10 text-warning' :
                            cp.health === 'critical' ? 'bg-error/10 text-error' :
                            'bg-muted/10 text-muted',
                          )}>
                            {cp.health}
                          </span>
                        </td>
                        <td className="py-2 text-muted text-xs max-w-md truncate">
                          {cp.evidence}
                        </td>
                      </tr>
                    ))
                  )}
                  {categoryModules.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-muted text-xs">
                        No module data available for this category
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ReportSection>
        );
      })}
    </>
  );
}
