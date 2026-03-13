'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReportData } from '@marketing-alpha/types';
import { CoverSection } from './cover-section';
import { TableOfContentsSection } from './toc-section';
import { ExecutiveSummarySection } from './executive-summary-section';
import { TechStackSection } from './tech-stack-section';
import { CategorySection } from './category-section';
import { ROISection as ReportROISection } from './roi-report-section';
import { RoadmapSection } from './roadmap-section';
import { MethodologySection } from './methodology-section';
import { SourcesSection } from './sources-section';
import { LazySection } from './lazy-section';
import { SectionSkeleton } from './section-skeleton';
import { ReportSidebar } from './report-sidebar';
import { ReportTopBar } from './report-top-bar';
import { cn } from '@/lib/utils';

interface ReportLayoutProps {
  data: ReportData;
  isPrintMode: boolean;
  isShared: boolean;
}

const SECTION_IDS = [
  'cover', 'toc', 'executive-summary', 'tech-stack',
  'analytics', 'paid-media', 'performance', 'compliance',
  'martech', 'seo', 'market-position', 'digital-presence',
  'roi', 'roadmap', 'methodology', 'sources',
] as const;

const SECTION_LABELS: Record<string, string> = {
  'cover': 'Cover',
  'toc': 'Table of Contents',
  'executive-summary': 'Executive Summary',
  'tech-stack': 'Technology Stack',
  'analytics': 'Analytics & Data Integrity',
  'paid-media': 'Paid Media & Attribution',
  'performance': 'Performance & UX',
  'compliance': 'Compliance & Security',
  'martech': 'MarTech Efficiency',
  'seo': 'SEO & Content',
  'market-position': 'Market Position',
  'digital-presence': 'Digital Presence',
  'roi': 'ROI Impact Analysis',
  'roadmap': 'Remediation Roadmap',
  'methodology': 'Methodology',
  'sources': 'Sources',
};

