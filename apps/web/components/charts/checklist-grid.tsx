'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'partial' | 'na';
  value?: string;
  grade?: string;
  recommendation?: string;
}

interface ChecklistGridProps {
  title: string;
  items: ChecklistItem[];
  columns?: 1 | 2 | 3 | 4;
  showSummary?: boolean;
  expandable?: boolean;
  compact?: boolean;
  className?: string;
}

const STATUS_CONFIG = {
  pass: { border: '#06D6A0', icon: '✓', color: '#06D6A0' },
  fail: { border: '#EF476F', icon: '✕', color: '#EF476F' },
  partial: { border: '#FFD166', icon: '!', color: '#FFD166' },
  na: { border: '#E2E8F0', icon: '—', color: '#94A3B8' },
};

export function ChecklistGrid({
  title,
  items,
  columns = 3,
  showSummary = true,
  expandable = false,
  compact = false,
  className,
}: ChecklistGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const passCount = items.filter((i) => i.status === 'pass').length;
  const totalCheckable = items.filter((i) => i.status !== 'na').length;
  const passRate = totalCheckable > 0 ? Math.round((passCount / totalCheckable) * 100) : 0;

  return (
    <div className={className}>
      {/* Summary bar */}
      {showSummary && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-heading font-600 text-[#1A1A2E]">{title}</span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: '#64748B' }}>
              {passCount}/{totalCheckable} configured
            </span>
          </div>
          <div className="w-full h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${passRate}%`,
                backgroundColor: passRate >= 70 ? '#06D6A0' : passRate >= 40 ? '#FFD166' : '#EF476F',
              }}
            />
          </div>
        </div>
      )}

      {/* Grid */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(var(--cols, ${columns}), 1fr)`,
        }}
      >
        <style>{`
          @media (max-width: 1024px) { .checklist-grid { --cols: 2; } }
          @media (max-width: 640px) { .checklist-grid { --cols: 1; } }
        `}</style>
        {items.map((item) => {
          const config = STATUS_CONFIG[item.status];
          const isExpanded = expandedId === item.id;

          return (
            <div
              key={item.id}
              className={cn(
                'rounded-lg bg-white checklist-grid',
                expandable && 'cursor-pointer',
              )}
              style={{
                padding: compact ? '6px 8px' : '8px 12px',
                borderLeft: `3px solid ${config.border}`,
                border: `1px solid #F1F5F9`,
                borderLeftWidth: 3,
                borderLeftColor: config.border,
              }}
              onClick={expandable ? () => setExpandedId(isExpanded ? null : item.id) : undefined}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
                  style={{ color: config.color }}
                >
                  {config.icon}
                </span>
                <span
                  className={cn('text-sm', compact ? 'text-xs' : 'text-sm')}
                  style={{ fontFamily: '"Inter", sans-serif', color: '#1A1A2E' }}
                >
                  {item.name}
                </span>
                {item.grade && (
                  <span
                    className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      backgroundColor: '#F1F5F9',
                      color: '#1A1A2E',
                    }}
                  >
                    {item.grade}
                  </span>
                )}
              </div>
              {item.value && !compact && (
                <div
                  className="mt-1 text-xs truncate"
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    color: '#94A3B8',
                    marginLeft: 28,
                  }}
                >
                  {item.value}
                </div>
              )}
              {/* Expandable recommendation */}
              {expandable && isExpanded && item.recommendation && (
                <div
                  className="mt-2 text-xs leading-relaxed"
                  style={{ color: '#64748B', marginLeft: 28 }}
                >
                  {item.recommendation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
