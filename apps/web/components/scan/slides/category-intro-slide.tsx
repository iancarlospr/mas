'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import { CATEGORY_DISPLAY_NAMES, type ScoreCategory } from '@marketing-alpha/types';

/**
 * Category Intro Slide — Section Divider
 * ═══════════════════════════════════════
 *
 * Full-width slide that introduces a category section.
 * Left side: "Module Category" overline, then all 8 categories listed.
 * The active category is highlighted with its score. The rest are dimmed.
 * Right side: empty — breathing room.
 */

const T = {
  overline:  'clamp(13px, 1.5cqi, 17px)',
  active:    'clamp(28px, 3.6cqi, 44px)',
  inactive:  'clamp(16px, 1.8cqi, 22px)',
  score:     'clamp(28px, 3.6cqi, 44px)',
} as const;

// Legacy category keys from older scans
const LEGACY_CATEGORY_MAP: Record<string, ScoreCategory> = {
  compliance_security: 'security_compliance',
  analytics_integrity: 'analytics_measurement',
  performance_ux: 'performance_experience',
  paid_media_attribution: 'paid_media',
  martech_efficiency: 'martech_infrastructure',
  digital_presence: 'brand_presence',
  market_position: 'market_intelligence',
};

function getScoreColor(s: number): string {
  if (s >= 70) return 'var(--gs-terminal)';
  if (s >= 40) return 'var(--gs-warning)';
  return 'var(--gs-critical)';
}

interface CategoryIntroSlideProps {
  scan: ScanWithResults;
  category: ScoreCategory;
}

export function CategoryIntroSlide({ scan, category }: CategoryIntroSlideProps) {
  const categories = scan.marketingIqResult?.categories ?? [];
  const allCategoryKeys = Object.keys(CATEGORY_DISPLAY_NAMES) as ScoreCategory[];

  const activeCatScore = categories.find(
    (c) => c.category === category || LEGACY_CATEGORY_MAP[c.category] === category,
  );
  const activeScore = activeCatScore?.score ?? null;
  const activeColor = activeScore != null ? getScoreColor(activeScore) : 'var(--gs-mid)';

  return (
    <div
      className="slide-card relative overflow-hidden select-none"
      style={{
        aspectRatio: '14 / 8.5',
        background: 'var(--gs-void)',
        borderRadius: '2px',
        containerType: 'inline-size',
      }}
    >
      <div
        className="relative z-10 h-full flex flex-col"
        style={{ padding: '5% 5%', width: '55%' }}
      >
        {/* Overline */}
        <p
          className="font-display uppercase"
          style={{
            fontSize: T.overline,
            fontWeight: 600,
            letterSpacing: '0.25em',
            color: 'var(--gs-base)',
            marginBottom: '2em',
          }}
        >
          Module Category
        </p>

        {/* Category list */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35em',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          {allCategoryKeys.map((catKey, i) => {
            const isActive = catKey === category;
            const label = CATEGORY_DISPLAY_NAMES[catKey];

            return (
              <div
                key={catKey}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.8em',
                  padding: isActive ? '0.4em 0' : '0.2em 0',
                }}
              >
                {/* Number */}
                <span
                  className="font-data tabular-nums"
                  style={{
                    fontSize: isActive ? T.active : T.inactive,
                    color: isActive ? 'var(--gs-base)' : 'var(--gs-mid)',
                    opacity: isActive ? 0.5 : 0.2,
                    width: '1.8em',
                    textAlign: 'right',
                    flexShrink: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>

                <span
                  className="font-display"
                  style={{
                    fontSize: isActive ? T.active : T.inactive,
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? 'var(--gs-light)' : 'var(--gs-mid)',
                    opacity: isActive ? 1 : 0.3,
                    lineHeight: 1.2,
                    transition: 'all 0.2s',
                  }}
                >
                  {label}
                </span>

                {isActive && activeScore != null && (
                  <span
                    className="font-data tabular-nums"
                    style={{
                      fontSize: T.score,
                      fontWeight: 700,
                      color: activeColor,
                      lineHeight: 1,
                    }}
                  >
                    {activeScore}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
