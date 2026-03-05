'use client';

import { useRef, useState, useMemo, useCallback } from 'react';
import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';
import { useWindowManager } from '@/lib/window-manager';
import { CATEGORY_META, MODULE_NAMES, FREE_CATEGORIES } from './slide-sidebar';
import { TitleSlide } from './slides/title-slide';
import { VerdictSlide } from './slides/verdict-slide';
import { OverviewExecSlide } from './slides/overview-exec-slide';
import { FindingsSlide } from './slides/findings-slide';
import { CategoryIntroSlide } from './slides/category-intro-slide';
import { M01Slide } from './slides/m01-slide';
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

// FREE_CATEGORIES imported from slide-sidebar.tsx

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
      // Free tier: only show MarTech & Infrastructure modules
      if (!isPaid && !FREE_CATEGORIES.has(cat.key)) continue;
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
  }, [resultMap, isPaid]);

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

  // Is the active category locked (non-free, non-paid scan)?
  const isActiveCategoryLocked = !isPaid
    && activeCategory != null
    && !FREE_CATEGORIES.has(activeCategory)
    && !CATEGORY_META.find((c) => c.key === activeCategory)?.paidOnly;

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
          const isLocked = !isPaid && !FREE_CATEGORIES.has(cat.key);
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
                isLocked && 'opacity-60',
              )}
              onClick={() => handleCategoryClick(cat.key)}
            >
              {isLocked && (
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              )}
              <span>{cat.label}</span>
              {!isLocked && avgScore != null && (
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
      <div ref={contentRef} className="flex-1 p-gs-4 space-y-gs-3 overflow-y-auto" style={{ background: '#ffffff' }}>
        {!activeCategory && <TitleSlide scan={scan} />}
        {!activeCategory && <VerdictSlide scan={scan} />}
        {!activeCategory && <OverviewExecSlide scan={scan} />}
        {!activeCategory && <FindingsSlide scan={scan} />}
        {!activeCategory && <CategoryIntroSlide scan={scan} category="security_compliance" />}
        {!activeCategory && <M01Slide scan={scan} />}

        {/* Locked category placeholder */}
        {isActiveCategoryLocked && (
          <div className="module-panel relative w-full overflow-hidden">
            <div className="flex flex-col items-center justify-center py-16 px-gs-6 text-center">
              <svg className="w-10 h-10 text-gs-muted/40 mb-gs-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <p className="font-system text-os-sm font-bold text-gs-light mb-gs-1">
                {CATEGORY_META.find((c) => c.key === activeCategory)?.label ?? 'Category'} — Locked
              </p>
              <p className="font-data text-data-xs text-gs-muted mb-gs-4 max-w-xs">
                This category requires a full scan. Your free scan includes MarTech & Infrastructure only.
              </p>
              <button
                onClick={handleDeclassify}
                className="bevel-button-primary text-os-sm"
              >
                Unlock All Modules — from $24.99
              </button>
            </div>
          </div>
        )}

        {!isActiveCategoryLocked && filteredModuleIds.map((mId) => (
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
            Unlock — from $24.99
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
