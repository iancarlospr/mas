'use client';

import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';
import { CATEGORY_DISPLAY_NAMES, type ScoreCategory } from '@marketing-alpha/types';
import { aggregateDetectedTools, mergeWithAITools } from '@/lib/detected-tools';

/**
 * Overview / Executive Summary Slide (Slide 2)
 * ═════════════════════════════════════════════
 *
 * Left ~55%:  About this audit + report index (8 categories, no scores)
 * Right ~45%: Synthesis headline (M42) + executive brief + key findings
 *
 * REPORT TYPE SCALE — these slides are documents, not app UI.
 * Uses container-relative (cqi) units so text scales with the slide card
 * width, not the browser viewport. Fallback clamp uses vw for browsers
 * without container query support.
 *
 * Scale:
 *   --rpt-headline:  ~28-36px at full width   (synthesis headline)
 *   --rpt-section:   ~14-16px                  (section headers)
 *   --rpt-body:      ~12-14px                  (body paragraphs)
 *   --rpt-index:     ~13-15px                  (index items)
 *   --rpt-meta:      ~10-12px                  (badges, labels, captions)
 *   --rpt-overline:  ~10-11px                  (domain, section nums)
 */

// ── Report type scale (container-relative with vw fallback) ───────────
const T = {
  headline: 'clamp(1px, 2.70cqi, 36px)',
  section:  'clamp(1px, 1.20cqi, 16px)',
  body:     'clamp(1px, 1.01cqi, 14px)',
  index:    'clamp(1px, 1.09cqi, 15px)',
  meta:     'clamp(1px, 0.75cqi, 12px)',
  overline: 'clamp(1px, 0.90cqi, 14px)',
  badge:    'clamp(1px, 0.83cqi, 13px)',
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

// ── Types ─────────────────────────────────────────────────────────────
interface M42Synthesis {
  synthesis_headline?: string;
  verdict_headline?: string;
  executive_brief: string;
  category_assessments: Record<string, unknown>;
  competitive_context: string;
}

interface BusinessContext {
  businessName: string | null;
  description: string | null;
  businessModel: string | null;
  techStack: {
    cms: string | null;
    framework: string | null;
    cdn: string | null;
    hosting: string | null;
  };
}

// ── Component ─────────────────────────────────────────────────────────

interface OverviewExecSlideProps {
  scan: ScanWithResults;
  slideNumber?: string;
}

export function OverviewExecSlide({ scan, slideNumber }: OverviewExecSlideProps) {
  const isPaid = scan.tier === 'paid';
  const resultMap = new Map<string, ModuleResult>(
    scan.moduleResults.map((r) => [r.moduleId, r]),
  );
  const moduleCount = scan.moduleResults.filter(
    (r) => r.status === 'success' || r.status === 'partial',
  ).length;
  const categories = scan.marketingIqResult?.categories ?? [];

  // M41 data
  const m41 = resultMap.get('M41');
  const businessContext = (m41?.data?.['businessContext'] as BusinessContext | undefined) ?? null;

  // M42 data (paid only)
  const m42 = resultMap.get('M42');
  const synthesis = isPaid
    ? (m42?.data?.['synthesis'] as M42Synthesis | undefined) ?? null
    : null;

  // Synthesis headline (serious executive take — distinct from Galloway roast on slide 2)
  const headline = synthesis?.synthesis_headline ?? synthesis?.verdict_headline ?? null;

  // Executive brief
  const briefText = (() => {
    if (synthesis?.executive_brief) return synthesis.executive_brief;
    const name = businessContext?.businessName ?? scan.domain;
    const model = businessContext?.businessModel;
    const ts = businessContext?.techStack;
    const techParts = [ts?.cms, ts?.framework].filter(Boolean);

    let intro = name;
    if (model) intro += ` is a ${model} business`;
    if (techParts.length > 0) intro += ` running ${techParts.join(' + ')}`;
    intro += '.';

    const parts = [intro, `We analyzed ${moduleCount} modules across 8 categories to produce this MarketingIQ assessment.`];
    if (businessContext?.description) parts.push(businessContext.description);
    return parts.join(' ');
  })();

  // Tech stack — deterministic detectedTools merged with AI-identified tools from M42
  const deterministic = aggregateDetectedTools(scan.moduleResults);
  const detectedTools = mergeWithAITools(deterministic, m42?.data as Record<string, unknown> | undefined);

  return (
    <div
      className="slide-card relative overflow-hidden select-none"
      data-slide-id="Overview"
      style={{
        aspectRatio: '14 / 8.5',
        background: 'var(--gs-void)',
        borderRadius: '2px',
        containerType: 'inline-size',
      }}
    >
      {/* Subtle radial glow behind right panel */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '5%',
          right: '-8%',
          width: '60%',
          height: '90%',
          background: 'radial-gradient(ellipse at center, rgba(255,178,239,0.03) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 h-full flex flex-col" style={{ paddingBottom: 'clamp(1px, 2.10cqi, 28px)' }}>

        {/* ── TOP: Two-column layout ── */}
        <div className="flex flex-1 min-h-0" style={{ flexShrink: 0 }}>

          {/* ── LEFT PANEL (~50%) — About + Index ── */}
          <div
            className="flex flex-col"
            style={{ width: '50%', padding: '1.5% 2.5% 0 3.5%' }}
          >
            {/* About This Audit */}
            <h3
              className="font-display uppercase"
              style={{
                fontSize: T.section,
                fontWeight: 600,
                letterSpacing: '0.15em',
                color: 'var(--gs-base)',
                marginBottom: '0.6em',
              }}
            >
              About This Audit
            </h3>
            <div
              className="font-data"
              style={{
                fontSize: T.body,
                lineHeight: 1.7,
                color: 'var(--gs-mid)',
                marginBottom: '1.8em',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.4em',
              }}
            >
              <p>
                This is a <span style={{ color: 'var(--gs-light)' }}>forensic marketing technology audit</span> of{' '}
                <span style={{ color: 'var(--gs-light)' }}>{scan.domain}</span>.
                A stealth browser loaded the live site — with full JavaScript execution,
                real Chrome TLS fingerprints, and bot-wall bypass — then ran{' '}
                <span style={{ color: 'var(--gs-light)' }}>{moduleCount} independent diagnostic modules</span> across
                five sequential phases: passive HTTP analysis, browser-rendered page inspection,
                deep interaction probing, third-party API enrichment, and AI-powered synthesis.
              </p>
              <p>
                Every module produces scored checkpoints rated{' '}
                <span style={{ color: 'var(--gs-terminal)' }}>excellent</span>,{' '}
                <span style={{ color: 'var(--gs-terminal)' }}>good</span>,{' '}
                <span style={{ color: 'var(--gs-warning)' }}>warning</span>, or{' '}
                <span style={{ color: 'var(--gs-critical)' }}>critical</span> — with
                evidence captured directly from the site&apos;s HTTP headers, DOM, network requests,
                cookies, data layers, console output, and third-party vendor APIs.
                Module scores are weighted by category into a
                single <span style={{ color: 'var(--gs-light)' }}>MarketingIQ™</span> score (0–100).
              </p>
              <p>
                The report is organized into <span style={{ color: 'var(--gs-light)' }}>8 categories</span> listed
                below. Each contains per-module findings with raw evidence, health ratings,
                and actionable recommendations.{' '}
                {isPaid
                  ? 'The final sections contain AI-synthesized strategic analysis: an executive brief, prioritized remediation roadmap, ROI impact projections, and cost optimization opportunities — generated from the complete dataset of all module findings.'
                  : 'The paid report adds AI-synthesized strategic analysis: executive brief, remediation roadmap, ROI projections, and cost optimization — generated from the full module dataset.'}
              </p>
            </div>

            {/* Report Index — category list with scores */}
            <h3
              className="font-display uppercase"
              style={{
                fontSize: T.section,
                fontWeight: 600,
                letterSpacing: '0.15em',
                color: 'var(--gs-base)',
                marginBottom: '0.6em',
              }}
            >
              Module Categories &amp; Scores
            </h3>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.15em',
              }}
            >
              {(Object.keys(CATEGORY_DISPLAY_NAMES) as ScoreCategory[]).map((catKey, i) => {
                const label = CATEGORY_DISPLAY_NAMES[catKey];
                const catScore = categories.find(
                  (c) => c.category === catKey || LEGACY_CATEGORY_MAP[c.category] === catKey,
                );
                const s = catScore?.score ?? null;
                const color = s != null ? getScoreColor(s) : 'var(--gs-mid)';
                return (
                  <div
                    key={catKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.8em',
                      padding: '0.3em 0',
                      borderBottom: '1px solid rgba(255,178,239,0.05)',
                    }}
                  >
                    {/* Section number */}
                    <span
                      className="font-data tabular-nums"
                      style={{
                        fontSize: T.overline,
                        color: 'var(--gs-base)',
                        opacity: 0.5,
                        width: '1.6em',
                        textAlign: 'right',
                        flexShrink: 0,
                      }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {/* Category name */}
                    <span
                      className="font-data"
                      style={{
                        fontSize: T.index,
                        color: 'var(--gs-light)',
                        flex: 1,
                      }}
                    >
                      {label}
                    </span>
                    {/* Score */}
                    <span
                      className="font-data tabular-nums"
                      style={{
                        fontSize: T.index,
                        fontWeight: 600,
                        color,
                      }}
                    >
                      {s ?? '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Divider ── */}
          <div
            style={{
              width: '1px',
              background: 'linear-gradient(to bottom, transparent 5%, rgba(255,178,239,0.1) 30%, rgba(255,178,239,0.1) 70%, transparent 95%)',
              flexShrink: 0,
            }}
          />

          {/* ── RIGHT PANEL (~50%) — Executive Brief ── */}
          <div
            className="flex flex-col"
            style={{ width: '50%', padding: '1.5% 3.5% 0 2.5%' }}
          >
            {/* Executive Brief — headline flows into body */}
            <h3
              className="font-display uppercase"
              style={{
                fontSize: T.section,
                fontWeight: 600,
                letterSpacing: '0.15em',
                color: 'var(--gs-base)',
                marginBottom: '0.6em',
              }}
            >
              Executive Brief
            </h3>
            <div
              className="font-data"
              style={{
                fontSize: T.body,
                lineHeight: 1.7,
                color: 'var(--gs-light)',
                opacity: 0.85,
              }}
            >
              {headline && (
                <p
                  className="font-display"
                  style={{
                    fontSize: 'clamp(1px, 1.35cqi, 19px)',
                    fontWeight: 600,
                    lineHeight: 1.35,
                    color: 'var(--gs-light)',
                    opacity: 1,
                    marginBottom: '0.7em',
                    borderLeft: '2px solid var(--gs-base)',
                    paddingLeft: '0.7em',
                  }}
                >
                  {headline}
                </p>
              )}
              {briefText.split('\n').map((para, i) => (
                <p key={i} style={{ marginBottom: i < briefText.split('\n').length - 1 ? '0.65em' : 0 }}>
                  {para}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* ── BOTTOM: Detected Stack — full width ── */}
        {detectedTools.length > 0 && (
          <div
            style={{
              padding: '1.2% 3.5% 1.5%',
              overflow: 'hidden',
              flexShrink: 1,
              minHeight: 0,
            }}
          >
            <h3
              className="font-display uppercase"
              style={{
                fontSize: T.section,
                fontWeight: 600,
                letterSpacing: '0.15em',
                color: 'var(--gs-base)',
                marginBottom: '0.5em',
              }}
            >
              Detected Stack
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35em', overflow: 'hidden' }}>
              {detectedTools.map((t) => (
                <span
                  key={t.name}
                  className="font-data"
                  style={{
                    fontSize: T.meta,
                    color: 'var(--gs-light)',
                    padding: '0.2em 0.6em',
                    borderRadius: '3px',
                    background: 'rgba(255,178,239,0.06)',
                    border: '1px solid rgba(255,178,239,0.08)',
                  }}
                >
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        )}


      </div>

      {/* Brand strip */}
      <div
        className="absolute left-0 right-0 bottom-0 overflow-hidden"
        style={{
          background: 'var(--gs-base)',
          height: 'clamp(1px, 2.10cqi, 28px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {slideNumber && (
          <span className="font-data" style={{ position: 'absolute', right: '3.5%', fontSize: 'clamp(1px, 0.90cqi, 14px)', color: '#080808', opacity: 0.4 }}>
            {slideNumber}
          </span>
        )}
        <pre
          className="font-data leading-none whitespace-pre select-none"
          style={{
            fontSize: 'clamp(1.5px, 0.25cqi, 3px)',
            lineHeight: '1.1',
            color: '#080808',
          }}
        >
{` █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`}
        </pre>
      </div>
    </div>
  );
}
