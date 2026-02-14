'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ModuleResult, ScoreCategory } from '@marketing-alpha/types';
import { getTrafficLight } from '@marketing-alpha/types';
import { cn } from '@/lib/utils';
import { TRAFFIC_LIGHT_COLORS } from '@/lib/chart-config';

/* ── Category grouping ─────────────────────────────────────────── */

export const CATEGORY_META: {
  key: ScoreCategory | 'overview' | 'paid_executive' | 'paid_roi' | 'paid_roadmap' | 'paid_costcutter';
  label: string;
  modules: string[];
  paidOnly?: boolean;
}[] = [
  { key: 'overview', label: 'Overview', modules: ['overview'] },
  { key: 'analytics_integrity', label: 'Analytics Integrity', modules: ['M05', 'M08', 'M09'] },
  { key: 'paid_media_attribution', label: 'Paid Media', modules: ['M06', 'M06b', 'M21', 'M28', 'M29'] },
  { key: 'performance_ux', label: 'Performance & UX', modules: ['M03', 'M13', 'M14'] },
  { key: 'compliance_security', label: 'Compliance & Security', modules: ['M01', 'M10', 'M11', 'M12'] },
  { key: 'martech_efficiency', label: 'MarTech Efficiency', modules: ['M07', 'M20'] },
  { key: 'seo_content', label: 'SEO & Content', modules: ['M04', 'M15', 'M16', 'M34', 'M35', 'M40'] },
  { key: 'market_position', label: 'Market Position', modules: ['M24', 'M25', 'M26', 'M27', 'M30', 'M31', 'M32', 'M33', 'M36', 'M37', 'M38', 'M39'] },
  { key: 'digital_presence', label: 'Digital Presence', modules: ['M02', 'M17', 'M18', 'M19', 'M22', 'M23'] },
  { key: 'paid_executive', label: 'Executive Brief', modules: ['M42'], paidOnly: true },
  { key: 'paid_roi', label: 'ROI Analysis', modules: ['M44'], paidOnly: true },
  { key: 'paid_roadmap', label: 'Remediation Roadmap', modules: ['M43'], paidOnly: true },
  { key: 'paid_costcutter', label: 'Cost Cutter', modules: ['M45'], paidOnly: true },
];

export const MODULE_NAMES: Record<string, string> = {
  M01: 'DNS & Security', M02: 'CMS & Infrastructure', M03: 'Performance',
  M04: 'Page Metadata', M05: 'Analytics', M06: 'Paid Media',
  M06b: 'PPC Landing Audit', M07: 'MarTech', M08: 'Tag Governance',
  M09: 'Behavioral Intel', M10: 'Accessibility', M11: 'Console Errors',
  M12: 'Compliance', M13: 'Perf & Carbon', M14: 'Mobile & Responsive',
  M15: 'Social & Sharing', M16: 'PR & Media', M17: 'Careers & HR',
  M18: 'Investor Relations', M19: 'Support', M20: 'Ecommerce/SaaS',
  M21: 'Ad Library', M22: 'News Sentiment', M23: 'Social Sentiment',
  M24: 'Monthly Visits', M25: 'Traffic by Country', M26: 'Rankings',
  M27: 'Paid Traffic Cost', M28: 'Top Paid Keywords', M29: 'Competitors',
  M30: 'Traffic Sources', M31: 'Domain Trust', M32: 'Mobile vs Desktop',
  M33: 'Brand Search', M34: 'Losing Keywords', M35: 'Bounce Rate',
  M36: 'Google Shopping', M37: 'Review Velocity', M38: 'Local Pack',
  M39: 'Business Profile', M40: 'Sitemap & Indexing',
  M42: 'Executive Brief', M43: 'Remediation Roadmap',
  M44: 'ROI Analysis', M45: 'Cost Cutter',
};

/* ── Sidebar ───────────────────────────────────────────────────── */

