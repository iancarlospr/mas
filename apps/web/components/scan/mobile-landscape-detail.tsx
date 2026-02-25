'use client';

import { useCallback, useRef } from 'react';
import type { ModuleResult } from '@marketing-alpha/types';
import type { ScanWithResults } from '@marketing-alpha/types';
import { getTrafficLight } from '@marketing-alpha/types';
import { cn } from '@/lib/utils';
import { MODULE_NAMES } from './slide-sidebar';
import { ModuleSlide } from './module-slide';

/**
 * GhostScan Mobile — Landscape Detail View
 * ═══════════════════════════════════════════
 *
 * Full chart view for a single module when phone is rotated to landscape.
 * Reuses ModuleSlide directly — it already collapses to grid-cols-1 below lg
 * and all charts use ResponsiveContainer width="100%".
 * Swipe left/right to navigate between modules.
 */

const PAID_MODULES = new Set(['M42', 'M43', 'M44', 'M45']);
const GHOST_MODULES = new Set(['M09', 'M10', 'M11', 'M12']);

interface MobileLandscapeDetailProps {
  scan: ScanWithResults;
  resultMap: Map<string, ModuleResult>;
  moduleIds: string[];
  activeModuleId: string;
  onBack: () => void;
  onNavigate: (moduleId: string) => void;
  isPaid: boolean;
}

export function MobileLandscapeDetail({
  scan,
  resultMap,
  moduleIds,
  activeModuleId,
  onBack,
  onNavigate,
  isPaid,
}: MobileLandscapeDetailProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const result = resultMap.get(activeModuleId) ?? null;
  const score = result?.score ?? null;
  const light = score != null ? getTrafficLight(score) : null;
  const name = MODULE_NAMES[activeModuleId] ?? activeModuleId;
  const currentIdx = moduleIds.indexOf(activeModuleId);

  /* ── Swipe gesture handling ───────────────────────────── */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      touchStartRef.current = null;

      // Only swipe if horizontal movement > vertical (prevent scroll conflicts)
      if (Math.abs(deltaX) <= Math.abs(deltaY) || Math.abs(deltaX) < 50) return;

      if (deltaX < 0 && currentIdx < moduleIds.length - 1) {
        // Swipe left → next module
        const nextId = moduleIds[currentIdx + 1];
        if (nextId) onNavigate(nextId);
      } else if (deltaX > 0 && currentIdx > 0) {
        // Swipe right → previous module
        const prevId = moduleIds[currentIdx - 1];
        if (prevId) onNavigate(prevId);
      }
    },
    [currentIdx, moduleIds, onNavigate],
  );

  return (
    <div className="fixed inset-0 bg-gs-paper flex flex-col overflow-hidden">
      {/* ── Header (36px) ───────────────────────────────── */}
      <header className="h-[36px] flex items-center px-gs-2 bg-gs-chrome bevel-raised flex-shrink-0 z-10 gap-gs-2">
        <button onClick={onBack} className="bevel-button text-os-xs px-gs-2 py-px flex-shrink-0">
          ← Back
        </button>
        <span className="flex-1 text-center font-system text-os-sm font-bold text-gs-ink truncate">
          {name} — {score ?? '--'}
        </span>
        <span
          className={cn(
            'w-[8px] h-[8px] rounded-full flex-shrink-0',
            light === 'green' && 'bg-gs-terminal',
            light === 'yellow' && 'bg-gs-warning',
            light === 'red' && 'bg-gs-critical',
            !light && 'bg-gs-muted',
          )}
        />
        <span className="font-data text-data-xs text-gs-muted flex-shrink-0">
          {currentIdx + 1}/{moduleIds.length}
        </span>
      </header>

      {/* ── Module Content (scrollable, swipeable) ──────── */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <ModuleSlide
          moduleId={activeModuleId}
          moduleName={name}
          result={result}
          scanId={scan.id}
          isPaid={!isPaid && PAID_MODULES.has(activeModuleId)}
          isGhostModule={GHOST_MODULES.has(activeModuleId)}
        />
      </div>

      {/* ── Pagination Dots (24px) ──────────────────────── */}
      <div className="h-[24px] flex items-center justify-center gap-[4px] bg-gs-chrome flex-shrink-0 overflow-x-auto px-gs-2">
        {moduleIds.map((mId) => (
          <button
            key={mId}
            onClick={() => onNavigate(mId)}
            className={cn(
              'w-[6px] h-[6px] rounded-full flex-shrink-0 transition-colors',
              mId === activeModuleId ? 'bg-gs-red' : 'bg-gs-chrome',
            )}
            aria-label={MODULE_NAMES[mId] ?? mId}
          />
        ))}
      </div>
    </div>
  );
}
