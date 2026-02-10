'use client';

import { useEffect, useState, useRef } from 'react';
import type { ScanProgressEvent, ScanStatus } from '@marketing-alpha/types';
import { cn } from '@/lib/utils';

interface ScanProgressProps {
  scanId: string;
  onComplete: () => void;
}

const PHASES: { status: ScanStatus; label: string; number: number }[] = [
  { status: 'passive', label: 'Infrastructure', number: 1 },
  { status: 'browser', label: 'Browser Analysis', number: 2 },
  { status: 'ghostscan', label: 'GhostScan', number: 3 },
  { status: 'external', label: 'Market Intel', number: 4 },
  { status: 'synthesis', label: 'AI Synthesis', number: 5 },
];

interface CompletedModule {
  moduleId: string;
  score: number | null;
}

export function ScanProgress({ scanId, onComplete }: ScanProgressProps) {
  const [status, setStatus] = useState<ScanStatus>('queued');
  const [progress, setProgress] = useState(0);
  const [completedModules, setCompletedModules] = useState<CompletedModule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/scans/${scanId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data: ScanProgressEvent = JSON.parse(event.data);

      if (data.status) setStatus(data.status);
      if (data.progress != null) setProgress(data.progress);

      if (data.type === 'module' && data.moduleId) {
        setCompletedModules((prev) => {
          if (prev.some((m) => m.moduleId === data.moduleId)) return prev;
          return [...prev, { moduleId: data.moduleId!, score: data.moduleScore ?? null }];
        });
      }

      if (data.type === 'complete') {
        es.close();
        onComplete();
      }

      if (data.type === 'error') {
        setError(data.error ?? 'Scan failed');
        es.close();
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [scanId, onComplete]);

  const currentPhaseIndex = PHASES.findIndex((p) => p.status === status);

  return (
    <div className="max-w-2xl mx-auto py-12">
      <h2 className="font-heading text-h3 text-primary text-center mb-2">
        Scanning...
      </h2>
      <p className="text-sm text-muted text-center mb-8">
        Analyzing marketing technology stack across {PHASES.length} phases
      </p>

      {/* Progress bar */}
      <div className="w-full bg-border rounded-full h-2 mb-8">
        <div
          className="bg-accent h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.max(progress, 5)}%` }}
        />
      </div>

      {/* Phase indicators */}
      <div className="flex justify-between mb-12">
        {PHASES.map((phase, i) => {
          const isActive = i === currentPhaseIndex;
          const isComplete = i < currentPhaseIndex;

          return (
            <div key={phase.status} className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-heading font-700 transition-all',
                  isComplete && 'bg-success text-white',
                  isActive && 'bg-accent text-white animate-pulse',
                  !isComplete && !isActive && 'bg-border text-muted',
                )}
              >
                {isComplete ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  phase.number
                )}
              </div>
              <span className={cn(
                'text-xs font-medium',
                isActive ? 'text-accent' : 'text-muted',
              )}>
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Completed modules list */}
      {completedModules.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-heading font-700 text-primary mb-3">
            Completed Modules
          </h3>
          {completedModules.map((mod) => (
            <div
              key={mod.moduleId}
              className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-2 animate-in fade-in slide-in-from-bottom-2"
            >
              <span className="text-sm font-medium text-primary">
                {mod.moduleId}
              </span>
              {mod.score != null && (
                <span
                  className={cn(
                    'text-sm font-mono font-700',
                    mod.score >= 70 ? 'text-success' : mod.score >= 40 ? 'text-warning' : 'text-error',
                  )}
                >
                  {mod.score}/100
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-8 bg-error/10 border border-error/20 rounded-lg p-4 text-center">
          <p className="text-sm text-error font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
