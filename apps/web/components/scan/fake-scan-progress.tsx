'use client';

import { useEffect, useState, useRef } from 'react';
import type { ScanStatus } from '@marketing-alpha/types';
import { cn } from '@/lib/utils';

interface FakeScanProgressProps {
  url: string;
  onGateReached: () => void;
}

const PHASES: { status: ScanStatus; label: string; number: number }[] = [
  { status: 'passive', label: 'Infrastructure', number: 1 },
  { status: 'browser', label: 'Browser Analysis', number: 2 },
  { status: 'ghostscan', label: 'GhostScan', number: 3 },
  { status: 'external', label: 'Market Intel', number: 4 },
  { status: 'synthesis', label: 'AI Synthesis', number: 5 },
];

interface FakeModule {
  moduleId: string;
  name: string;
  score: number;
}

const FAKE_MODULES: { delay: number; module: FakeModule }[] = [
  { delay: 800, module: { moduleId: 'M01', name: 'DNS & Infrastructure', score: 72 } },
  { delay: 1600, module: { moduleId: 'M02', name: 'HTTP Headers', score: 65 } },
  { delay: 3200, module: { moduleId: 'M04', name: 'Performance Baseline', score: 58 } },
];

export function FakeScanProgress({ url, onGateReached }: FakeScanProgressProps) {
  const [status, setStatus] = useState<ScanStatus>('passive');
  const [progress, setProgress] = useState(5);
  const [completedModules, setCompletedModules] = useState<FakeModule[]>([]);
  const gateCalledRef = useRef(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Module reveals
    FAKE_MODULES.forEach(({ delay, module }) => {
      timers.push(setTimeout(() => {
        setCompletedModules((prev) => [...prev, module]);
      }, delay));
    });

    // Progress updates
    timers.push(setTimeout(() => setProgress(12), 1600));
    timers.push(setTimeout(() => {
      setStatus('browser');
      setProgress(18);
    }, 2500));
    timers.push(setTimeout(() => setProgress(22), 4000));

    // Gate
    timers.push(setTimeout(() => {
      if (!gateCalledRef.current) {
        gateCalledRef.current = true;
        onGateReached();
      }
    }, 4000));

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [onGateReached]);

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
                {mod.moduleId} — {mod.name}
              </span>
              <span
                className={cn(
                  'text-sm font-mono font-700',
                  mod.score >= 70 ? 'text-success' : mod.score >= 40 ? 'text-warning' : 'text-error',
                )}
              >
                {mod.score}/100
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
