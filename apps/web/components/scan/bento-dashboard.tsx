'use client';

import { useRef } from 'react';
import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';
import Link from 'next/link';
import { SlideSidebar, CATEGORY_META, MODULE_NAMES, useSlideScrollSync } from './slide-sidebar';
import { OverviewSlide } from './overview-slide';
import { ModuleSlide } from './module-slide';
import { PaidSlides } from './paid-slides';

const PAID_MODULES = new Set(['M42', 'M43', 'M44', 'M45', 'M46']);

/** Internal-only modules that should not get a slide card */
const HIDDEN_MODULES = new Set(['M41', 'M46']);

interface BentoDashboardProps {
  scan: ScanWithResults;
}

export function BentoDashboard({ scan }: BentoDashboardProps) {
  const resultMap = new Map<string, ModuleResult>(
    scan.moduleResults.map((r) => [r.moduleId, r]),
  );
  const isPaid = scan.tier === 'paid';
  const contentRef = useRef<HTMLDivElement>(null);
  const { activeSlideId, scrollToSlide } = useSlideScrollSync(contentRef);

  // Gather all visible module IDs in category order (skip overview + paid sections)
  const moduleSlideIds: string[] = [];
  for (const cat of CATEGORY_META) {
    if (cat.paidOnly) continue; // handled by PaidSlides
    for (const mId of cat.modules) {
      if (mId === 'overview') continue;
      if (HIDDEN_MODULES.has(mId)) continue;
      const r = resultMap.get(mId);
      if (r && r.status !== 'skipped') {
        moduleSlideIds.push(mId);
      }
    }
  }

  return (
    <div className="scan-dashboard flex min-h-screen -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Sidebar */}
      <SlideSidebar
        resultMap={resultMap}
        isPaid={isPaid}
        activeSlideId={activeSlideId}
        onNavigate={scrollToSlide}
      />

      {/* Main content area */}
      <div className="flex-1 min-w-0 lg:pl-0">
        {/* Top bar */}
        <div className="scan-topbar sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-border/40 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-heading text-sm font-700 text-primary">{scan.domain}</span>
            <span className="text-xs text-muted">
              Scanned {new Date(scan.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isPaid && (
              <Link
                href={`/report/${scan.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-highlight text-highlight-foreground px-4 py-2 text-xs font-heading font-700 hover:bg-highlight/90 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Unlock $9.99
              </Link>
            )}
            {isPaid && (
              <>
                <Link
                  href={`/report/${scan.id}`}
                  className="inline-flex items-center rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-xs font-heading font-700 hover:bg-accent/90 transition-colors"
                >
                  View Report
                </Link>
                <Link
                  href={`/chat/${scan.id}`}
                  className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-heading font-700 hover:bg-background transition-colors"
                >
                  AI Chat
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Scrollable slide area */}
        <div ref={contentRef} className="p-6 space-y-6 max-w-5xl mx-auto">
          {/* Overview slide (always first, always free) */}
          <OverviewSlide scan={scan} />

          {/* Module slides */}
          {moduleSlideIds.map((mId) => (
            <ModuleSlide
              key={mId}
              moduleId={mId}
              moduleName={MODULE_NAMES[mId] ?? mId}
              result={resultMap.get(mId) ?? null}
              scanId={scan.id}
              isPaid={!isPaid && PAID_MODULES.has(mId)}
            />
          ))}

          {/* Paid synthesis slides */}
          <PaidSlides
            scanId={scan.id}
            isPaid={isPaid}
            resultMap={resultMap}
          />
        </div>
      </div>
    </div>
  );
}
