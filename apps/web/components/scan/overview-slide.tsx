'use client';

import type { ScanWithResults, CategoryScore } from '@marketing-alpha/types';
import { getTrafficLight } from '@marketing-alpha/types';
import { ScoreGauge } from './score-gauge';
import { cn } from '@/lib/utils';
import { TRAFFIC_LIGHT_COLORS } from '@/lib/chart-config';

const CATEGORY_LABELS: Record<string, string> = {
  analytics_integrity: 'Analytics Integrity',
  paid_media_attribution: 'Paid Media & Attribution',
  performance_ux: 'Performance & UX',
  compliance_security: 'Compliance & Security',
  martech_efficiency: 'MarTech Efficiency',
  seo_content: 'SEO & Content',
  market_position: 'Market Position',
  digital_presence: 'Digital Presence',
};

interface OverviewSlideProps {
  scan: ScanWithResults;
}

export function OverviewSlide({ scan }: OverviewSlideProps) {
  const categories = scan.marketingIqResult?.categories ?? [];
  const moduleCount = scan.moduleResults.filter(
    (r) => r.status === 'success' || r.status === 'partial',
  ).length;

  return (
    <div
      id="slide-overview"
      className="slide-card relative w-full bg-white border border-border/60 rounded-xl shadow-sm overflow-hidden"
      style={{ aspectRatio: '16 / 9' }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted">Overview</span>
          <span className="font-heading text-sm font-600 text-primary">
            MarketingIQ Score
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted font-body">
          <span>{scan.domain}</span>
          <span className="text-border">|</span>
          <span>{new Date(scan.createdAt).toLocaleDateString()}</span>
          <span className="text-border">|</span>
          <span>{moduleCount} modules</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 p-6 h-[calc(100%-48px)]">
        {/* Score gauge */}
        <div className="flex-shrink-0">
          {scan.marketingIq != null ? (
            <ScoreGauge score={scan.marketingIq} size="xl" />
          ) : (
            <div className="w-[400px] h-[400px] flex items-center justify-center text-muted text-sm">
              Score unavailable
            </div>
          )}
        </div>

        {/* Category bars */}
        <div className="flex-1 w-full max-w-md space-y-3">
          {categories.map((cat) => (
            <CategoryBar key={cat.category} category={cat} />
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted text-center">
              Category scores unavailable
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryBar({ category }: { category: CategoryScore }) {
  const light = getTrafficLight(category.score);
  const color = TRAFFIC_LIGHT_COLORS[light === 'yellow' ? 'amber' : light];
  const label = CATEGORY_LABELS[category.category] ?? category.category;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-body text-muted w-40 truncate text-right">
        {label}
      </span>
      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${category.score}%`, backgroundColor: color }}
        />
      </div>
      <span
        className={cn(
          'text-xs font-mono font-700 w-8 text-right tabular-nums',
          light === 'green' ? 'text-success' : light === 'yellow' ? 'text-warning' : 'text-error',
        )}
      >
        {category.score}
      </span>
    </div>
  );
}
