'use client';

import { cn } from '@/lib/utils';

interface ReportSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function ReportSection({ title, children, className }: ReportSectionProps) {
  return (
    <section className={cn('bg-surface border border-border rounded-xl p-8 mb-6 print:rounded-none print:border-0 print:p-4 print:mb-4 print:break-inside-avoid', className)}>
      <h2 className="font-heading text-h3 text-primary mb-4 print:text-lg print:mb-2">{title}</h2>
      {children}
    </section>
  );
}
