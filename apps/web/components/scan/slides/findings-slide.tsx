'use client';

import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';

/**
 * Key Findings Slide — 1+2 Hero Layout
 * ═════════════════════════════════════
 *
 * Slide 4 (after overview-exec). Paid-only content from M42.
 * Top ~55%: hero finding (#1 urgency) — big statement.
 * Bottom ~45%: two supporting findings side by side.
 * Competitive context as a strip across the very bottom.
 *
 * Free tier: not rendered (returns null).
 */

// ── Report type scale ─────────────────────────────────────────────────
const T = {
  heroFinding:  'clamp(22px, 3.2cqi, 36px)',
  heroImpact:   'clamp(13px, 1.5cqi, 17px)',
  heroDetail:   'clamp(12px, 1.35cqi, 15px)',
  subFinding:   'clamp(14px, 1.8cqi, 20px)',
  subImpact:    'clamp(11px, 1.25cqi, 14px)',
  badge:        'clamp(9px, 1cqi, 11px)',
  context:      'clamp(11px, 1.25cqi, 14px)',
  number:       'clamp(40px, 5.5cqi, 68px)',
} as const;

// ── Urgency colors ────────────────────────────────────────────────────
const URGENCY: Record<string, { bg: string; text: string; glow: string }> = {
  immediate:    { bg: 'rgba(255,80,80,0.12)', text: 'var(--gs-critical)', glow: 'rgba(255,80,80,0.15)' },
  this_week:    { bg: 'rgba(255,200,0,0.10)', text: 'var(--gs-warning)', glow: 'rgba(255,200,0,0.1)' },
  this_month:   { bg: 'rgba(255,178,239,0.10)', text: 'var(--gs-base)', glow: 'rgba(255,178,239,0.08)' },
  this_quarter: { bg: 'rgba(255,255,255,0.05)', text: 'var(--gs-mid)', glow: 'rgba(255,255,255,0.03)' },
};

// ── Types ─────────────────────────────────────────────────────────────
interface KeyFinding {
  finding: string;
  modules: string[];
  detail: string;
  business_impact: string;
  urgency: string;
}

interface M42Synthesis {
  verdict_headline?: string;
  executive_brief: string;
  key_findings: KeyFinding[];
  tech_stack_summary: Record<string, string[]>;
  category_assessments: Record<string, unknown>;
  competitive_context: string;
}

// ── Component ─────────────────────────────────────────────────────────

interface FindingsSlideProps {
  scan: ScanWithResults;
}

// Dev-only mock data for layout preview
const DEV_MOCK: { findings: KeyFinding[]; context: string } | null =
  process.env.NODE_ENV === 'development'
    ? {
        findings: [
          {
            finding: 'Systemic measurement blind spots are silently degrading marketing ROI',
            modules: ['M05', 'M06', 'M08', 'M09'],
            detail: 'Four separate modules reveal the same pattern: measurement infrastructure exists but is configured for a pre-privacy world. GA4 lacks Consent Mode v2, Google Ads lacks enhanced conversions, and CAPI is absent. Combined, these gaps mean the business is making budget allocation decisions on data that misses 30-50% of actual conversions.',
            business_impact: 'Estimated 30-50% of conversion data is unattributed, leading to suboptimal ROAS and potential misallocation of marketing budget.',
            urgency: 'this_week',
          },
          {
            finding: 'Brand trust infrastructure has critical gaps enabling domain spoofing',
            modules: ['M01', 'M12', 'M40'],
            detail: 'DMARC is set to monitor-only (p=none), email authentication is incomplete, and tracking fires before consent banner interaction — an active GDPR violation.',
            business_impact: 'Domain spoofing risk and regulatory exposure from pre-consent tracking across EU traffic.',
            urgency: 'immediate',
          },
          {
            finding: 'Zero competitive intelligence infrastructure despite enterprise-scale traffic',
            modules: ['M24', 'M25', 'M27'],
            detail: 'No rank tracking, no backlink monitoring, no share-of-voice measurement detected. The business is operating without visibility into competitive positioning.',
            business_impact: 'Cannot detect or respond to competitor movements, SEO ranking shifts, or market share changes.',
            urgency: 'this_month',
          },
        ],
        context: 'This stack is below average for a Fortune 500 financial services company. Competitors like Bank of America and Wells Fargo have server-side tracking, Consent Mode v2, and multi-platform attribution fully deployed. The absence of CAPI and enhanced conversions puts Chase at a measurement disadvantage.',
      }
    : null;

