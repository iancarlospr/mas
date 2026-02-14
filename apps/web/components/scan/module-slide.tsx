'use client';

import type { ModuleResult, Checkpoint, Signal } from '@marketing-alpha/types';
import { getTrafficLight } from '@marketing-alpha/types';
import { TrafficLight } from './traffic-light';
import { SignalBadge } from './signal-badge';
import { UnlockOverlay } from './unlock-overlay';
import { cn } from '@/lib/utils';

interface ModuleSlideProps {
  moduleId: string;
  moduleName: string;
  result: ModuleResult | null;
  scanId: string;
  isPaid: boolean;
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
  return null;
}

const HEALTH_COLORS: Record<string, string> = {
  excellent: 'text-success',
  good: 'text-success/70',
  warning: 'text-warning',
  critical: 'text-error',
  info: 'text-muted',
};

export function ModuleSlide({ moduleId, moduleName, result, scanId, isPaid }: ModuleSlideProps) {
  const light = result?.score != null ? getTrafficLight(result.score) : undefined;
  const isError = result?.status === 'error';

  // Gather data entries
  const dataEntries: [string, string][] = [];
  if (result?.data) {
    for (const [key, val] of Object.entries(result.data)) {
      const formatted = formatValue(val);
      if (formatted != null) {
        dataEntries.push([humanizeKey(key), formatted]);
      }
    }
  }

  // Detected tools from signals
  const toolSignals = result?.signals.filter((s) => s.type === 'tool_detected') ?? [];
  const freeSignalLimit = 3;
  const freeCheckpointLimit = 5;
  const hiddenCount = Math.max(
    0,
    (result?.signals.length ?? 0) - freeSignalLimit + dataEntries.length,
  );

  return (
    <div
      id={`slide-${moduleId}`}
      className="slide-card relative w-full bg-white border border-border/60 rounded-xl shadow-sm overflow-hidden"
      style={{ aspectRatio: '16 / 9' }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted">{moduleId}</span>
          <span className="font-heading text-sm font-600 text-primary">{moduleName}</span>
        </div>
        {result?.score != null && light && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-heading font-800 tabular-nums',
                light === 'green' ? 'text-success' : light === 'yellow' ? 'text-warning' : 'text-error',
              )}
            >
              {result.score}
            </span>
            <TrafficLight light={light} size="sm" dotOnly />
          </div>
        )}
        {isError && (
          <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">
            Unavailable
          </span>
        )}
      </div>

      {/* Content area */}
      <div className="p-6 h-[calc(100%-48px)] overflow-hidden">
        {isError && (
          <div className="flex items-center justify-center h-full text-sm text-muted">
            This module could not complete for this site.
          </div>
        )}

        {!isError && result && !isPaid && (
          <PaidContent
            result={result}
            dataEntries={dataEntries}
            toolSignals={toolSignals}
          />
        )}

        {!isError && result && isPaid && (
          <FreeContent
            result={result}
            freeCheckpointLimit={freeCheckpointLimit}
            freeSignalLimit={freeSignalLimit}
            toolSignals={toolSignals}
          />
        )}

        {!result && !isError && (
          <div className="flex items-center justify-center h-full text-sm text-muted">
            No data available
          </div>
        )}
      </div>

      {/* Frosted overlay for free tier on paid modules */}
      {isPaid && result && (
        <UnlockOverlay scanId={scanId} hiddenCount={hiddenCount > 0 ? hiddenCount : undefined} />
      )}
    </div>
  );
}

/** Full content shown to paid users */
function PaidContent({
  result,
  dataEntries,
  toolSignals,
}: {
  result: ModuleResult;
  dataEntries: [string, string][];
  toolSignals: Signal[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-y-auto">
      {/* Left: Checkpoints */}
      <div className="space-y-3">
        {result.checkpoints.length > 0 && (
          <div>
            <h4 className="text-xs font-heading font-700 text-muted uppercase tracking-wide mb-2">
              Checkpoints
            </h4>
            <div className="space-y-2">
              {result.checkpoints.map((cp) => (
                <CheckpointRow key={cp.id} checkpoint={cp} showEvidence />
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
              {result.signals.map((signal, i) => (
                <SignalBadge key={`${signal.name}-${i}`} signal={signal} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Tools + Details */}
      <div className="space-y-3">
        {toolSignals.length > 0 && (
          <div>
            <h4 className="text-xs font-heading font-700 text-muted uppercase tracking-wide mb-2">
              Detected Tools ({toolSignals.length})
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {toolSignals.map((s, i) => (
                <SignalBadge key={`tool-${s.name}-${i}`} signal={s} />
              ))}
            </div>
          </div>
        )}

        {dataEntries.length > 0 && (
          <div>
            <h4 className="text-xs font-heading font-700 text-muted uppercase tracking-wide mb-2">
              Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {dataEntries.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between text-xs gap-2">
                  <span className="text-muted truncate">{label}</span>
                  <span className="text-primary font-mono font-medium text-right flex-shrink-0 max-w-[50%] truncate">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Limited content shown to free tier users */
function FreeContent({
  result,
  freeCheckpointLimit,
  freeSignalLimit,
  toolSignals,
}: {
  result: ModuleResult;
  freeCheckpointLimit: number;
  freeSignalLimit: number;
  toolSignals: Signal[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Checkpoints (names + health only, no evidence) */}
      {result.checkpoints.length > 0 && (
        <div>
          <h4 className="text-xs font-heading font-700 text-muted uppercase tracking-wide mb-2">
            Checkpoints
          </h4>
          <div className="space-y-1.5">
            {result.checkpoints.slice(0, freeCheckpointLimit).map((cp) => (
              <CheckpointRow key={cp.id} checkpoint={cp} showEvidence={false} />
            ))}
          </div>
        </div>
      )}

      {/* Right: Top tool signals */}
      <div className="space-y-3">
        {toolSignals.length > 0 && (
          <div>
            <h4 className="text-xs font-heading font-700 text-muted uppercase tracking-wide mb-2">
              Detected Tools
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {toolSignals.slice(0, freeSignalLimit).map((s, i) => (
                <SignalBadge key={`tool-${s.name}-${i}`} signal={s} />
              ))}
              {toolSignals.length > freeSignalLimit && (
                <span className="text-xs text-muted self-center">
                  +{toolSignals.length - freeSignalLimit} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckpointRow({
  checkpoint,
  showEvidence,
}: {
  checkpoint: Checkpoint;
  showEvidence: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-primary/80 font-body">{checkpoint.name}</span>
        <span className={cn('text-xs font-medium capitalize', HEALTH_COLORS[checkpoint.health] ?? 'text-muted')}>
          {checkpoint.health}
        </span>
      </div>
      {showEvidence && checkpoint.evidence && (
        <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{checkpoint.evidence}</p>
      )}
      {showEvidence && checkpoint.recommendation && (
        <p className="text-[11px] text-accent mt-0.5 leading-relaxed">
          → {checkpoint.recommendation}
        </p>
      )}
    </div>
  );
}
