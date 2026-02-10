'use client';

import { SectionHeader } from './section-header';

/** Sources section — PRD-cont-4 Appendix D. */
interface SourcesSectionProps {
  sources: Array<{
    moduleId: string;
    moduleName: string;
    dataProvider?: string;
    timestamp: string;
  }>;
  sectionNumber: number;
  isPrintMode: boolean;
}

export function SourcesSection({ sources, sectionNumber }: SourcesSectionProps) {
  return (
    <section className="report-section py-12 print:py-6 print:break-before-page">
      <SectionHeader number={sectionNumber} title="Data Sources" />

      <p className="text-sm text-[#64748B] mb-4">
        This report was generated from {sources.length} module analyses.
        Each data point is traceable to its source module.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-[#E2E8F0] rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-[#F8FAFC]">
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Module ID</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Module Name</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Provider</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'}>
                <td className="px-4 py-2.5 font-mono text-xs text-[#94A3B8] border-b border-[#F1F5F9]">{s.moduleId}</td>
                <td className="px-4 py-2.5 text-sm text-[#1A1A2E] font-medium border-b border-[#F1F5F9]">{s.moduleName}</td>
                <td className="px-4 py-2.5 text-xs text-[#64748B] border-b border-[#F1F5F9]">{s.dataProvider ?? 'Built-in'}</td>
                <td className="px-4 py-2.5 text-xs font-mono text-[#94A3B8] border-b border-[#F1F5F9]">
                  {new Date(s.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
