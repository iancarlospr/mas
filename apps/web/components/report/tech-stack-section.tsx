'use client';

import { useEffect } from 'react';
import type { TechStackData } from '@marketing-alpha/types';
import { SectionHeader } from './section-header';

/** Tech Stack Overview — PRD-cont-4 Section 4. */
interface TechStackSectionProps {
  data: TechStackData;
  sectionNumber: number;
  isPrintMode: boolean;
  onChartReady: () => void;
}

export function TechStackSection({ data, sectionNumber, isPrintMode, onChartReady }: TechStackSectionProps) {
  useEffect(() => { onChartReady(); }, [onChartReady]);

  // Group tools by category
  const categories = new Map<string, TechStackData['tools']>();
  for (const tool of data.tools) {
    const list = categories.get(tool.category) ?? [];
    list.push(tool);
    categories.set(tool.category, list);
  }

  return (
    <section className="report-section py-12 print:py-6 print:break-before-page">
      <SectionHeader number={sectionNumber} title="Technology Stack Overview" />

      {/* Stack Health Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <HealthCard label="Total Tools" value={data.stackHealth.total} color="#1A1A2E" />
        <HealthCard label="Active" value={data.stackHealth.active} color="#06D6A0" />
        <HealthCard label="Inactive" value={data.stackHealth.inactive} color="#FFD166" />
        <HealthCard label="Redundant Pairs" value={data.stackHealth.redundantPairs} color="#EF476F" />
      </div>

      {/* Industry comparison callout */}
      {data.industryComparison && (
        <div className="mb-8 p-4 bg-[#F0F4FF] rounded-lg border-l-4 border-[#0F3460]">
          <p className="text-sm text-[#1A1A2E]">
            Your stack uses <strong>{data.stackHealth.total} tools</strong> — the average for{' '}
            <strong>{data.industryComparison.industry}</strong> is{' '}
            <strong>{data.industryComparison.averageToolCount}</strong>.
          </p>
        </div>
      )}

      {/* Stack Diagram (grouped by category) */}
      <div className="mb-8">
        <h3 className="font-heading text-sm font-700 text-[#64748B] uppercase tracking-wider mb-4">
          Stack Diagram
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {Array.from(categories.entries()).map(([category, tools]) => (
            <div key={category}>
              <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-2">
                {category}
              </p>
              <div className="flex flex-wrap gap-2">
                {tools.map(tool => (
                  <div
                    key={tool.name}
                    className="flex items-center justify-center w-10 h-10 rounded-lg border border-[#E2E8F0] bg-white text-xs font-bold text-[#1A1A2E]"
                    title={tool.name}
                  >
                    {tool.name.slice(0, 3)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detection Table */}
      <div>
        <h3 className="font-heading text-sm font-700 text-[#64748B] uppercase tracking-wider mb-3">
          Detection Table
        </h3>
        <div className="overflow-x-auto">
          <table className="report-table w-full border-collapse border border-[#E2E8F0] rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-[#F8FAFC]">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Tool</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Category</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Status</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Source</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-[#64748B] font-semibold border-b-2 border-[#E2E8F0]">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {data.tools.map((tool, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'}>
                  <td className="px-4 py-2.5 text-sm text-[#1A1A2E] font-medium border-b border-[#F1F5F9]">
                    {tool.name}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-[#64748B] border-b border-[#F1F5F9]">
                    {tool.category}
                  </td>
                  <td className="px-4 py-2.5 border-b border-[#F1F5F9]">
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: tool.status === 'active' ? '#06D6A0' + '20' : tool.status === 'inactive' ? '#FFD166' + '20' : '#EF476F' + '20',
                        color: tool.status === 'active' ? '#06D6A0' : tool.status === 'inactive' ? '#FFD166' : '#EF476F',
                      }}
                    >
                      {tool.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-[#94A3B8] border-b border-[#F1F5F9]">
                    {tool.sourceModules.join(', ')}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-mono text-[#1A1A2E] border-b border-[#F1F5F9]">
                    {Math.round(tool.confidence * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function HealthCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 text-center">
      <div
        className="font-mono text-2xl font-bold"
        style={{ color, fontFamily: '"JetBrains Mono", monospace' }}
      >
        {value}
      </div>
      <div className="text-xs text-[#64748B] mt-1">{label}</div>
    </div>
  );
}