interface SlideSidebarProps {
  resultMap: Map<string, ModuleResult>;
  isPaid: boolean;
  /** Currently visible slide ID (set by IntersectionObserver from parent) */
  activeSlideId: string;
  onNavigate: (slideId: string) => void;
}

export function SlideSidebar({ resultMap, isPaid, activeSlideId, onNavigate }: SlideSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="scan-sidebar-toggle fixed top-20 left-4 z-50 lg:hidden bg-white border border-border rounded-lg p-2 shadow-md"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle sidebar"
      >
        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          {mobileOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          )}
        </svg>
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav
        className={cn(
          'scan-sidebar fixed top-0 left-0 h-screen w-60 bg-white border-r border-border/60 overflow-y-auto z-50 transition-transform duration-200',
          'lg:sticky lg:top-0 lg:translate-x-0 lg:z-10',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="py-4 px-3 space-y-1">
          {CATEGORY_META.map((cat) => {
            // Filter out modules with no results (except paid sections)
            const visibleModules = cat.modules.filter((mId) => {
              if (mId === 'overview') return true;
              if (cat.paidOnly) return true;
              const r = resultMap.get(mId);
              return r && r.status !== 'skipped';
            });

            if (visibleModules.length === 0) return null;

            const isLockedSection = cat.paidOnly && !isPaid;

            return (
              <div key={cat.key} className="mb-2">
                {/* Category header */}
                <div
                  className={cn(
                    'px-3 py-1.5 text-[12px] font-heading font-600 uppercase tracking-wider',
                    isLockedSection ? 'text-muted/50' : 'text-muted',
                  )}
                >
                  {isLockedSection && (
                    <svg className="w-3 h-3 inline-block mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  )}
                  {cat.label}
                </div>

                {/* Module items */}
                {!cat.paidOnly &&
                  visibleModules.map((mId) => {
                    const slideId = mId === 'overview' ? 'slide-overview' : `slide-${mId}`;
                    const isActive = activeSlideId === slideId;
                    const result = resultMap.get(mId);
                    const score = result?.score ?? null;
                    const light = score != null ? getTrafficLight(score) : undefined;
                    const dotColor = light
                      ? TRAFFIC_LIGHT_COLORS[light === 'yellow' ? 'amber' : light]
                      : undefined;

                    return (
                      <button
                        key={mId}
                        onClick={() => {
                          onNavigate(slideId);
                          setMobileOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors text-sm',
                          isActive
                            ? 'bg-accent/10 border-l-[3px] border-accent font-600 pl-[9px]'
                            : 'hover:bg-slate-50 border-l-[3px] border-transparent pl-[9px]',
                        )}
                      >
                        {mId !== 'overview' && (
                          <span className="text-[11px] font-mono text-muted w-8 flex-shrink-0">
                            {mId}
                          </span>
                        )}
                        <span className={cn(
                          'flex-1 truncate font-body',
                          score == null && mId !== 'overview' ? 'font-400 text-muted' : 'font-500 text-primary',
                        )}>
                          {mId === 'overview' ? 'MarketingIQ Score' : (MODULE_NAMES[mId] ?? mId)}
                        </span>
                        {score != null && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-xs font-mono tabular-nums text-muted">{score}</span>
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: dotColor }}
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/* ── Scroll-sync hook ──────────────────────────────────────────── */

/**
 * Uses IntersectionObserver to track which slide is currently most visible.
 * Returns the active slide element ID.
 */
export function useSlideScrollSync(containerRef: React.RefObject<HTMLElement | null>) {
  const [activeSlideId, setActiveSlideId] = useState('slide-overview');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry with highest intersection ratio
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        }
        if (best && best.intersectionRatio > 0.3) {
          setActiveSlideId(best.target.id);
        }
      },
      {
        root: null, // viewport
        threshold: [0.3, 0.5, 0.7],
      },
    );

    const slides = container.querySelectorAll('.slide-card');
    slides.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [containerRef]);

  const scrollToSlide = useCallback((slideId: string) => {
    const el = document.getElementById(slideId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return { activeSlideId, scrollToSlide };
}