export function ReportLayout({ data, isPrintMode, isShared }: ReportLayoutProps) {
  const [activeSection, setActiveSection] = useState<string>('cover');
  const [chartsLoaded, setChartsLoaded] = useState(false);
  const totalCharts = useRef(8); // approximate
  const loadedCharts = useRef(0);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(id, el);
  }, []);

  const onChartReady = useCallback(() => {
    loadedCharts.current++;
    if (loadedCharts.current >= totalCharts.current) {
      setChartsLoaded(true);
    }
  }, []);

  // IntersectionObserver to track active section
  useEffect(() => {
    if (isPrintMode) return;
    const observers: IntersectionObserver[] = [];
    const entries = new Map<string, boolean>();

    for (const [id, el] of sectionRefs.current) {
      const observer = new IntersectionObserver(
        (observedEntries) => {
          const entry = observedEntries[0];
          if (!entry) return;
          entries.set(id, entry.isIntersecting);
          // Find first visible section
          for (const sId of SECTION_IDS) {
            if (entries.get(sId)) {
              setActiveSection(sId);
              break;
            }
          }
        },
        { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
      );
      observer.observe(el);
      observers.push(observer);
    }

    return () => observers.forEach(o => o.disconnect());
  }, [isPrintMode]);

  const scrollToSection = useCallback((id: string) => {
    const el = sectionRefs.current.get(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const categoryOrder = [
    { id: 'analytics', key: 'analytics' as const, num: 3 },
    { id: 'paid-media', key: 'paidMedia' as const, num: 4 },
    { id: 'performance', key: 'performance' as const, num: 5 },
    { id: 'compliance', key: 'compliance' as const, num: 6 },
    { id: 'martech', key: 'martech' as const, num: 7 },
    { id: 'seo', key: 'seo' as const, num: 8 },
    { id: 'market-position', key: 'marketPosition' as const, num: 9 },
    { id: 'digital-presence', key: 'digitalPresence' as const, num: 10 },
  ] as const;

  return (
    <div
      data-charts-loaded={chartsLoaded}
      className={cn(
        'min-h-screen',
        isPrintMode ? 'bg-white' : 'bg-[#FAFBFC]',
      )}
    >
      {/* Print watermark */}
      <div className="print-watermark hidden print:block" aria-hidden="true">
        MarketingAlphaScan
      </div>

      {/* Print header (hidden on web) */}
      <div className="print-header hidden print:block text-[8px] text-[#94A3B8]">
        MarketingAlphaScan — {data.domain}
      </div>

      {/* Top bar (web only) */}
      {!isPrintMode && (
        <ReportTopBar
          domain={data.domain}
          marketingIQ={data.marketingIQ}
          scanId={data.scanId}
          isShared={isShared}
        />
      )}

      <div className={cn('flex', isPrintMode ? '' : 'pt-16')}>
        {/* Sidebar TOC (web only) */}
        {!isPrintMode && (
          <ReportSidebar
            sections={SECTION_IDS.filter(s => s !== 'cover' && s !== 'toc')}
            labels={SECTION_LABELS}
            activeSection={activeSection}
            categoryScores={data.categoryScores}
            onNavigate={scrollToSection}
          />
        )}

        {/* Report content */}
        <main
          className={cn(
            'flex-1 report-content',
            isPrintMode ? 'max-w-none p-0' : 'max-w-[900px] mx-auto px-6 pb-16 lg:ml-[250px]',
          )}
        >
          {/* Cover */}
          <div ref={el => registerRef('cover', el)} id="cover">
            <CoverSection
              domain={data.domain}
              scanDate={data.scanDate}
              scanId={data.scanId}
              marketingIQ={data.marketingIQ}
              marketingIQLabel={data.marketingIQLabel}
              userEmail={data.userEmail}
              isPrintMode={isPrintMode}
            />
          </div>

          {/* Table of Contents (print only) */}
          {isPrintMode && (
            <div ref={el => registerRef('toc', el)} id="toc">
              <TableOfContentsSection sections={SECTION_IDS} labels={SECTION_LABELS} />
            </div>
          )}

          {/* Executive Summary — always eager */}
          <div ref={el => registerRef('executive-summary', el)} id="executive-summary">
            <ExecutiveSummarySection
              marketingIQ={data.marketingIQ}
              marketingIQLabel={data.marketingIQLabel}
              categoryScores={data.categoryScores}
              executiveBrief={data.executiveBrief}
              criticalFindings={data.criticalFindings}
              topOpportunities={data.topOpportunities}
              keyMetrics={data.keyMetrics}
              isPrintMode={isPrintMode}
              onChartReady={onChartReady}
            />
          </div>

          {/* Tech Stack */}
          <div ref={el => registerRef('tech-stack', el)} id="tech-stack">
            <LazySection isPrintMode={isPrintMode} fallback={<SectionSkeleton />}>
              <TechStackSection
                data={data.techStack}
                sectionNumber={2}
                isPrintMode={isPrintMode}
                onChartReady={onChartReady}
              />
            </LazySection>
          </div>

          {/* 8 Category Deep Dives */}
          {categoryOrder.map(({ id, key, num }) => (
            <div key={id} ref={el => registerRef(id, el)} id={id}>
              <LazySection isPrintMode={isPrintMode} fallback={<SectionSkeleton />}>
                <CategorySection
                  sectionNumber={num}
                  data={data.categories[key]}
                  isPrintMode={isPrintMode}
                  onChartReady={onChartReady}
                />
              </LazySection>
            </div>
          ))}

          {/* ROI Impact Analysis */}
          <div ref={el => registerRef('roi', el)} id="roi">
            <LazySection isPrintMode={isPrintMode} fallback={<SectionSkeleton />}>
              <ReportROISection
                data={data.roi}
                sectionNumber={11}
                isPrintMode={isPrintMode}
                onChartReady={onChartReady}
              />
            </LazySection>
          </div>

          {/* Remediation Roadmap */}
          <div ref={el => registerRef('roadmap', el)} id="roadmap">
            <LazySection isPrintMode={isPrintMode} fallback={<SectionSkeleton />}>
              <RoadmapSection
                data={data.roadmap}
                sectionNumber={12}
                isPrintMode={isPrintMode}
                onChartReady={onChartReady}
              />
            </LazySection>
          </div>

          {/* Methodology */}
          <div ref={el => registerRef('methodology', el)} id="methodology">
            <LazySection isPrintMode={isPrintMode} fallback={<SectionSkeleton />}>
              <MethodologySection
                data={data.methodology}
                sectionNumber={13}
                isPrintMode={isPrintMode}
              />
            </LazySection>
          </div>

          {/* Sources */}
          <div ref={el => registerRef('sources', el)} id="sources">
            <LazySection isPrintMode={isPrintMode} fallback={<SectionSkeleton />}>
              <SourcesSection
                sources={data.sources}
                sectionNumber={14}
                isPrintMode={isPrintMode}
              />
            </LazySection>
          </div>
        </main>
      </div>
    </div>
  );
}
