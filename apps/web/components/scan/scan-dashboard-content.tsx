'use client';

import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import type { ScanWithResults } from '@marketing-alpha/types';
import { useWindowManager } from '@/lib/window-manager';
import { analytics } from '@/lib/analytics';
import { FREE_CATEGORIES } from './slide-sidebar';
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
import { M45Slide } from './slides/m45-slide';
import { M43Slide } from './slides/m43-slide';
import { ClosingSlide } from './slides/closing-slide';
import { cn } from '@/lib/utils';

/**
 * GhostScan OS — Scan Dashboard Content
 * ═══════════════════════════════════════════
 *
 * Reusable dashboard content — scroll-nav tabs, module slides, status bar.
 * Used by both BentoDashboard (route fallback) and ScanReportWindow (managed window).
 * Does NOT include any window chrome — the caller provides that.
 */

// ── Nav tab definitions ─────────────────────────────────────────
interface NavTab {
  key: string;
  label: string;
  targetId: string;
  paidOnly?: boolean;
  /** Category key for score lookup (matches marketingIqResult.categories) */
  categoryKey?: string;
}

const NAV_TABS: NavTab[] = [
  { key: 'about', label: 'About', targetId: 'nav-about' },
  { key: 'stack-analyzer', label: 'Stack', targetId: 'nav-stack-analyzer', paidOnly: true },
  { key: 'findings', label: 'Findings', targetId: 'nav-findings' },
  { key: 'security', label: 'Security', targetId: 'nav-security', categoryKey: 'security_compliance' },
  { key: 'analytics', label: 'Analytics', targetId: 'nav-analytics', categoryKey: 'analytics_measurement' },
  { key: 'performance', label: 'Performance', targetId: 'nav-performance', categoryKey: 'performance_experience' },
  { key: 'seo', label: 'SEO', targetId: 'nav-seo', categoryKey: 'seo_content' },
  { key: 'paid-media', label: 'Paid', targetId: 'nav-paid-media', categoryKey: 'paid_media' },
  { key: 'martech', label: 'MarTech', targetId: 'nav-martech', categoryKey: 'martech_infrastructure' },
  { key: 'brand', label: 'Brand', targetId: 'nav-brand', categoryKey: 'brand_presence' },
  { key: 'market-intel', label: 'Market', targetId: 'nav-market-intel', categoryKey: 'market_intelligence' },
  { key: 'prd', label: 'PRD', targetId: 'nav-prd', paidOnly: true },
];

interface ScanDashboardContentProps {
  scan: ScanWithResults;
}

