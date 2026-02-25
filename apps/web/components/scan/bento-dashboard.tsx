'use client';

import { useRef, useState, useMemo, useCallback } from 'react';
import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';
import Link from 'next/link';
import { Window } from '@/components/os/window';
import { ChloeReactionsProvider } from '@/components/chloe/chloe-reactions';
import { RadioPlayer } from '@/components/os/radio-player';
import { CATEGORY_META, MODULE_NAMES } from './slide-sidebar';
import { OverviewSlide } from './overview-slide';
import { ModuleSlide } from './module-slide';
import { PaidSlides } from './paid-slides';
import { cn } from '@/lib/utils';

/**
 * GhostScan OS — Desktop Dashboard
 * ═══════════════════════════════════════
 *
 * WHAT: The main post-scan experience, now rendered as a full Desktop OS
 *       environment with windowed dashboard, Chloé screenmate, and taskbar.
 * WHY:  Replaces the old sidebar + card grid layout with the GhostScan OS
 *       concept. The desktop IS the app (Plan Sections 3, 6).
 * HOW:  Desktop component provides the OS shell (menu bar, taskbar, icons,
 *       CRT effects). Dashboard content lives inside a Window component
 *       with category tabs replacing the old sidebar. Module slides render
 *       as ModulePanels within the window's scrollable content area.
 *
 * Preserved: All data fetching, module rendering, category ordering,
 * paid/free tier logic. Changed: visual wrapper only.
 */

const PAID_MODULES = new Set(['M42', 'M43', 'M44', 'M45']);
const HIDDEN_MODULES = new Set(['M41']);

/** Ghost modules that get the special Chloé treatment */
const GHOST_MODULES = new Set(['M09', 'M10', 'M11', 'M12']);

interface BentoDashboardProps {
  scan: ScanWithResults;
}

