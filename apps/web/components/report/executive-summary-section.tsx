'use client';

import { useEffect } from 'react';
import type { ReportCategoryScore, Finding, Opportunity } from '@marketing-alpha/types';
import { ScoreGauge } from '@/components/scan/score-gauge';
import { SectionHeader } from './section-header';
import { SeverityBadge } from './severity-badge';

/** Executive Summary — PRD-cont-4 Section 3. */
interface ExecutiveSummarySectionProps {
  marketingIQ: number;
  marketingIQLabel: string;
  categoryScores: ReportCategoryScore[];
  executiveBrief: string;
  criticalFindings: Finding[];
  topOpportunities: Opportunity[];
  keyMetrics: {
    monthlyVisits?: number;
    bounceRate?: number;
    techStackCount: number;
    complianceScore: number;
  };
  isPrintMode: boolean;
  onChartReady: () => void;
}

const TRAFFIC_LIGHT_COLORS: Record<string, string> = {
  green: '#06D6A0',
  yellow: '#FFD166',
  red: '#EF476F',
};

function formatNumber(n: number | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function ExecutiveSummarySectionComponent({
  marketingIQ,
  marketingIQLabel,
  categoryScores,
  executiveBrief,
  criticalFindings,
  topOpportunities,
  keyMetrics,
  isPrintMode,
  onChartReady,
}: ExecutiveSummarySectionProps) {
  useEffect(() => { onChartReady(); }, [onChartReady]);

  return (
    <section className="report-section py-12 print:py-6 print:break-before-page">
      <SectionHeader number={1} title="Executive Summary" />

      {/* Score + Category Scores Strip */}
      <div className="bg-surface border border-border rounded-xl p-8 mb-6 print:border-0 print:p-4">
        <div className="flex flex-col items-center mb-6">
          <ScoreGauge score={marketingIQ} size="xl" animate={!isPrintMode} />
          <p className="text-sm text-[#64748B] mt-2">MarketingIQ: {marketingIQ}/100</p>
        </div>

        {/* Category scores strip */}
        <div className="flex flex-wrap justify-center gap-3">
          {categoryScores.map(cat => (
            <div
              key={cat.shortName}
              className="flex flex-col items-center w-16 text-center"
            >
              <span
                className="font-mono text-lg font-bold"
                style={{ color: TRAFFIC_LIGHT_COLORS[cat.light] }}
              >
                {cat.score}
              </span>
              <span className="text-[10px] text-[#64748B] mt-0.5 uppercase tracking-wide">
                {cat.shortName}
              </span>
              {/* Traffic light indicator with shape */}
              <span
                className="mt-1 w-4 h-4 flex items-center justify-center text-white text-[8px]"
                style={{ background: TRAFFIC_LIGHT_COLORS[cat.light] }}
              >
                {cat.light === 'green'
                  ? <span className="rounded-full w-3 h-3 block" style={{ background: TRAFFIC_LIGHT_COLORS[cat.light] }} />
                  : cat.light === 'yellow'
                    ? <span className="block w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-transparent" style={{ borderBottomColor: TRAFFIC_LIGHT_COLORS[cat.light] }} />
                    : <span className="block w-3 h-3" style={{ background: TRAFFIC_LIGHT_COLORS[cat.light] }} />}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Executive Brief */}
      {executiveBrief && (
        <div
          className="mb-6 rounded-r-lg"
          style={{
            borderLeft: '3px solid #0F3460',
            background: '#F8FAFC',
            padding: '24px 28px',
          }}
        >
          <p
            style={{
              fontFamily: '"Inter", sans-serif',
              fontWeight: 400,
              fontSize: '1.05rem',
              lineHeight: 1.7,
              color: '#1A1A2E',
            }}
          >
            {executiveBrief}
          </p>
        </div>
      )}

      {/* Findings + Opportunities side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Critical Findings */}
        <div
          className="rounded-r-lg"
          style={{ borderLeft: '4px solid #EF476F', padding: '20px 24px', background: '#FFF5F7' }}
        >
          <h3
            className="font-heading font-700 text-sm mb-3"
            style={{ color: '#EF476F' }}
          >
            Critical Findings
          </h3>
          <ul className="space-y-3">
            {criticalFindings.slice(0, 5).map((f, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-mono text-xs text-[#94A3B8] mt-0.5">{i + 1}.</span>
                  <div>
                    <span className="font-medium text-[#1A1A2E]">{f.finding}</span>
                    <SeverityBadge severity={f.severity} />
                    {f.impact && (
                      <p className="text-xs text-[#64748B] mt-1">Impact: {f.impact}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Top Opportunities */}
        <div
          className="rounded-r-lg"
          style={{ borderLeft: '4px solid #06D6A0', padding: '20px 24px', background: '#F0FFF4' }}
        >
          <h3
            className="font-heading font-700 text-sm mb-3"
            style={{ color: '#06D6A0' }}
          >
            Top Opportunities
          </h3>
          <ul className="space-y-3">
            {topOpportunities.slice(0, 5).map((o, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-mono text-xs text-[#94A3B8] mt-0.5">{i + 1}.</span>
                  <div>
                    <span className="font-medium text-[#1A1A2E]">{o.opportunity}</span>
                    {o.impact && (
                      <p className="text-xs text-[#06D6A0] mt-1">Impact: {o.impact}</p>
                    )}
                    {o.effort && (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 bg-[#E2E8F0] rounded ml-1 text-[#64748B]">
                        {o.effort} effort
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Key Metrics Strip */}
      <div
        className="flex flex-wrap justify-center gap-6 py-6 border-t border-b border-[#E2E8F0]"
      >
        <MetricCard label="Monthly Visits" value={formatNumber(keyMetrics.monthlyVisits)} />
        <MetricCard label="Bounce Rate" value={keyMetrics.bounceRate != null ? `${keyMetrics.bounceRate}%` : '—'} />
        <MetricCard label="Tech Stack" value={`${keyMetrics.techStackCount} tools`} />
        <MetricCard label="Compliance" value={`${keyMetrics.complianceScore}/100`} />
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div
        className="font-mono font-bold text-xl text-[#1A1A2E]"
        style={{ fontFamily: '"JetBrains Mono", monospace' }}
      >
        {value}
      </div>
      <div className="text-xs text-[#64748B] mt-1">{label}</div>
    </div>
  );
}

export { ExecutiveSummarySectionComponent as ExecutiveSummarySection };
