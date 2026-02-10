'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import { motion } from 'framer-motion';
import { ScoreGauge } from './score-gauge';
import { CategoryBar } from './category-bar';
import { TechStack } from './tech-stack';
import { ModuleCard } from './module-card';
import { BentoCard } from '@/components/charts/bento-card';
import { containerVariants, cardVariants } from '@/components/charts/animation-utils';
import Link from 'next/link';

const MODULE_NAMES: Record<string, string> = {
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
  M39: 'Business Profile', M41: 'Module Synthesis', M42: 'Final Synthesis',
  M43: 'PRD', M44: 'ROI Simulator', M45: 'Cost Cutter', M46: 'Knowledge Base',
};

interface BentoDashboardProps {
  scan: ScanWithResults;
}

export function BentoDashboard({ scan }: BentoDashboardProps) {
  const categories = scan.marketingIqResult?.categories ?? [];
  const allSignals = scan.moduleResults.flatMap((r) => r.signals);

  const techTools = allSignals
    .filter((s) => s.confidence >= 0.6)
    .reduce<Record<string, string[]>>((acc, signal) => {
      const cat = signal.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      if (!acc[cat].includes(signal.name)) acc[cat].push(signal.name);
      return acc;
    }, {});

  const sortedResults = [...scan.moduleResults].sort((a, b) =>
    a.moduleId.localeCompare(b.moduleId, undefined, { numeric: true }),
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-h2 text-primary">{scan.domain}</h1>
          <p className="text-sm text-muted mt-1">
            Scanned {new Date(scan.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            {scan.tier !== 'paid' && (
              <Link
                href={`/report/${scan.id}`}
                className="inline-flex items-center justify-center rounded-lg bg-highlight text-highlight-foreground px-4 py-2 text-sm font-heading font-700 hover:bg-highlight/90 transition-colors"
              >
                Unlock Report — $9.99
              </Link>
            )}
            {scan.tier === 'paid' && (
              <>
                <Link
                  href={`/report/${scan.id}`}
                  className="inline-flex items-center justify-center rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-heading font-700 hover:bg-accent/90 transition-colors"
                >
                  View Report
                </Link>
                <Link
                  href={`/chat/${scan.id}`}
                  className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-heading font-700 hover:bg-background transition-colors"
                >
                  AI Chat
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <motion.div
        className="bento-grid"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
      >
        {/* MarketingIQ Score — 2x2 hero */}
        {scan.marketingIq != null && (
          <motion.div variants={cardVariants} className="bento-card-2x2">
            <BentoCard title="MarketingIQ Score" size="2x2">
              <div className="flex items-center justify-center h-full">
                <ScoreGauge score={scan.marketingIq} size="xl" />
              </div>
            </BentoCard>
          </motion.div>
        )}

        {/* Category Scores — 2x1 wide */}
        {categories.length > 0 && (
          <motion.div variants={cardVariants} className="bento-card-2x1">
            <BentoCard title="Category Scores" size="2x1">
              <CategoryBar categories={categories} compact />
            </BentoCard>
          </motion.div>
        )}

        {/* Tech Stack — 2x2 */}
        {Object.keys(techTools).length > 0 && (
          <motion.div variants={cardVariants} className="bento-card-2x2">
            <BentoCard title="Detected Technology Stack" size="2x2">
              <div className="overflow-auto max-h-[340px]">
                <TechStack tools={techTools} />
              </div>
            </BentoCard>
          </motion.div>
        )}

        {/* Module cards as 1x1 bento items */}
        {sortedResults
          .filter((r) => r.status !== 'skipped' && !r.moduleId.startsWith('M4'))
          .map((result) => (
            <motion.div key={result.moduleId} variants={cardVariants} className="bento-card-1x1">
              <ModuleCard
                moduleId={result.moduleId}
                moduleName={MODULE_NAMES[result.moduleId] ?? result.moduleId}
                result={result}
                scanId={scan.id}
              />
            </motion.div>
          ))}
      </motion.div>

      {/* Bento Grid CSS */}
      <style>{`
        .bento-grid {
          display: grid;
          gap: 16px;
          max-width: 1400px;
          margin: 0 auto;
          grid-template-columns: repeat(4, 1fr);
          grid-auto-rows: minmax(200px, auto);
        }
        @media (max-width: 1024px) {
          .bento-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
        }
        @media (max-width: 640px) {
          .bento-grid { grid-template-columns: 1fr; gap: 12px; }
        }
        .bento-card-1x1 { grid-column: span 1; grid-row: span 1; min-height: 200px; }
        .bento-card-2x1 { grid-column: span 2; grid-row: span 1; min-height: 200px; }
        .bento-card-1x2 { grid-column: span 1; grid-row: span 2; min-height: 416px; }
        .bento-card-2x2 { grid-column: span 2; grid-row: span 2; min-height: 416px; }
        @media (max-width: 640px) {
          .bento-card-2x1, .bento-card-1x2, .bento-card-2x2 {
            grid-column: span 1; grid-row: span 1; min-height: 200px;
          }
        }
      `}</style>
    </div>
  );
}
