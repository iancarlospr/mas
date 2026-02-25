'use client';

import type { ScanWithResults, CategoryScore } from '@marketing-alpha/types';
import { getTrafficLight } from '@marketing-alpha/types';
import { ProgressBar } from '@/components/os/progress-bar';
import { cn } from '@/lib/utils';

/**
 * GhostScan OS — Overview Slide (MarketingIQ Display)
 * ═══════════════════════════════════════════════════════
 *
 * WHAT: The first thing users see after scan completes — the MarketingIQ
 *       score and category breakdown inside the Dashboard window.
 * WHY:  The old SVG gauge was generic. Now it's a retro-styled hero
 *       metric in JetBrains Mono with Chloé's gradient progress bar
 *       and bevel-styled category tabs (Plan Section 6).
 * HOW:  Large numeric score with animated gradient bar. Categories
 *       rendered as bevel-framed horizontal bars with traffic lights.
 *       All using new OKLCH tokens and OS font stack.
 */

/* ── Category label mapping ────────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  security_compliance: 'Security & Compliance',
  analytics_measurement: 'Analytics & Measurement',
  performance_experience: 'Performance & Experience',
  seo_content: 'SEO & Content',
  paid_media: 'Paid Media',
  martech_infrastructure: 'MarTech & Infrastructure',
  brand_presence: 'Brand & Presence',
  market_intelligence: 'Market Intelligence',
};

/** Score → label mapping */
function getScoreLabel(score: number): string {
  if (score >= 85) return 'Marketing Leader';
  if (score >= 70) return 'Competitive';
  if (score >= 50) return 'Developing';
  if (score >= 30) return 'At Risk';
  return 'Critical';
}

interface OverviewSlideProps {
  scan: ScanWithResults;
}

export function OverviewSlide({ scan }: OverviewSlideProps) {
  const categories = scan.marketingIqResult?.categories ?? [];
  const moduleCount = scan.moduleResults.filter(
    (r) => r.status === 'success' || r.status === 'partial',
  ).length;

  const score = scan.marketingIq;
  const scoreLabel = score != null ? getScoreLabel(score) : null;

  return (
    <div id="slide-overview" className="p-gs-4">
      {/* ── Hero Score Section ────────────────────────────── */}
      <div className="bevel-sunken bg-gs-paper p-gs-6 mb-gs-4">
        <div className="flex flex-col lg:flex-row items-center gap-gs-8">
          {/* Big number */}
          <div className="text-center lg:text-left flex-shrink-0">
            {score != null ? (
              <>
                <div className="font-data text-data-hero text-gs-red leading-none">
                  {score}
                </div>
                <div className="font-system text-os-lg text-gs-muted mt-gs-2">
                  MarketingIQ™
                </div>
                <div
                  className={cn(
                    'font-data text-data-xl mt-gs-1',
                    score >= 70 ? 'text-gs-terminal' : score >= 40 ? 'text-gs-warning' : 'text-gs-critical',
                  )}
                >
                  {scoreLabel}
                </div>
              </>
            ) : (
              <div className="font-data text-data-2xl text-gs-muted">
                Score unavailable
              </div>
            )}
          </div>

          {/* Score progress bar (Chloé gradient) */}
          {score != null && (
            <div className="flex-1 w-full max-w-sm">
              <ProgressBar value={score} variant="ghost" size="lg" showLabel />
            </div>
          )}

          {/* Meta info */}
          <div className="bevel-sunken bg-gs-paper px-gs-3 py-gs-2 font-data text-data-xs text-gs-muted space-y-gs-1 flex-shrink-0">
            <div>{scan.domain}</div>
            <div>{new Date(scan.createdAt).toLocaleDateString()}</div>
            <div>{moduleCount} modules executed</div>
          </div>
        </div>
      </div>

      {/* ── Category Breakdown ────────────────────────────── */}
      <div className="space-y-gs-2">
        <h3 className="font-system text-os-base text-gs-muted mb-gs-2">
          Category Scores
        </h3>
        {categories.map((cat) => (
          <CategoryBar key={cat.category} category={cat} />
        ))}
        {categories.length === 0 && (
          <p className="font-data text-data-sm text-gs-muted text-center py-gs-4">
            Category scores unavailable
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Category Bar ──────────────────────────────────────────── */

function CategoryBar({ category }: { category: CategoryScore }) {
  const light = getTrafficLight(category.score);
  const label = CATEGORY_LABELS[category.category] ?? category.category;

  return (
    <div className="flex items-center gap-gs-3">
      {/* Label */}
      <span className="font-system text-os-xs text-gs-muted w-[160px] truncate text-right">
        {label}
      </span>

      {/* Bar track (bevel sunken) */}
      <div className="flex-1 bevel-sunken bg-gs-paper h-[16px] relative overflow-hidden">
        <div
          className="absolute inset-y-[2px] left-[2px] transition-all duration-700"
          style={{
            width: `calc(${category.score}% - 4px)`,
            background:
              light === 'green'
                ? 'var(--gs-terminal)'
                : light === 'yellow'
                  ? 'var(--gs-warning)'
                  : 'var(--gs-critical)',
          }}
        />
      </div>

      {/* Score number */}
      <span
        className={cn(
          'font-data text-data-sm font-bold w-[32px] text-right tabular-nums',
          light === 'green' && 'text-gs-terminal',
          light === 'yellow' && 'text-gs-warning',
          light === 'red' && 'text-gs-critical',
        )}
      >
        {category.score}
      </span>

      {/* Traffic dot */}
      <span
        className={cn(
          'traffic-dot',
          light === 'green' && 'traffic-dot-green',
          light === 'yellow' && 'traffic-dot-amber',
          light === 'red' && 'traffic-dot-red',
        )}
      />
    </div>
  );
}