export function BentoDashboard({ scan }: BentoDashboardProps) {
  const resultMap = useMemo(
    () => new Map<string, ModuleResult>(scan.moduleResults.map((r) => [r.moduleId, r])),
    [scan.moduleResults],
  );
  const isPaid = scan.tier === 'paid';

  /* ── Category tab state ──────────────────────────────────── */
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [radioOpen, setRadioOpen] = useState(false);

  /* ── Gather visible module IDs in category order ─────────── */
  const moduleSlideIds = useMemo(() => {
    const ids: string[] = [];
    for (const cat of CATEGORY_META) {
      if (cat.paidOnly) continue;
      for (const mId of cat.modules) {
        if (mId === 'overview') continue;
        if (HIDDEN_MODULES.has(mId)) continue;
        const r = resultMap.get(mId);
        if (r && r.status !== 'skipped') {
          ids.push(mId);
        }
      }
    }
    return ids;
  }, [resultMap]);

  /* ── Filter modules by active category ───────────────────── */
  const filteredModuleIds = useMemo(() => {
    if (!activeCategory) return moduleSlideIds;
    const cat = CATEGORY_META.find((c) => c.key === activeCategory);
    if (!cat) return moduleSlideIds;
    const catModules = new Set(cat.modules);
    return moduleSlideIds.filter((id) => catModules.has(id));
  }, [activeCategory, moduleSlideIds]);

  const contentRef = useRef<HTMLDivElement>(null);

  /* ── Scroll to category ──────────────────────────────────── */
  const handleCategoryClick = useCallback((catId: string | null) => {
    setActiveCategory((prev) => (prev === catId ? null : catId));
  }, []);

  return (
    <ChloeReactionsProvider>
        {/* ── Dashboard Content ────────────────────────────── */}
        <Window
          id="dashboard"
          title={`📊 Dashboard — ${scan.domain} — Scanned ${new Date(scan.createdAt).toLocaleDateString()}`}
          isActive
          isMaximized
          showStatusBar
          statusBarContent={
            <>
              <div className="window-statusbar-section">
                {filteredModuleIds.length} modules
              </div>
              <div className="window-statusbar-section">
                MarketingIQ™: {scan.marketingIq ?? '—'}
              </div>
              {!isPaid && (
                <Link
                  href={`/report/${scan.id}`}
                  className="bevel-button-primary text-os-xs"
                >
                  🔓 Declassify — $9.99
                </Link>
              )}
              {isPaid && (
                <div className="flex gap-gs-1">
                  <Link href={`/report/${scan.id}`} className="bevel-button text-os-xs">
                    📊 Report
                  </Link>
                  <Link href={`/chat/${scan.id}`} className="bevel-button text-os-xs">
                    💬 Ask Chloé
                  </Link>
                </div>
              )}
            </>
          }
        >
          {/* ── Category Tab Bar (replaces old sidebar) ────── */}
          <div className="bg-gs-chrome border-b border-gs-chrome-dark px-gs-2 py-gs-1 flex items-center gap-gs-1 overflow-x-auto flex-shrink-0">
            <button
              className={cn(
                'bevel-button text-os-xs whitespace-nowrap',
                !activeCategory && 'bevel-sunken bg-gs-paper',
              )}
              onClick={() => handleCategoryClick(null)}
            >
              All
            </button>
            {CATEGORY_META.filter((c) => !c.paidOnly).map((cat) => {
              const isActive = activeCategory === cat.key;
              /* Calculate category score for badge */
              const catModules = cat.modules.filter(
                (m) => m !== 'overview' && !HIDDEN_MODULES.has(m),
              );
              const scores = catModules
                .map((m) => resultMap.get(m)?.score)
                .filter((s): s is number => s != null);
              const avgScore =
                scores.length > 0
                  ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                  : null;

              return (
                <button
                  key={cat.key}
                  className={cn(
                    'bevel-button text-os-xs whitespace-nowrap flex items-center gap-gs-1',
                    isActive && 'bevel-sunken bg-gs-paper',
                  )}
                  onClick={() => handleCategoryClick(cat.key)}
                >
                  <span>{cat.label}</span>
                  {avgScore != null && (
                    <>
                      <span
                        className={cn(
                          'font-data font-bold',
                          avgScore >= 70
                            ? 'text-gs-terminal'
                            : avgScore >= 40
                              ? 'text-gs-warning'
                              : 'text-gs-critical',
                        )}
                      >
                        {avgScore}
                      </span>
                      <span
                        className={cn(
                          'traffic-dot',
                          avgScore >= 70
                            ? 'traffic-dot-green'
                            : avgScore >= 40
                              ? 'traffic-dot-amber'
                              : 'traffic-dot-red',
                        )}
                      />
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Scrollable Module Content ───────────────────── */}
          <div ref={contentRef} className="p-gs-4 space-y-gs-3 overflow-y-auto">
            {/* Overview (always first) */}
            {!activeCategory && <OverviewSlide scan={scan} />}

            {/* Module slides */}
            {filteredModuleIds.map((mId) => (
              <ModuleSlide
                key={mId}
                moduleId={mId}
                moduleName={MODULE_NAMES[mId] ?? mId}
                result={resultMap.get(mId) ?? null}
                scanId={scan.id}
                isPaid={!isPaid && PAID_MODULES.has(mId)}
                isGhostModule={GHOST_MODULES.has(mId)}
              />
            ))}

            {/* Paid synthesis slides */}
            {!activeCategory && (
              <PaidSlides scanId={scan.id} isPaid={isPaid} resultMap={resultMap} />
            )}
          </div>
        </Window>

        {/* ── Radio.exe Floating Window ───────────────────────── */}
        {radioOpen && (
          <div className="fixed bottom-[60px] right-gs-4 z-[600]">
            <RadioPlayer onClose={() => setRadioOpen(false)} />
          </div>
        )}
    </ChloeReactionsProvider>
  );
}
