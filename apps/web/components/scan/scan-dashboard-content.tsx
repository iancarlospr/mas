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
import { M12Slide } from './slides/m12-slide';
import { M40Slide } from './slides/m40-slide';
// Cat 2: Analytics & Measurement
import { M05Slide } from './slides/m05-slide';
import { M06Slide } from './slides/m06-slide';
import { M06bSlide } from './slides/m06b-slide';
import { M08Slide } from './slides/m08-slide';
import { M09Slide } from './slides/m09-slide';
// Cat 3: Performance & Experience
import { M03Slide } from './slides/m03-slide';
import { M10Slide } from './slides/m10-slide';
import { M11Slide } from './slides/m11-slide';
import { M13Slide } from './slides/m13-slide';
import { M14Slide } from './slides/m14-slide';
// Cat 4: SEO & Content
import { M04Slide } from './slides/m04-slide';
import { M15Slide } from './slides/m15-slide';
import { M26Slide } from './slides/m26-slide';
import { M34Slide } from './slides/m34-slide';
import { M39Slide } from './slides/m39-slide';
// Cat 5: Paid Media
import { M21Slide } from './slides/m21-slide';
import { M28Slide } from './slides/m28-slide';
import { M29Slide } from './slides/m29-slide';
// Cat 6: MarTech & Infrastructure
import { M02Slide } from './slides/m02-slide';
import { M07Slide } from './slides/m07-slide';
import { M20Slide } from './slides/m20-slide';
// Cat 7: Brand & Digital Presence
import { M16Slide } from './slides/m16-slide';
import { M17Slide } from './slides/m17-slide';
import { M18M19Slide } from './slides/m18-m19-slide';
import { M22M23Slide } from './slides/m22-m23-slide';
import { M37Slide } from './slides/m37-slide';
import { M38Slide } from './slides/m38-slide';
// Cat 8: Market Intelligence
import { M24Slide } from './slides/m24-slide';
import { M25Slide } from './slides/m25-slide';
import { M27Slide } from './slides/m27-slide';
import { M30Slide } from './slides/m30-slide';
import { M31Slide } from './slides/m31-slide';
import { M33Slide } from './slides/m33-slide';
import { M36Slide } from './slides/m36-slide';
import { ModuleSlide } from './module-slide';
import { M45Slide } from './slides/m45-slide';
import { M43Slide } from './slides/m43-slide';
import { ClosingSlide } from './slides/closing-slide';
import { cn } from '@/lib/utils';

/**
 * GhostScan OS — Scan Dashboard Content
 * ═══════════════════════════════════════════
 *
 * Reusable dashboard content — category tabs, module slides, status bar.
 * Used by both BentoDashboard (route fallback) and ScanReportWindow (managed window).
 * Does NOT include any window chrome — the caller provides that.
 */