export function FindingsSlide({ scan }: FindingsSlideProps) {
  const isPaid = scan.tier === 'paid';

  const resultMap = new Map<string, ModuleResult>(
    scan.moduleResults.map((r) => [r.moduleId, r]),
  );
  const m42 = resultMap.get('M42');
  const synthesis = isPaid
    ? (m42?.data?.['synthesis'] as M42Synthesis | undefined) ?? null
    : null;

  const findings = synthesis?.key_findings ?? DEV_MOCK?.findings ?? [];
  const competitiveContext = synthesis?.competitive_context ?? DEV_MOCK?.context ?? null;

  if (findings.length === 0) return null;

  const hero = findings[0]!;
  const supporting = findings.slice(1, 3);

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
      <div className="relative z-10 h-full flex flex-col">

        {/* ── TOP: Hero Finding (~55%) ── */}
        <div
          style={{
            flex: '1 1 0',
            padding: '4.5% 5% 3%',
            display: 'flex',
            gap: '4%',
            alignItems: 'flex-start',
            borderBottom: '1px solid rgba(255,178,239,0.06)',
          }}
        >
          {/* Big number */}
          <span
            className="font-data tabular-nums flex-shrink-0"
            style={{
              fontSize: T.number,
              fontWeight: 700,
              lineHeight: 0.85,
              color: (URGENCY[hero.urgency] ?? URGENCY['this_quarter']!).text,
              opacity: 0.2,
            }}
          >
            01
          </span>

          {/* Finding content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Urgency badge */}
            <span
              className="font-data uppercase inline-block"
              style={{
                fontSize: T.badge,
                letterSpacing: '0.08em',
                padding: '0.2em 0.6em',
                borderRadius: '3px',
                background: (URGENCY[hero.urgency] ?? URGENCY['this_quarter']!).bg,
                color: (URGENCY[hero.urgency] ?? URGENCY['this_quarter']!).text,
                marginBottom: '0.8em',
              }}
            >
              {hero.urgency.replace(/_/g, ' ')}
            </span>

            {/* Finding headline */}
            <h3
              className="font-display"
              style={{
                fontSize: T.heroFinding,
                fontWeight: 600,
                lineHeight: 1.2,
                color: 'var(--gs-light)',
                marginBottom: '0.6em',
              }}
            >
              {hero.finding}
            </h3>

            {/* Detail */}
            <p
              className="font-data"
              style={{
                fontSize: T.heroDetail,
                lineHeight: 1.65,
                color: 'var(--gs-mid)',
                marginBottom: '0.6em',
              }}
            >
              {hero.detail}
            </p>

            {/* Business impact */}
            <p
              className="font-data"
              style={{
                fontSize: T.heroImpact,
                lineHeight: 1.5,
                color: 'var(--gs-light)',
                opacity: 0.85,
              }}
            >
              {hero.business_impact}
            </p>
          </div>
        </div>

        {/* ── BOTTOM: Two supporting findings side by side (~35%) ── */}
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            gap: '1px',
          }}
        >
          {supporting.map((f, i) => {
            const u = URGENCY[f.urgency] ?? URGENCY['this_quarter']!;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  padding: '3% 4%',
                  borderRight: i === 0 ? '1px solid rgba(255,178,239,0.06)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '3%' }}>
                  {/* Number */}
                  <span
                    className="font-data tabular-nums flex-shrink-0"
                    style={{
                      fontSize: T.subFinding,
                      fontWeight: 700,
                      color: u.text,
                      opacity: 0.2,
                      lineHeight: 1,
                    }}
                  >
                    {String(i + 2).padStart(2, '0')}
                  </span>

                  <div style={{ minWidth: 0 }}>
                    {/* Badge */}
                    <span
                      className="font-data uppercase inline-block"
                      style={{
                        fontSize: T.badge,
                        letterSpacing: '0.08em',
                        padding: '0.15em 0.5em',
                        borderRadius: '3px',
                        background: u.bg,
                        color: u.text,
                        marginBottom: '0.5em',
                      }}
                    >
                      {f.urgency.replace(/_/g, ' ')}
                    </span>

                    {/* Finding */}
                    <h4
                      className="font-display"
                      style={{
                        fontSize: T.subFinding,
                        fontWeight: 600,
                        lineHeight: 1.25,
                        color: 'var(--gs-light)',
                        marginBottom: '0.4em',
                      }}
                    >
                      {f.finding}
                    </h4>

                    {/* Impact */}
                    <p
                      className="font-data"
                      style={{
                        fontSize: T.subImpact,
                        lineHeight: 1.5,
                        color: 'var(--gs-mid)',
                      }}
                    >
                      {f.business_impact}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── FOOTER: Competitive context ── */}
        {competitiveContext && (
          <div
            style={{
              padding: '2% 5%',
              borderTop: '1px solid rgba(255,178,239,0.06)',
              background: 'rgba(255,178,239,0.015)',
            }}
          >
            <p
              className="font-data"
              style={{
                fontSize: T.context,
                lineHeight: 1.55,
                color: 'var(--gs-mid)',
                fontStyle: 'italic',
              }}
            >
              {competitiveContext}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
