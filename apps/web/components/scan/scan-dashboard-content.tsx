'use client';

import { useRef, useState, useMemo, useCallback } from 'react';
import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';
import { useWindowManager } from '@/lib/window-manager';
import { CATEGORY_META, MODULE_NAMES } from './slide-sidebar';
import { OverviewSlide } from './overview-slide';
import { ModuleSlide } from './module-slide';
import { PaidSlides } from './paid-slides';
import { cn } from '@/lib/utils';

/**
 * GhostScan OS — Scan Dashboard Content
 * ═══════════════════════════════════════════
 *
 * Reusable dashboard content — category tabs, module slides, status bar.
 * Used by both BentoDashboard (route fallback) and ScanReportWindow (managed window).
 * Does NOT include any window chrome — the caller provides that.
 */

const PAID_MODULES = new Set(['M42', 'M43', 'M44', 'M45']);
const HIDDEN_MODULES = new Set(['M41']);
const GHOST_MODULES = new Set(['M09', 'M10', 'M11', 'M12']);

interface ScanDashboardContentProps {
  scan: ScanWithResults;
}

export function ScanDashboardContent({ scan }: ScanDashboardContentProps) {
  const wm = useWindowManager();
  const resultMap = useMemo(
    () => new Map<string, ModuleResult>(scan.moduleResults.map((r) => [r.moduleId, r])),
    [scan.moduleResults],
  );
  const isPaid = scan.tier === 'paid';

  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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

  const filteredModuleIds = useMemo(() => {
    if (!activeCategory) return moduleSlideIds;
    const cat = CATEGORY_META.find((c) => c.key === activeCategory);
    if (!cat) return moduleSlideIds;
    const catModules = new Set(cat.modules);
    return moduleSlideIds.filter((id) => catModules.has(id));
  }, [activeCategory, moduleSlideIds]);

  const contentRef = useRef<HTMLDivElement>(null);

  const handleCategoryClick = useCallback((catId: string | null) => {
    setActiveCategory((prev) => (prev === catId ? null : catId));
  }, []);

  const handleDeclassify = useCallback(() => {
    const paymentId = `payment-${scan.id}`;
    wm.registerWindow(paymentId, {
      title: 'Checkout',
      width: 420,
      height: 300,
      variant: 'dialog',
      componentType: 'payment',
    });
    wm.openWindow(paymentId, {
      scanId: scan.id,
      domain: scan.domain,
      product: 'alpha_brief',
    });
  }, [wm, scan.id, scan.domain]);

  const handleDownloadPdf = useCallback(() => {
    window.open(`/api/reports/${scan.id}/pdf`, '_blank');
  }, [scan.id]);

  const handleAskChloe = useCallback(() => {
    wm.openWindow('chat-launcher', { scanId: scan.id });
  }, [wm, scan.id]);

  return (
    <div className="flex flex-col h-full">
      {/* Category Tab Bar */}
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

      {/* Scrollable Module Content */}
      <div ref={contentRef} className="flex-1 p-gs-4 space-y-gs-3 overflow-y-auto">
        {!activeCategory && <OverviewSlide scan={scan} />}

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

        {!activeCategory && (
          <PaidSlides scanId={scan.id} isPaid={isPaid} resultMap={resultMap} />
        )}
      </div>

      {/* Status Bar */}
      <div className="window-statusbar flex-shrink-0">
        <div className="window-statusbar-section">
          {filteredModuleIds.length} modules
        </div>
        <div className="window-statusbar-section">
          MarketingIQ™: {scan.marketingIq ?? '\u2014'}
        </div>
        {!isPaid && (
          <button
            onClick={handleDeclassify}
            className="bevel-button-primary text-os-xs"
          >
            Declassify — $9.99
          </button>
        )}
        {isPaid && (
          <div className="flex gap-gs-1">
            <button onClick={handleDownloadPdf} className="bevel-button text-os-xs">
              PDF
            </button>
            <button onClick={handleAskChloe} className="bevel-button text-os-xs">
              Ask Chloe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
