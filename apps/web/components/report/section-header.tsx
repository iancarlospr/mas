'use client';

/** Report section header with circled number badge — PRD-cont-4 Section 10.2 */
interface SectionHeaderProps {
  number: number;
  title: string;
}

export function SectionHeader({ number, title }: SectionHeaderProps) {
  return (
    <div className="report-section-header mb-6">
      <div className="flex items-center gap-3 mb-2">
        <span
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#1A1A2E] text-white text-sm"
          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700 }}
        >
          {number}
        </span>
        <h2
          className="uppercase tracking-tight text-[#1A1A2E]"
          style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontWeight: 800,
            fontSize: '2.5rem',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          {title}
        </h2>
      </div>
      <div className="h-[3px] bg-[#1A1A2E] w-full" />
    </div>
  );
}
