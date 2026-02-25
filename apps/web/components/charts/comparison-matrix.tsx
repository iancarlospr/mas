'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScoreGauge } from '@/components/scan/score-gauge';

interface ComparisonAttribute {
  attribute: string;
  category: string;
  mainSite: string | boolean | number;
  comparator: string | boolean | number;
  match: boolean;
  severity: 'critical' | 'warning' | 'info';
}

interface ComparisonMatrixProps {
  title: string;
  labelA: string;
  labelB: string;
  data: ComparisonAttribute[];
  grouped?: boolean;
  filterMismatches?: boolean;
  summaryScore?: number;
  className?: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-gs-critical/10 text-gs-critical',
  warning: 'bg-gs-warning/10 text-gs-warning',
  info: 'bg-gs-cyan/10 text-gs-cyan',
};

export function ComparisonMatrix({
  title,
  labelA,
  labelB,
  data,
  grouped = true,
  filterMismatches = false,
  summaryScore,
  className,
}: ComparisonMatrixProps) {
  const [showOnlyMismatches, setShowOnlyMismatches] = useState(filterMismatches);

  const displayed = showOnlyMismatches ? data.filter((d) => !d.match) : data;

  const categories = grouped
    ? [...new Set(data.map((d) => d.category))]
    : [null];

  const matchCount = data.filter((d) => d.match).length;
  const parity = data.length > 0 ? Math.round((matchCount / data.length) * 100) : 0;

  return (
    <div className={cn('w-full', className)}>
      {/* Summary header */}
      <div className="flex items-center gap-4 mb-4">
        {summaryScore != null ? (
          <ScoreGauge score={summaryScore} size="sm" label="Parity" animate={false} />
        ) : (
          <div className="text-center">
            <div className="font-mono text-2xl font-bold text-primary">{parity}%</div>
            <div className="text-xs text-muted">Parity</div>
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-system text-sm font-bold text-primary">{title}</h3>
          <p className="text-xs text-muted">
            {matchCount} of {data.length} attributes match
          </p>
        </div>
        <button
          onClick={() => setShowOnlyMismatches((v) => !v)}
          className={cn(
            'text-xs px-3 py-1 rounded-full border transition-colors',
            showOnlyMismatches
              ? 'bg-gs-critical/10 border-gs-critical/30 text-gs-critical'
              : 'border-gs-light text-muted hover:border-gs-mid-light',
          )}
        >
          {showOnlyMismatches ? 'Showing mismatches' : 'Show mismatches only'}
        </button>
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gs-near-white sticky top-0 z-10">
              <th className="text-left font-system text-xs font-semibold text-gs-mid uppercase tracking-wide px-3 py-2">
                Attribute
              </th>
              <th className="text-left font-system text-xs font-semibold text-gs-mid uppercase tracking-wide px-3 py-2">
                {labelA}
              </th>
              <th className="text-left font-system text-xs font-semibold text-gs-mid uppercase tracking-wide px-3 py-2">
                {labelB}
              </th>
              <th className="text-center font-system text-xs font-semibold text-gs-mid uppercase tracking-wide px-3 py-2 w-24">
                Match
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const items = category
                ? displayed.filter((d) => d.category === category)
                : displayed;

              if (items.length === 0) return null;

              return (
                <AnimatePresence key={category ?? 'all'}>
                  {category && (
                    <tr>
                      <td
                        colSpan={4}
                        className="bg-gs-light px-3 py-1.5 font-system text-xs font-bold text-primary"
                      >
                        {category}
                      </td>
                    </tr>
                  )}
                  {items.map((item, i) => (
                    <motion.tr
                      key={`${item.category}-${item.attribute}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ delay: i * 0.03 }}
                      className={cn(
                        'border-b border-gs-light',
                        !item.match && 'bg-gs-critical/[0.03]',
                        i % 2 === 0 && item.match && 'bg-white',
                        i % 2 !== 0 && item.match && 'bg-gs-near-white',
                      )}
                    >
                      <td className="px-3 py-2 text-secondary">{item.attribute}</td>
                      <td className="px-3 py-2 font-mono text-xs text-primary">
                        {renderCellValue(item.mainSite)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-primary">
                        {renderCellValue(item.comparator)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {item.match ? (
                            <Check className="w-4 h-4 text-gs-terminal" />
                          ) : (
                            <X className="w-4 h-4 text-gs-critical" />
                          )}
                          {!item.match && (
                            <span
                              className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                SEVERITY_BADGE[item.severity],
                              )}
                            >
                              {item.severity}
                            </span>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderCellValue(value: string | boolean | number): React.ReactNode {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="w-4 h-4 text-gs-terminal inline" />
    ) : (
      <span className="text-muted italic">missing</span>
    );
  }
  return String(value);
}
