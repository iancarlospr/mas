'use client';

import { cn } from '@/lib/utils';

interface ToolUtilizationData {
  tool: string;
  category: string;
  utilization: 'high' | 'medium' | 'low' | 'unused' | 'redundant';
  signals: number;
  cost?: number;
}

interface ToolUtilizationHeatmapProps {
  data: ToolUtilizationData[];
  className?: string;
}

const UTIL_COLORS: { [key: string]: { bg: string; text: string; label: string } } = {
  high: { bg: 'bg-gs-ink', text: 'text-white', label: 'High' },
  medium: { bg: 'bg-gs-ink/60', text: 'text-white', label: 'Medium' },
  low: { bg: 'bg-gs-ink/25', text: 'text-primary', label: 'Low' },
  unused: { bg: 'bg-gs-chrome', text: 'text-muted', label: 'Unused' },
  redundant: { bg: 'bg-gs-critical/10', text: 'text-gs-critical', label: 'Redundant' },
};

export function ToolUtilizationHeatmap({
  data,
  className,
}: ToolUtilizationHeatmapProps) {
  // Group by category
  const categories = [...new Set(data.map((d) => d.category))];
  const grouped = categories.map((cat) => ({
    category: cat,
    tools: data.filter((d) => d.category === cat),
  }));

  const underutilized = data.filter(
    (d) => d.utilization === 'low' || d.utilization === 'unused' || d.utilization === 'redundant',
  ).length;

  return (
    <div className={cn('w-full', className)}>
      {/* Summary */}
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-lg font-bold text-primary">{underutilized}</span>
        <span className="text-xs text-muted">of {data.length} tools underutilized</span>
      </div>

      {/* Heatmap grid */}
      <div className="space-y-4">
        {grouped.map((group) => (
          <div key={group.category}>
            <h4 className="font-system text-xs font-bold text-muted uppercase tracking-wide mb-2">
              {group.category}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {group.tools.map((tool) => {
                const style = (UTIL_COLORS[tool.utilization] ?? UTIL_COLORS['unused'])!;
                return (
                  <div
                    key={tool.tool}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-shadow hover:shadow-sm',
                      style.bg,
                      tool.utilization === 'redundant' && 'border border-gs-critical/30',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('font-medium', style.text)}>
                        {tool.tool}
                      </span>
                      {tool.utilization === 'redundant' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gs-critical/10 text-gs-critical font-bold uppercase">
                          Redundant
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn('font-mono text-[10px]', style.text)}>
                        {tool.signals} signals
                      </span>
                      {tool.cost != null && (
                        <span className="font-mono text-[10px] text-muted">
                          ${tool.cost}/mo
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gs-chrome">
        {Object.entries(UTIL_COLORS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5 text-[10px] text-muted">
            <div className={cn('w-3 h-3 rounded', val.bg)} />
            <span>{val.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
