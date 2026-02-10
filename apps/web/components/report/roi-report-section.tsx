'use client';

import { useEffect, useState } from 'react';
import type { ROIData } from '@marketing-alpha/types';
import { ScoreGauge } from '@/components/scan/score-gauge';
import { SectionHeader } from './section-header';
import { ConfidenceBadge } from './confidence-badge';

/** ROI Impact Analysis — PRD-cont-4 Section 6. */
interface ROISectionProps {
  data: ROIData;
  sectionNumber: number;
  isPrintMode: boolean;
  onChartReady: () => void;
}

function formatDollar(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const AREA_ICONS: Record<string, string> = {
  tracking: 'BarChart3',
  attribution: 'Target',
  performance: 'Zap',
  compliance: 'Shield',
  redundancy: 'Layers',
};

export function ROISection({ data, sectionNumber, isPrintMode, onChartReady }: ROISectionProps) {
  useEffect(() => { onChartReady(); }, [onChartReady]);
  const [showDetails, setShowDetails] = useState(isPrintMode);

  return (
    <section className="report-section py-12 print:py-6 print:break-before-page">
      <SectionHeader number={sectionNumber} title="ROI Impact Analysis" />

      {/* Hero Number */}
      <div
        className="text-center mb-8"
        style={{ padding: '40px 0', borderBottom: '1px solid #E2E8F0' }}
      >
        <p
          className="uppercase tracking-widest mb-2"
          style={{
            fontFamily: '"Inter", sans-serif',
            fontWeight: 500,
            fontSize: '0.875rem',
            color: '#64748B',
            letterSpacing: '0.1em',
          }}
        >
          Estimated Monthly Opportunity
        </p>
        <p
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '3rem',
            fontWeight: 700,
            color: '#1A1A2E',
          }}
        >
          {formatDollar(data.totalOpportunity.low)} — {formatDollar(data.totalOpportunity.high)}
        </p>
      </div>

      {/* Impact Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {data.impactAreas.map(area => (
          <div
            key={area.id}
            className="bg-surface border border-[#E2E8F0] rounded-xl p-4 text-center hover:shadow-sm transition-shadow"
            style={{ breakInside: 'avoid' }}
          >
            <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-2">
              {area.title}
            </p>
            <p
              className="font-mono text-lg text-[#1A1A2E] font-bold"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {formatDollar(area.low)}-{formatDollar(area.high)}
            </p>
            <div className="mt-2">
              <ConfidenceBadge level={area.confidence} />
            </div>
          </div>
        ))}
      </div>

      {/* Score Improvement Callout */}
      <div
        className="rounded-xl p-6 mb-8 flex items-center justify-center gap-8 flex-wrap"
        style={{ background: '#F0FFF4' }}
      >
        <div className="text-center">
          <p className="text-sm text-[#64748B] mb-2">{data.scoreImprovement.label}:</p>
          <div className="flex items-center gap-4">
            <ScoreGauge score={data.scoreImprovement.current} size="sm" animate={false} />
            <svg width="40" height="12" className="flex-shrink-0">
              <line x1="0" y1="6" x2="30" y2="6" stroke="#94A3B8" strokeWidth="2" strokeDasharray="4 2" />
              <polygon points="30,2 38,6 30,10" fill="#94A3B8" />
            </svg>
            <ScoreGauge score={data.scoreImprovement.estimated} size="sm" animate={false} color="#06D6A0" />
          </div>
          <p className="text-sm text-[#1A1A2E] font-semibold mt-2">
            MarketingIQ: {data.scoreImprovement.current} → est. {data.scoreImprovement.estimated}
          </p>
        </div>
      </div>

      {/* Calculation Details */}
      {data.impactAreas.some(a => a.calculationSteps.length > 0) && (
        <div>
          {!isPrintMode && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="expand-button text-sm text-[#0F3460] hover:text-[#0F3460]/80 mb-4 font-medium"
            >
              {showDetails ? 'Hide' : 'Show'} calculation details
            </button>
          )}

          {showDetails && (
            <div className="space-y-4" data-expandable>
              {data.impactAreas.filter(a => a.calculationSteps.length > 0).map(area => (
                <div
                  key={area.id}
                  className="bg-[#FAFBFC] rounded-lg p-4 border border-[#E2E8F0]"
                  style={{ breakInside: 'avoid' }}
                >
                  <h4 className="font-heading text-sm font-700 text-[#1A1A2E] mb-2">{area.title}</h4>
                  <ol className="list-decimal list-inside text-xs text-[#64748B] space-y-1 mb-2">
                    {area.calculationSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  {area.assumptions.length > 0 && (
                    <p className="text-xs italic text-[#94A3B8]">
                      Assumptions: {area.assumptions.join('; ')}
                    </p>
                  )}
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Sources: {area.sourceModules.join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compliance Risk */}
      {data.complianceRisk && (
        <div
          className="mt-6 rounded-r-lg"
          style={{ borderLeft: '4px solid #EF476F', background: '#FFF5F7', padding: '20px 24px' }}
        >
          <h4 className="font-heading text-sm font-700 text-[#EF476F] mb-2">Compliance Risk Exposure</h4>
          <p className="text-sm text-[#1A1A2E] mb-2">
            Estimated annual range: <strong>{data.complianceRisk.annualRange}</strong>
          </p>
          <ul className="text-xs text-[#64748B] space-y-1">
            {data.complianceRisk.riskFactors.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