const PAID_MODULES = new Set(['M43', 'M44', 'M45']);
const HIDDEN_MODULES = new Set(['M41', 'M42']);
// Modules rendered via custom or AIModuleSlide (not the generic ModuleSlide)
const CUSTOM_SLIDE_MODULES = new Set([
  'M01', 'M12', 'M40',
  'M05', 'M06', 'M06b', 'M08', 'M09',
  'M03', 'M10', 'M11', 'M13', 'M14',
  'M04', 'M15', 'M26', 'M34', 'M39',
  'M21', 'M28', 'M29',
  'M02', 'M07', 'M20',
  'M16', 'M17', 'M18', 'M19', 'M22', 'M23', 'M37', 'M38',
  'M24', 'M25', 'M27', 'M30', 'M31', 'M33', 'M36',
]);

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

  // M41 AI scores — used instead of checkpoint scores on slides
  const aiScores = useMemo(() => {
    const m41 = resultMap.get('M41');
    const sums = (m41?.data?.['moduleSummaries'] as Record<string, { module_score?: number }> | undefined) ?? {};
    const map = new Map<string, number>();
    for (const [moduleId, summary] of Object.entries(sums)) {
      if (summary.module_score != null) map.set(moduleId, summary.module_score);
    }
    return map;
  }, [resultMap]);

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
    window.open(`/api/reports/${scan.id}/prd`, '_blank');
  }, [scan.id]);

  const handleDownloadPresentation = useCallback(() => {
    window.open(`/api/reports/${scan.id}/presentation`, '_blank');
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
        {!activeCategory && isPaid && <M45Slide scan={scan} />}
        {!activeCategory && <FindingsSlide scan={scan} />}
        {/* ── Category 1: Security & Compliance ── */}
        {!activeCategory && <CategoryIntroSlide scan={scan} category="security_compliance" />}
        {!activeCategory && <M01Slide scan={scan} />}
        {!activeCategory && <M12Slide scan={scan} />}
        {!activeCategory && <M40Slide scan={scan} />}

        {/* ── Category 2: Analytics & Measurement ── */}
        {!activeCategory && <CategoryIntroSlide scan={scan} category="analytics_measurement" />}
        {!activeCategory && <M05Slide scan={scan} />}
        {!activeCategory && <M06Slide scan={scan} />}
        {!activeCategory && <M06bSlide scan={scan} />}
        {!activeCategory && <M08Slide scan={scan} />}
        {!activeCategory && <M09Slide scan={scan} />}

        {/* ── Category 3: Performance & Experience ── */}
        {!activeCategory && <CategoryIntroSlide scan={scan} category="performance_experience" />}
        {!activeCategory && <M03Slide scan={scan} />}
        {!activeCategory && <M13Slide scan={scan} />}
        {!activeCategory && <M14Slide scan={scan} />}
        {!activeCategory && <M10Slide scan={scan} />}
        {!activeCategory && <M11Slide scan={scan} />}

        {/* ── Category 4: SEO & Content ── */}
        {!activeCategory && <CategoryIntroSlide scan={scan} category="seo_content" />}
        {!activeCategory && <M04Slide scan={scan} />}
        {!activeCategory && <M15Slide scan={scan} />}
        {!activeCategory && <M26Slide scan={scan} />}
        {!activeCategory && <M34Slide scan={scan} />}
        {!activeCategory && <M39Slide scan={scan} />}

        {/* ── Category 5: Paid Media ── */}
        {!activeCategory && <CategoryIntroSlide scan={scan} category="paid_media" />}
        {!activeCategory && <M21Slide scan={scan} />}
        {!activeCategory && <M28Slide scan={scan} />}
        {!activeCategory && <M29Slide scan={scan} />}

        {/* ── Category 6: MarTech & Infrastructure ── */}
        {!activeCategory && <CategoryIntroSlide scan={scan} category="martech_infrastructure" />}
        {!activeCategory && <M02Slide scan={scan} />}
        {!activeCategory && <M07Slide scan={scan} />}
        {!activeCategory && <M20Slide scan={scan} />}

        {/* ── Category 7: Brand & Digital Presence ── */}
        {!activeCategory && <CategoryIntroSlide scan={scan} category="brand_presence" />}
        {!activeCategory && <M16Slide scan={scan} />}
        {!activeCategory && <M17Slide scan={scan} />}
        {!activeCategory && <M18M19Slide scan={scan} />}
        {!activeCategory && <M22M23Slide scan={scan} />}
        {!activeCategory && <M37Slide scan={scan} />}
        {!activeCategory && <M38Slide scan={scan} />}

        {/* ── Category 8: Market Intelligence ── */}
        {!activeCategory && <CategoryIntroSlide scan={scan} category="market_intelligence" />}
        {!activeCategory && <M24Slide scan={scan} />}
        {!activeCategory && <M25Slide scan={scan} />}
        {!activeCategory && <M27Slide scan={scan} />}
        {!activeCategory && <M30Slide scan={scan} />}
        {!activeCategory && <M31Slide scan={scan} />}
        {!activeCategory && <M33Slide scan={scan} />}
        {!activeCategory && <M36Slide scan={scan} />}

        {/* ── M43: Remediation Roadmap ── */}
        {!activeCategory && isPaid && <M43Slide scan={scan} />}

        {/* ── Closing slide (back cover) ── */}
        {!activeCategory && <ClosingSlide scan={scan} />}

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

        {!isActiveCategoryLocked && filteredModuleIds.filter((mId) => !CUSTOM_SLIDE_MODULES.has(mId)).map((mId) => (
          <ModuleSlide
            key={mId}
            moduleId={mId}
            moduleName={MODULE_NAMES[mId] ?? mId}
            result={resultMap.get(mId) ?? null}
            scanId={scan.id}
            isPaid={!isPaid && PAID_MODULES.has(mId)}
            isGhostModule={GHOST_MODULES.has(mId)}
            aiScore={aiScores.get(mId)}
          />
        ))}

      </div>

      {/* Status Bar */}
      <div className="window-statusbar flex-shrink-0">
        <div className="window-statusbar-section">
          {scan.moduleResults.filter((r) => r.status === 'success' || r.status === 'partial').length} modules analyzed
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
          <div className="flex gap-3 items-center">
            <button onClick={handleDownloadPresentation} className="text-gs-base hover:text-gs-bright transition-colors" style={{ fontSize: '11px', fontFamily: 'var(--font-system)' }}>
              Slides &darr;
            </button>
            <span className="text-gs-mid" style={{ fontSize: '11px' }}>&middot;</span>
            <button onClick={handleDownloadPdf} className="text-gs-base hover:text-gs-bright transition-colors" style={{ fontSize: '11px', fontFamily: 'var(--font-system)' }}>
              PRD &darr;
            </button>
            <span className="text-gs-mid" style={{ fontSize: '11px' }}>&middot;</span>
            <button onClick={handleAskChloe} className="text-gs-base hover:text-gs-bright transition-colors" style={{ fontSize: '11px', fontFamily: 'var(--font-system)' }}>
              Ask Chloe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
