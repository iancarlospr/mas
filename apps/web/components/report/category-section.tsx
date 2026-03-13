'use client';

import { useEffect } from 'react';
import type { CategoryDeepDiveData, Priority, Effort } from '@marketing-alpha/types';
import { ScoreGauge } from '@/components/scan/score-gauge';
import { SectionHeader } from './section-header';
import { SeverityBadge } from './severity-badge';

/** Reusable category deep-dive — PRD-cont-4 Section 5. */
interface CategorySectionProps {
  sectionNumber: number;
  data: CategoryDeepDiveData;
  isPrintMode: boolean;
  onChartReady: () => void;
}

const TRAFFIC_LIGHT_COLOR: Record<string, string> = {
  green: '#06D6A0',
  yellow: '#FFD166',
  red: '#EF476F',
};

const PRIORITY_COLORS: Record<Priority, string> = {
  P0: '#EF476F',
  P1: '#FFD166',
  P2: '#0F3460',
  P3: '#94A3B8',
};

export function CategorySection({ sectionNumber, data, isPrintMode, onChartReady }: CategorySectionProps) {
  useEffect(() => { onChartReady(); }, [onChartReady]);

  const { category, moduleScores, findings, recommendations } = data;

  return (
    <section className="report-section py-12 print:py-6 print:break-before-page">
      <SectionHeader number={sectionNumber} title={category.name} />

      {/* Score Header */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6 print:border-0 print:p-4">
        <div className="flex items-center gap-4 mb-4">
          <ScoreGauge score={category.score} size="md" animate={!isPrintMode} />
          <div>
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-2xl font-bold"
                style={{ color: TRAFFIC_LIGHT_COLOR[category.light] }}
              >
                {category.score}/100
              </span>
              <span
                className="inline-flex w-3 h-3 rounded-full"
                style={{ background: TRAFFIC_LIGHT_COLOR[category.light] }}
              />
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Weight: {Math.round(category.weight * 100)}% of MarketingIQ
            </p>
            <p className="text-sm text-[#64748B] mt-2">{category.description}</p>
          </div>
        </div>

        {/* Module Breakdown Bars */}
        <div className="space-y-2">
          <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-1">Module Breakdown</p>
          {moduleScores.map(mod => (
            <ModuleScoreBar key={mod.moduleId} {...mod} />
          ))}
        </div>
      </div>

      {/* Key Findings */}
      {findings.length > 0 && (
        <div className="mb-6">
          <h3 className="font-heading text-sm font-700 text-[#1A1A2E] mb-3 uppercase tracking-wider">
            Key Findings
          </h3>
          <div className="space-y-3">
            {findings.map((f, i) => (
              <div
                key={i}
                className="bg-surface border border-border rounded-lg p-4 print:border-0 print:p-3"
                style={{ breakInside: 'avoid' }}
              >
                <div className="flex items-start gap-2 mb-1">
                  <SeverityBadge severity={f.severity} />
                  <span className="font-medium text-sm text-[#1A1A2E]">{f.finding}</span>
                </div>
                {f.evidence && (
                  <p className="text-xs text-[#64748B] mt-1">Evidence: {f.evidence}</p>
                )}
                {f.businessImpact && (
                  <p className="text-xs text-[#64748B] mt-1">Impact: {f.businessImpact}</p>
                )}
                {f.sourceModules.length > 0 && (
                  <p className="text-xs font-mono text-[#94A3B8] mt-1">
                    [{f.sourceModules.join(', ')}]
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations Table */}
      {recommendations.length > 0 && (
        <div style={{ breakInside: 'avoid' }}>
          <h3 className="font-heading text-sm font-700 text-[#1A1A2E] mb-3 uppercase tracking-wider">
            Recommendations
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-[#E2E8F0] rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[#F8FAFC]">
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0] w-8">#</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Action</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Priority</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Effort</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Impact</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'}>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#94A3B8] border-b border-[#F1F5F9]">{i + 1}</td>
                    <td className="px-4 py-2.5 text-sm text-[#1A1A2E] font-medium border-b border-[#F1F5F9]">{rec.action}</td>
                    <td className="px-4 py-2.5 border-b border-[#F1F5F9]">
                      <span
                        className="inline-flex px-2 py-0.5 rounded text-xs font-bold text-white"
                        style={{ background: PRIORITY_COLORS[rec.priority] }}
                      >
                        {rec.priority}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 border-b border-[#F1F5F9]">
                      <EffortBadge effort={rec.effort} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#64748B] border-b border-[#F1F5F9]">{rec.expectedImpact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function ModuleScoreBar({ moduleId, moduleName, score, status }: {
  moduleId: string;
  moduleName: string;
  score: number;
  status: string;
}) {
  const barColor = score >= 70 ? '#06D6A0' : score >= 40 ? '#FFD166' : '#EF476F';
  const isSkipped = status === 'skipped';

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono text-[#94A3B8] w-8 flex-shrink-0">{moduleId}</span>
      <span className="text-xs text-[#1A1A2E] w-44 truncate flex-shrink-0">{moduleName}</span>
      <div className="flex-1 h-3 bg-[#F1F5F9] rounded-full overflow-hidden">
        {isSkipped ? (
          <div className="h-full w-full border border-dashed border-[#94A3B8] rounded-full" />
        ) : (
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(score, 2)}%`, background: barColor }}
          />
        )}
      </div>
      <span className="font-mono text-xs text-[#1A1A2E] w-12 text-right flex-shrink-0">
        {isSkipped ? 'Skipped' : `${score}/100`}
      </span>
    </div>
  );
}

function EffortBadge({ effort }: { effort: Effort }) {
  const colors: Record<Effort, string> = {
    S: '#06D6A0',
    M: '#FFD166',
    L: '#EF476F',
    XL: '#EF476F',
  };
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: colors[effort] + '20', color: colors[effort] }}
    >
      {effort}
    </span>
  );
}