export function ScanDashboardContent({ scan }: ScanDashboardContentProps) {
  const wm = useWindowManager();
  const isPaid = scan.tier === 'paid';

  // AI synthesis category scores — single source of truth
  const categoryScoreMap = useMemo(() => {
    const cats = scan.marketingIqResult?.categories as { category: string; score: number }[] | undefined;
    const map = new Map<string, number>();
    if (cats) {
      for (const c of cats) map.set(c.category, c.score);
    }
    return map;
  }, [scan.marketingIqResult]);

  const contentRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [activeTabKey, setActiveTabKey] = useState('about');

  // ── Proportional slide zoom — shrinks slides like a screenshot at smaller widths ──
  const SLIDE_DESIGN_WIDTH = 1625;
  const [slideZoom, setSlideZoom] = useState(1);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setSlideZoom(w > 0 ? Math.min(1, w / SLIDE_DESIGN_WIDTH) : 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Visible tabs based on paid status
  const visibleTabs = useMemo(
    () => NAV_TABS.filter((t) => !t.paidOnly || isPaid),
    [isPaid],
  );

  // ── Analytics: report viewed on mount ──
  useEffect(() => {
    analytics.reportViewed(scan.id, scan.domain ?? '', scan.tier);
  }, [scan.id, scan.domain, scan.tier]);

  // ── Scroll to section on tab click ──
  const handleTabClick = useCallback((tab: NavTab) => {
    const container = contentRef.current;
    if (!container) return;
    const el = container.querySelector(`#${tab.targetId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveTabKey(tab.key);
    analytics.reportTabClicked(scan.id, tab.key);
  }, [scan.id]);

  // ── IntersectionObserver — track which section is visible ──
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const anchors = visibleTabs
      .map((t) => container.querySelector(`#${t.targetId}`))
      .filter((el): el is Element => el != null);

    if (anchors.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first intersecting entry (topmost visible section)
        let topEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
            topEntry = entry;
          }
        }
        if (topEntry) {
          const id = topEntry.target.id;
          const tab = visibleTabs.find((t) => t.targetId === id);
          if (tab) setActiveTabKey(tab.key);
        }
      },
      {
        root: container,
        rootMargin: '-10% 0px -60% 0px',
        threshold: 0,
      },
    );

    for (const anchor of anchors) observer.observe(anchor);
    return () => observer.disconnect();
  }, [visibleTabs, isPaid]);

  // ── Analytics: track individual slide visibility (fires once per slide) ──
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const viewedSlides = new Set<string>();
    const slideCards = container.querySelectorAll('.slide-card');
    if (slideCards.length === 0) return;

    const slideObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          // Use data-slide-id if present, otherwise fallback to index
          const slideId = el.dataset.slideId ?? el.id ?? `slide-${Array.from(slideCards).indexOf(el)}`;
          if (!viewedSlides.has(slideId)) {
            viewedSlides.add(slideId);
            analytics.slideViewed(scan.id, slideId);
          }
        }
      },
      { root: container, threshold: 0.3 },
    );

    for (const card of slideCards) slideObserver.observe(card);
    return () => slideObserver.disconnect();
  }, [scan.id, isPaid]);

  // ── Analytics: scroll depth milestones (25%, 50%, 75%, 100%) ──
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const firedDepths = new Set<number>();
    const milestones = [25, 50, 75, 100];

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) return;
      const pct = (scrollTop / maxScroll) * 100;

      for (const m of milestones) {
        if (pct >= m && !firedDepths.has(m)) {
          firedDepths.add(m);
          analytics.reportScrollDepth(scan.id, m);
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scan.id]);

  // ── Score helper — uses the same synthesis scores as the title slide circle ──
  const getCategoryScore = useCallback((tab: NavTab): number | null => {
    if (!tab.categoryKey) return null;
    const score = categoryScoreMap.get(tab.categoryKey);
    return score != null ? Math.round(score) : null;
  }, [categoryScoreMap]);

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
    analytics.pdfDownloaded(scan.id, scan.domain ?? '', 'status_bar');
    window.open(`/api/reports/${scan.id}/prd`, '_blank');
  }, [scan.id, scan.domain]);

  const handleAskChloe = useCallback(() => {
    wm.openWindow('chat-launcher', { scanId: scan.id });
  }, [wm, scan.id]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Category Nav Bar ── */}
      <div
        ref={tabBarRef}
        data-no-print
        className="flex items-stretch flex-shrink-0"
        style={{
          height: 32,
          background: 'oklch(0.10 0.01 340 / 0.9)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid oklch(0.20 0.02 340 / 0.6)',
        }}
      >
        {visibleTabs.map((tab) => {
          const isActive = activeTabKey === tab.key;
          const isLocked = !isPaid && tab.categoryKey != null && !FREE_CATEGORIES.has(tab.categoryKey);
          const avgScore = getCategoryScore(tab);
          const dotColor = avgScore != null
            ? avgScore >= 70 ? 'var(--gs-terminal)' : avgScore >= 40 ? 'var(--gs-warning)' : 'var(--gs-critical)'
            : undefined;

          return (
            <button
              key={tab.key}
              data-tab-key={tab.key}
              onClick={() => handleTabClick(tab)}
              className={cn(
                'relative flex-1 flex items-center justify-center gap-1 transition-colors',
                'font-data text-[10px] tracking-[0.04em] uppercase whitespace-nowrap',
                isActive
                  ? 'text-gs-light'
                  : 'text-gs-mid hover:text-gs-light',
                isLocked && 'opacity-35',
              )}
            >
              {isLocked && (
                <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              )}
              <span>{tab.label}</span>
              {!isLocked && dotColor && (
                <span
                  className="inline-block w-1 h-1 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dotColor }}
                />
              )}
              {/* Active indicator */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-1/4 right-1/4"
                  style={{ height: 2, background: 'var(--gs-base)', borderRadius: '1px 1px 0 0' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Scrollable Module Content ── */}
      <div ref={contentRef} className="flex-1 overflow-y-auto" style={{ background: '#ffffff' }}>
        <div
          className="p-gs-4 space-y-gs-3"
          style={{
            zoom: slideZoom,
            width: slideZoom < 1 ? `${100 / slideZoom}%` : undefined,
          }}
        >
        <TitleSlide scan={scan} />
        <VerdictSlide scan={scan} />
        <div id="nav-about">
          <OverviewExecSlide scan={scan} />
        </div>

        {isPaid && (
          <div id="nav-stack-analyzer">
            <M45Slide scan={scan} />
          </div>
        )}

        <div id="nav-findings">
          <FindingsSlide scan={scan} />
        </div>

        {/* ── Category 1: Security & Compliance ── */}
        <div id="nav-security">
          <CategoryIntroSlide scan={scan} category="security_compliance" />
        </div>
        <M01Slide scan={scan} />
        <M12Slide scan={scan} />
        <M40Slide scan={scan} />

        {/* ── Category 2: Analytics & Measurement ── */}
        <div id="nav-analytics">
          <CategoryIntroSlide scan={scan} category="analytics_measurement" />
        </div>
        <M05Slide scan={scan} />
        <M06Slide scan={scan} />
        <M06bSlide scan={scan} />
        <M08Slide scan={scan} />
        <M09Slide scan={scan} />

        {/* ── Category 3: Performance & Experience ── */}
        <div id="nav-performance">
          <CategoryIntroSlide scan={scan} category="performance_experience" />
        </div>
        <M03Slide scan={scan} />
        <M13Slide scan={scan} />
        <M14Slide scan={scan} />
        <M10Slide scan={scan} />
        <M11Slide scan={scan} />

        {/* ── Category 4: SEO & Content ── */}
        <div id="nav-seo">
          <CategoryIntroSlide scan={scan} category="seo_content" />
        </div>
        <M04Slide scan={scan} />
        <M15Slide scan={scan} />
        <M26Slide scan={scan} />
        <M34Slide scan={scan} />
        <M39Slide scan={scan} />

        {/* ── Category 5: Paid Media ── */}
        <div id="nav-paid-media">
          <CategoryIntroSlide scan={scan} category="paid_media" />
        </div>
        <M21Slide scan={scan} />
        <M28Slide scan={scan} />
        <M29Slide scan={scan} />

        {/* ── Category 6: MarTech & Infrastructure ── */}
        <div id="nav-martech">
          <CategoryIntroSlide scan={scan} category="martech_infrastructure" />
        </div>
        <M02Slide scan={scan} />
        <M07Slide scan={scan} />
        <M20Slide scan={scan} />

        {/* ── Category 7: Brand & Digital Presence ── */}
        <div id="nav-brand">
          <CategoryIntroSlide scan={scan} category="brand_presence" />
        </div>
        <M16Slide scan={scan} />
        <M17Slide scan={scan} />
        <M18M19Slide scan={scan} />
        <M22M23Slide scan={scan} />
        <M37Slide scan={scan} />
        <M38Slide scan={scan} />

        {/* ── Category 8: Market Intelligence ── */}
        <div id="nav-market-intel">
          <CategoryIntroSlide scan={scan} category="market_intelligence" />
        </div>
        <M24Slide scan={scan} />
        <M25Slide scan={scan} />
        <M27Slide scan={scan} />
        <M30Slide scan={scan} />
        <M31Slide scan={scan} />
        <M33Slide scan={scan} />
        <M36Slide scan={scan} />

        {/* ── M43: PRD ── */}
        {isPaid && (
          <div id="nav-prd">
            <M43Slide scan={scan} />
          </div>
        )}

        {/* ── Closing slide (back cover) ── */}
        <ClosingSlide scan={scan} />
        </div>
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
            <button onClick={handleDownloadPdf} className="text-gs-base hover:text-gs-bright transition-colors" style={{ fontSize: '11px', fontFamily: 'var(--font-system)' }}>
              PRD &darr;
            </button>
            <span className="text-gs-mid" style={{ fontSize: '11px' }}>&middot;</span>
            <button onClick={handleAskChloe} className="text-gs-base hover:text-gs-bright transition-colors flex items-center gap-1" style={{ fontSize: '11px', fontFamily: 'var(--font-system)' }}>
              Ask Chlo&eacute;
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
