'use client';

import { cn } from '@/lib/utils';
import type { ReportCategoryScore } from '@marketing-alpha/types';

/** Sticky sidebar TOC — PRD-cont-4 Section 1.3 */
interface ReportSidebarProps {
  sections: readonly string[];
  labels: Record<string, string>;
  activeSection: string;
  categoryScores: ReportCategoryScore[];
  onNavigate: (id: string) => void;
}

const TRAFFIC_LIGHT_COLORS: Record<string, string> = {
  green: '#06D6A0',
  yellow: '#FFD166',
  red: '#EF476F',
};

// Map section IDs to category shortNames for traffic light display
const SECTION_TO_SHORT: Record<string, string> = {
  'analytics': 'Anly',
  'paid-media': 'Paid',
  'performance': 'Perf',
  'compliance': 'Comp',
  'martech': 'MTch',
  'seo': 'SEO',
  'market-position': 'Mkt',
  'digital-presence': 'Dgtl',
};

export function ReportSidebar({
  sections,
  labels,
  activeSection,
  categoryScores,
  onNavigate,
}: ReportSidebarProps) {
  const scoreMap = new Map(categoryScores.map(c => [c.shortName, c]));

  return (
    <nav
      className="report-sidebar hidden lg:block fixed left-0 top-16 w-[250px] h-[calc(100vh-4rem)] overflow-y-auto border-r border-border bg-surface z-40 py-6 px-4"
      aria-label="Report navigation"
    >
      <p className="text-xs text-[#94A3B8] uppercase tracking-wider font-semibold mb-4 px-2">
        Report Sections
      </p>
      <ul className="space-y-0.5">
        {sections.map((id) => {
          const shortName = SECTION_TO_SHORT[id];
          const catScore = shortName ? scoreMap.get(shortName) : undefined;
          const isActive = activeSection === id;

          return (
            <li key={id}>
              <button
                onClick={() => onNavigate(id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2',
                  isActive
                    ? 'bg-[#0F3460]/10 text-[#0F3460] font-semibold'
                    : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#1A1A2E]',
                )}
                tabIndex={0}
              >
                {/* Traffic light dot for category sections */}
                {catScore && (
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: TRAFFIC_LIGHT_COLORS[catScore.light] }}
                  />
                )}
                <span className="truncate">{labels[id] ?? id}</span>
                {catScore && (
                  <span className="ml-auto text-xs font-mono text-[#94A3B8]">
                    {catScore.score}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
