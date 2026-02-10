'use client';

import { SectionHeader } from './section-header';

/** Print-only Table of Contents — PRD-cont-4 Section 1.4 */
interface TableOfContentsSectionProps {
  sections: readonly string[];
  labels: Record<string, string>;
}

export function TableOfContentsSection({ sections, labels }: TableOfContentsSectionProps) {
  return (
    <section className="report-section print:break-after-page py-12 print:py-8">
      <h2
        className="uppercase tracking-tight text-[#1A1A2E] mb-8"
        style={{
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          fontWeight: 800,
          fontSize: '2.5rem',
          letterSpacing: '-0.02em',
        }}
      >
        Table of Contents
      </h2>
      <div className="h-[3px] bg-[#1A1A2E] w-full mb-8" />

      <ol className="space-y-3">
        {sections
          .filter(s => s !== 'cover' && s !== 'toc')
          .map((id, i) => (
            <li key={id} className="flex items-baseline gap-3">
              <span
                className="font-mono text-sm text-[#94A3B8] w-6 text-right flex-shrink-0"
              >
                {i + 1}
              </span>
              <span
                className="text-base text-[#1A1A2E]"
                style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 600 }}
              >
                {labels[id] ?? id}
              </span>
              <span className="flex-1 border-b border-dotted border-[#E2E8F0] mx-2 mb-1" />
            </li>
          ))}
      </ol>
    </section>
  );
}
