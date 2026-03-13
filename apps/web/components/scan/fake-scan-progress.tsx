'use client';

import { useEffect, useState, useRef } from 'react';
import type { ScanStatus } from '@marketing-alpha/types';
import { cn } from '@/lib/utils';

/**
 * GhostScan OS — Fake Scan Progress (Pre-Auth Teaser)
 * ═══════════════════════════════════════════════════════
 *
 * WHAT: Simulated scan progress shown to anonymous users before the signup wall.
 * WHY:  Show enough progress to hook users before gating. The retro terminal
 *       aesthetic makes even fake progress feel exciting (Plan Section 5).
 * HOW:  Terminal-style output with [OK] prefixed lines, bevel-raised module
 *       cards, segmented progress bar. Gates after ~4 seconds.
 */

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

    FAKE_MODULES.forEach(({ delay, module }) => {
      timers.push(setTimeout(() => {
        setCompletedModules((prev) => [...prev, module]);
      }, delay));
    });

    timers.push(setTimeout(() => setProgress(12), 1600));
    timers.push(setTimeout(() => {
      setStatus('browser');
      setProgress(18);
    }, 2500));
    timers.push(setTimeout(() => setProgress(22), 4000));

    timers.push(setTimeout(() => {
      if (!gateCalledRef.current) {
        gateCalledRef.current = true;
        onGateReached();
      }
    }, 4000));

    return () => { timers.forEach(clearTimeout); };
  }, [onGateReached]);

  const currentPhaseIndex = PHASES.findIndex((p) => p.status === status);

  return (
    <div className="max-w-2xl mx-auto py-gs-8">
      <h2 className="font-system text-os-lg font-bold text-gs-ink text-center mb-gs-2">
        Scanning...
      </h2>
      <p className="font-data text-data-sm text-gs-muted text-center mb-gs-6">
        Analyzing marketing technology stack across {PHASES.length} phases
      </p>

      {/* Progress bar */}
      <div className="bevel-sunken bg-gs-paper h-[20px] mb-gs-6 p-[2px]">
        <div
          className="h-full bg-gs-red transition-all duration-500 ease-out"
          style={{ width: `${Math.max(progress, 5)}%` }}
        />
      </div>

      {/* Phase indicators */}
      <div className="flex justify-between mb-gs-8">
        {PHASES.map((phase, i) => {
          const isActive = i === currentPhaseIndex;
          const isComplete = i < currentPhaseIndex;

          return (
            <div key={phase.status} className="flex flex-col items-center gap-gs-2">
              <div
                className={cn(
                  'w-[40px] h-[40px] bevel-raised flex items-center justify-center font-system text-os-sm font-bold transition-all',
                  isComplete && 'bg-gs-terminal text-gs-ink',
                  isActive && 'bg-gs-red text-gs-ink animate-pulse',
                  !isComplete && !isActive && 'bg-gs-chrome text-gs-muted',
                )}
              >
                {isComplete ? '✓' : phase.number}
              </div>
              <span className={cn(
                'font-data text-data-xs',
                isActive ? 'text-gs-red' : 'text-gs-muted',
              )}>
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Completed modules list */}
      {completedModules.length > 0 && (
        <div className="space-y-gs-2">
          <h3 className="font-system text-os-sm font-bold text-gs-ink mb-gs-2">
            Completed Modules
          </h3>
          {completedModules.map((mod) => (
            <div
              key={mod.moduleId}
              className="flex items-center justify-between bevel-raised bg-gs-chrome px-gs-4 py-gs-2"
            >
              <span className="font-data text-data-sm text-gs-ink">
                {mod.moduleId} &mdash; {mod.name}
              </span>
              <span
                className={cn(
                  'font-data text-data-sm font-bold',
                  mod.score >= 70 ? 'text-gs-terminal' : mod.score >= 40 ? 'text-gs-warning' : 'text-gs-critical',
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
