'use client';

import { useState } from 'react';
import type { ModuleResult, Signal } from '@marketing-alpha/types';
import { getTrafficLight } from '@marketing-alpha/types';
import { TrafficLight } from './traffic-light';
import { SignalBadge } from './signal-badge';
import { cn } from '@/lib/utils';
import { analytics } from '@/lib/analytics';

interface ModuleCardProps {
  moduleId: string;
  moduleName: string;
  result: ModuleResult;
  scanId?: string;
}

export function ModuleCard({ moduleId, moduleName, result, scanId }: ModuleCardProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => {
    if (!expanded && scanId) {
      analytics.moduleExpanded(moduleId, scanId);
    }
    setExpanded(!expanded);
  };

  if (result.status === 'error') {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 opacity-60">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-heading text-sm font-700 text-primary">{moduleName}</h3>
          <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full">
            Unavailable
          </span>
        </div>
        <p className="text-xs text-muted">
          This module couldn&apos;t complete its analysis.
          {result.error && <> Reason: {result.error}</>}
        </p>
      </div>
    );
  }

  if (result.status === 'skipped') {
    return null;
  }

  const light = result.score != null ? getTrafficLight(result.score) : undefined;
  const topSignals = result.signals.slice(0, 5);

  return (
    <div
      className={cn(
        'bg-surface border border-border rounded-xl p-6 transition-all duration-200 hover:shadow-lg cursor-pointer',
        expanded && 'shadow-lg',
      )}
      onClick={toggleExpanded}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setExpanded(!expanded);
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted">{moduleId}</span>
          <h3 className="font-heading text-sm font-700 text-primary">
            {moduleName}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {result.score != null && light && (
            <>
              <span className={cn(
                'text-lg font-heading font-800',
                light === 'green' ? 'text-success' : light === 'yellow' ? 'text-warning' : 'text-error',
              )}>
                {result.score}
              </span>
              <TrafficLight light={light} size="sm" />
            </>
          )}
        </div>
      </div>

      {/* Top signals */}
      {topSignals.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {topSignals.map((signal, i) => (
            <SignalBadge key={`${signal.name}-${i}`} signal={signal} />
          ))}
          {result.signals.length > 5 && (
            <span className="text-xs text-muted self-center">
              +{result.signals.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Expanded view */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-4" onClick={(e) => e.stopPropagation()}>
          {/* AI Synthesis */}
          {result.checkpoints.length > 0 && (
            <div>
              <h4 className="text-xs font-heading font-700 text-primary mb-2 uppercase tracking-wide">
                Checkpoints
              </h4>
              <div className="space-y-1">
                {result.checkpoints.map((cp) => (
                  <div key={cp.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{cp.name}</span>
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

          {/* All signals */}
          {result.signals.length > 5 && (
            <div>
              <h4 className="text-xs font-heading font-700 text-primary mb-2 uppercase tracking-wide">
                All Signals
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {result.signals.map((signal, i) => (
                  <SignalBadge key={`${signal.name}-${i}`} signal={signal} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
