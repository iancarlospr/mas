'use client';

import { SectionHeader } from './section-header';

/** Methodology section — PRD-cont-4 Section 9 / Appendix D. */
interface MethodologySectionProps {
  data: {
    categoryWeights: Array<{ name: string; weight: number }>;
    penaltiesApplied: Array<{ name: string; points: number; reason: string }>;
    bonusesApplied: Array<{ name: string; points: number; reason: string }>;
  };
  sectionNumber: number;
  isPrintMode: boolean;
}

export function MethodologySection({ data, sectionNumber }: MethodologySectionProps) {
  return (
    <section className="report-section py-12 print:py-6 print:break-before-page">
      <SectionHeader number={sectionNumber} title="Methodology" />

      {/* Category Weights */}
      <div className="mb-8">
        <h3 className="font-heading text-sm font-700 text-[#64748B] uppercase tracking-wider mb-3">
          Category Weights
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[#E2E8F0] rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-[#F8FAFC]">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Category</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Weight</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0] w-1/2">Bar</th>
              </tr>
            </thead>
            <tbody>
              {data.categoryWeights.map((cw, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'}>
                  <td className="px-4 py-2.5 text-sm text-[#1A1A2E] font-medium border-b border-[#F1F5F9]">{cw.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#1A1A2E] border-b border-[#F1F5F9]">
                    {Math.round(cw.weight * 100)}%
                  </td>
                  <td className="px-4 py-2.5 border-b border-[#F1F5F9]">
                    <div className="h-3 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0F3460] rounded-full"
                        style={{ width: `${cw.weight * 100 * 5}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Penalties */}
      {data.penaltiesApplied.length > 0 && (
        <div className="mb-6">
          <h3 className="font-heading text-sm font-700 text-[#EF476F] uppercase tracking-wider mb-3">
            Penalties Applied
          </h3>
          <div className="space-y-2">
            {data.penaltiesApplied.map((p, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs text-[#EF476F] font-bold flex-shrink-0">-{p.points}pts</span>
                <span className="text-[#1A1A2E] font-medium">{p.name}</span>
                <span className="text-xs text-[#94A3B8]">— {p.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bonuses */}
      {data.bonusesApplied.length > 0 && (
        <div>
          <h3 className="font-heading text-sm font-700 text-[#06D6A0] uppercase tracking-wider mb-3">
            Bonuses Applied
          </h3>
          <div className="space-y-2">
            {data.bonusesApplied.map((b, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs text-[#06D6A0] font-bold flex-shrink-0">+{b.points}pts</span>
                <span className="text-[#1A1A2E] font-medium">{b.name}</span>
                <span className="text-xs text-[#94A3B8]">— {b.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-8 p-4 bg-[#FAFBFC] rounded-lg text-xs text-[#94A3B8] leading-relaxed">
        MarketingAlphaScan uses a weighted scoring model across 46 automated modules.
        Scores are objective, based on technical detection and industry benchmarks.
        AI-generated insights are synthesized from module data and may contain approximations.
        All dollar estimates represent potential opportunity and should be validated with your team.
      </div>
    </section>
  );
}
