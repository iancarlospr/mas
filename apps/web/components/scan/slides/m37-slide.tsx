'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  StatBlock,
  StarRating,
  scoreColor,
  SkippedSlide,
} from './module-slide-template';

/**
 * M37 Slide — Review Velocity
 * ═══════════════════════════
 *
 * Layout A: SlideShell with visualization.
 * Viz: StarRating for average rating. Stats: Total Reviews, MoM Change %.
 * Inline SVG bar chart for monthly review buckets.
 */

interface MonthlyBucket {
  month: string;
  count: number;
}

export function M37Slide({ scan, onAskChloe }: { scan: ScanWithResults; onAskChloe?: () => void }) {
  const syn = getM41Summary(scan, 'M37');
  const mod = getModuleResult(scan, 'M37');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Review Velocity" scan={scan} sourceLabel="Source: Google Business Profile, review volume and ratings" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Review volume and velocity analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const totalReviews = typeof raw?.['totalReviews'] === 'number'
    ? raw['totalReviews'] as number
    : typeof raw?.['reviewCount'] === 'number'
      ? raw['reviewCount'] as number
      : null;

  const avgRating = typeof raw?.['avgRating'] === 'number'
    ? raw['avgRating'] as number
    : typeof raw?.['rating'] === 'number'
      ? raw['rating'] as number
      : null;

  const velocity = (raw?.['velocity'] as Record<string, unknown> | undefined) ?? null;
  const monthlyBuckets = (velocity?.['monthlyBuckets'] as MonthlyBucket[] | undefined) ?? [];
  const momChange = typeof velocity?.['momChange'] === 'number' ? velocity['momChange'] as number : null;
  const trend = typeof velocity?.['trend'] === 'string' ? velocity['trend'] as string : null;

  // Chart dimensions
  const maxCount = Math.max(1, ...monthlyBuckets.map((b) => b.count));
  const barWidth = monthlyBuckets.length > 0 ? Math.min(40, Math.floor(280 / monthlyBuckets.length) - 4) : 30;
  const chartWidth = monthlyBuckets.length * (barWidth + 4);
  const chartHeight = 80;

  return (
    <SlideShell
      moduleName="Review Velocity"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Google Business Profile, review volume and ratings"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      onAskChloe={onAskChloe}
    >
      {/* ═══ Review Viz ═══ */}
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        <div style={{ display: 'flex', gap: '3%' }}>
          {/* Left: Rating + Stats */}
          <div style={{ flex: '0 0 35%', display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
            {/* Star Rating */}
            {avgRating != null && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginBottom: '0.15em' }}>
                  <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 2.25cqi, 36px)', fontWeight: 700, color: 'var(--gs-light)', lineHeight: 1 }}>
                    {avgRating.toFixed(1)}
                  </span>
                  <StarRating rating={avgRating} />
                </div>
                <p className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)' }}>
                  Average Rating
                </p>
              </div>
            )}

            {/* Stats */}
            <div style={{ display: 'flex', gap: '1.5em' }}>
              {totalReviews != null && (
                <StatBlock value={totalReviews.toLocaleString()} label="Total Reviews" color="var(--gs-light)" />
              )}
              {momChange != null && (
                <StatBlock
                  value={`${momChange > 0 ? '+' : ''}${momChange.toFixed(1)}%`}
                  label="MoM Change"
                  color={momChange > 0 ? 'var(--gs-terminal)' : momChange < 0 ? 'var(--gs-critical)' : 'var(--gs-mid)'}
                />
              )}
            </div>

            {/* Trend indicator */}
            {trend && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3em', marginTop: '0.2em' }}>
                <span style={{
                  fontSize: 'clamp(1px, 1.12cqi, 18px)',
                  color: trend === 'up' || trend === 'increasing' ? 'var(--gs-terminal)' : trend === 'down' || trend === 'decreasing' ? 'var(--gs-critical)' : 'var(--gs-mid)',
                }}>
                  {trend === 'up' || trend === 'increasing' ? '\u2191' : trend === 'down' || trend === 'decreasing' ? '\u2193' : '\u2192'}
                </span>
                <span className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-light)', textTransform: 'capitalize' }}>
                  {trend} trend
                </span>
              </div>
            )}
          </div>

          {/* Right: Monthly bar chart */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {monthlyBuckets.length > 0 && (
              <>
                <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.3em' }}>
                  Monthly Review Volume
                </h4>
                <svg
                  width="100%"
                  viewBox={`0 0 ${chartWidth + 20} ${chartHeight + 24}`}
                  style={{ maxHeight: '110px' }}
                >
                  {/* Bars */}
                  {monthlyBuckets.map((bucket, i) => {
                    const barH = Math.max(2, (bucket.count / maxCount) * chartHeight);
                    const x = 10 + i * (barWidth + 4);
                    const y = chartHeight - barH;
                    const pct = bucket.count / maxCount;
                    const color = pct >= 0.7 ? 'var(--gs-terminal)' : pct >= 0.3 ? 'var(--gs-base)' : 'var(--gs-mid)';
                    return (
                      <g key={i}>
                        <rect x={x} y={y} width={barWidth} height={barH} rx="2" fill={color} opacity="0.7" />
                        {/* Count label */}
                        <text
                          x={x + barWidth / 2}
                          y={y - 3}
                          textAnchor="middle"
                          fill="var(--gs-light)"
                          fontSize="9"
                          fontFamily="var(--font-data)"
                          opacity="0.7"
                        >
                          {bucket.count}
                        </text>
                        {/* Month label */}
                        <text
                          x={x + barWidth / 2}
                          y={chartHeight + 14}
                          textAnchor="middle"
                          fill="var(--gs-mid)"
                          fontSize="9"
                          fontFamily="var(--font-data)"
                          opacity="0.5"
                        >
                          {bucket.month.length > 3 ? bucket.month.slice(0, 3) : bucket.month}
                        </text>
                      </g>
                    );
                  })}
                  {/* Baseline */}
                  <line x1="8" y1={chartHeight} x2={chartWidth + 12} y2={chartHeight} stroke="rgba(255,178,239,0.08)" strokeWidth="1" />
                </svg>
              </>
            )}

            {monthlyBuckets.length === 0 && (
              <p className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.6 }}>
                Monthly review data not available
              </p>
            )}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}
