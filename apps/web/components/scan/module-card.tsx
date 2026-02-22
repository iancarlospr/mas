'use client';

import { useState } from 'react';
import type { ModuleResult } from '@marketing-alpha/types';
import { getTrafficLight } from '@marketing-alpha/types';
import { TrafficLight } from './traffic-light';
import { SignalBadge } from './signal-badge';
import { cn } from '@/lib/utils';
import { analytics } from '@/lib/analytics';

interface ModuleAccordionRowProps {
  moduleId: string;
  moduleName: string;
  result: ModuleResult | null;
  scanId?: string;
  isPaid?: boolean;
}

/** Humanize camelCase keys: "dataLayerPresent" → "Data Layer Present" */
function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a primitive value for display */
function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value;
  return null; // skip objects/arrays
}

export function ModuleAccordionRow({
  moduleId,
  moduleName,
  result,
  scanId,
  isPaid = false,
}: ModuleAccordionRowProps) {
  const [expanded, setExpanded] = useState(false);

  const isError = result?.status === 'error';
  const canExpand = !isPaid && !isError && result != null;

  const toggleExpanded = () => {
    if (!canExpand) return;
    if (!expanded && scanId) {
      analytics.moduleExpanded(moduleId, scanId);
    }
    setExpanded(!expanded);
  };

  const light = result?.score != null ? getTrafficLight(result.score) : undefined;

  // Gather top-level primitive data for expanded details
  const dataEntries: [string, string][] = [];
  if (result?.data) {
    for (const [key, val] of Object.entries(result.data)) {
      const formatted = formatValue(val);
      if (formatted != null) {
        dataEntries.push([humanizeKey(key), formatted]);
      }
    }
  }

  return (
    <div
      className={cn(
        'bg-surface transition-colors',
        canExpand && 'cursor-pointer hover:bg-surface-hover',
        (isPaid || isError) && 'opacity-50',
      )}
    >
      {/* Collapsed row */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        onClick={toggleExpanded}
        role={canExpand ? 'button' : undefined}
        tabIndex={canExpand ? 0 : undefined}
        onKeyDown={canExpand ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded();
          }
        } : undefined}
        aria-expanded={canExpand ? expanded : undefined}
      >
        {/* Module ID */}
        <span className="text-xs font-mono text-muted w-10 flex-shrink-0">{moduleId}</span>

        {/* Module name */}
        <span className="font-heading text-sm font-600 text-primary flex-1 min-w-0 truncate">
          {moduleName}
        </span>

        {/* Badges for paid / error */}
        {isPaid && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex-shrink-0">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Paid
          </span>
        )}
        {isError && (
          <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full flex-shrink-0">
            Unavailable
          </span>
        )}

        {/* Score + traffic light */}
        {result?.score != null && light && !isPaid && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn(
              'text-sm font-heading font-800 tabular-nums',
              light === 'green' ? 'text-success' : light === 'yellow' ? 'text-warning' : 'text-error',
            )}>
              {result.score}
            </span>
            <TrafficLight light={light} size="xs" dotOnly />
          </div>
        )}

        {/* Chevron */}
        {canExpand && (
          <svg
            className={cn(
              'w-4 h-4 text-muted transition-transform duration-200 flex-shrink-0',
              expanded && 'rotate-180',
            )}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        )}
      </div>

      {/* Expanded content — CSS grid transition */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {expanded && result && (
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border/50">
              {/* Checkpoints */}
              {result.checkpoints.length > 0 && (
                <div>
                  <h4 className="text-xs font-heading font-700 text-muted uppercase tracking-wide mb-2">
                    Checkpoints
                  </h4>
                  <div className="space-y-1">
                    {result.checkpoints.map((cp) => (
                      <div key={cp.id} className="flex items-center justify-between text-xs">
                        <span className="text-primary/80">{cp.name}</span>
                        <span className={cn(
                          'font-medium capitalize',
                          cp.health === 'excellent' ? 'text-success' :
                          cp.health === 'good' ? 'text-success/70' :
                          cp.health === 'warning' ? 'text-warning' :
                          cp.health === 'critical' ? 'text-error' : 'text-muted',
                        )}>
                          {cp.health}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Signals */}
              {result.signals.length > 0 && (
                <div>
                  <h4 className="text-xs font-heading font-700 text-muted uppercase tracking-wide mb-2">
                    Signals
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.signals.slice(0, 8).map((signal, i) => (
                      <SignalBadge key={`${signal.name}-${i}`} signal={signal} />
                    ))}
                    {result.signals.length > 8 && (
                      <span className="text-xs text-muted self-center">
                        +{result.signals.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Details — top-level primitive data */}
              {dataEntries.length > 0 && (
                <div>
                  <h4 className="text-xs font-heading font-700 text-muted uppercase tracking-wide mb-2">
                    Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    {dataEntries.slice(0, 10).map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between text-xs gap-2">
                        <span className="text-muted truncate">{label}</span>
                        <span className="text-primary font-medium text-right flex-shrink-0">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
