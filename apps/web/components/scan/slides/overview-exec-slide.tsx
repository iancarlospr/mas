'use client';

import { useRef, useEffect } from 'react';
import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';
import { CATEGORY_DISPLAY_NAMES, type ScoreCategory } from '@marketing-alpha/types';

/**
 * Overview / Executive Summary Slide (Slide 2)
 * ═════════════════════════════════════════════
 *
 * Left ~55%:  About this audit + report index (8 categories, no scores)
 * Right ~45%: Verdict headline (M42) + executive brief + key findings
 *
 * REPORT TYPE SCALE — these slides are documents, not app UI.
 * Uses container-relative (cqi) units so text scales with the slide card
 * width, not the browser viewport. Fallback clamp uses vw for browsers
 * without container query support.
 *
 * Scale:
 *   --rpt-headline:  ~28-36px at full width   (verdict quote)
 *   --rpt-section:   ~14-16px                  (section headers)
 *   --rpt-body:      ~12-14px                  (body paragraphs)
 *   --rpt-index:     ~13-15px                  (index items)
 *   --rpt-meta:      ~10-12px                  (badges, labels, captions)
 *   --rpt-overline:  ~10-11px                  (domain, section nums)
 */

// ── Bayer dither matrix ───────────────────────────────────────────────
const BAYER8 = [
  [ 0,32, 8,40, 2,34,10,42],
  [48,16,56,24,50,18,58,26],
  [12,44, 4,36,14,46, 6,38],
  [60,28,52,20,62,30,54,22],
  [ 3,35,11,43, 1,33, 9,41],
  [51,19,59,27,49,17,57,25],
  [15,47, 7,39,13,45, 5,37],
  [63,31,55,23,61,29,53,21],
];

// ── Report type scale (container-relative with vw fallback) ───────────
const T = {
  headline: 'clamp(22px, 3.6cqi, 36px)',
  section:  'clamp(12px, 1.6cqi, 16px)',
  body:     'clamp(11px, 1.35cqi, 14px)',
  index:    'clamp(12px, 1.45cqi, 15px)',
  meta:     'clamp(9px, 1.1cqi, 12px)',
  overline: 'clamp(9px, 1.05cqi, 11px)',
  badge:    'clamp(8px, 0.95cqi, 10px)',
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

// ── Urgency badge colors ──────────────────────────────────────────────
const URGENCY_STYLES: Record<string, { bg: string; text: string }> = {
  immediate:    { bg: 'rgba(255,80,80,0.15)',   text: 'var(--gs-critical)' },
  this_week:    { bg: 'rgba(255,200,0,0.12)',   text: 'var(--gs-warning)' },
  this_month:   { bg: 'rgba(255,178,239,0.12)', text: 'var(--gs-base)' },
  this_quarter: { bg: 'rgba(255,255,255,0.06)', text: 'var(--gs-mid)' },
};

// ── Types ─────────────────────────────────────────────────────────────
interface KeyFinding {
  finding: string;
  modules: string[];
  business_impact: string;
  urgency: string;
}

interface TechStackSummary {
  analytics: string[];
  advertising: string[];
  automation: string[];
  cms_hosting: string[];
  security: string[];
  other: string[];
}

interface M42Synthesis {
  verdict_headline?: string;
  executive_brief: string;
  key_findings: KeyFinding[];
  tech_stack_summary: TechStackSummary;
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
}

export function OverviewExecSlide({ scan }: OverviewExecSlideProps) {
  const isPaid = scan.tier === 'paid';
  const resultMap = new Map<string, ModuleResult>(
    scan.moduleResults.map((r) => [r.moduleId, r]),
  );
  const moduleCount = scan.moduleResults.filter(
    (r) => r.status === 'success' || r.status === 'partial',
  ).length;
  const categories = scan.marketingIqResult?.categories ?? [];
  const score = scan.marketingIq;

  // M41 data
  const m41 = resultMap.get('M41');
  const businessContext = (m41?.data?.['businessContext'] as BusinessContext | undefined) ?? null;

  // M42 data (paid only)
  const m42 = resultMap.get('M42');
  const synthesis = isPaid
    ? (m42?.data?.['synthesis'] as M42Synthesis | undefined) ?? null
    : null;

  // Verdict headline
  const headline = synthesis?.verdict_headline ?? null;

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

  // Key findings (paid only)
  const keyFindings = synthesis?.key_findings ?? [];

  // Tech stack (compact, for left panel bottom)
  const techStack = (() => {
    if (synthesis?.tech_stack_summary) return synthesis.tech_stack_summary;
    const ts = businessContext?.techStack;
    if (!ts) return null;
    const infra = [ts.cms, ts.framework, ts.cdn, ts.hosting].filter(Boolean) as string[];
    if (infra.length === 0) return null;
    return { infrastructure: infra } as Partial<TechStackSummary>;
  })();

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

      <div className="relative z-10 h-full flex">

        {/* ── LEFT PANEL (~55%) — About + Index ── */}
        <div
          className="flex flex-col"
          style={{ width: '50%', padding: '4.5% 3% 4% 5%' }}
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

          {/* Report Index — category list, NO scores */}
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
              marginBottom: '1.5em',
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

          {/* Tech Stack (compact) */}
          {techStack && (
            <div style={{ marginTop: 'auto' }}>
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4em' }}>
                {Object.entries(techStack)
                  .filter(([, tools]) => tools && (tools as string[]).length > 0)
                  .flatMap(([, tools]) => tools as string[])
                  .slice(0, 12)
                  .map((tool) => (
                    <span
                      key={tool}
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
                      {tool}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div
          style={{
            width: '1px',
            background: 'linear-gradient(to bottom, transparent 5%, rgba(255,178,239,0.1) 30%, rgba(255,178,239,0.1) 70%, transparent 95%)',
            flexShrink: 0,
          }}
        />

        {/* ── RIGHT PANEL (~45%) — Headline + Brief + Findings + URL ── */}
        <div
          className="flex flex-col"
          style={{ width: '50%', padding: '4.5% 5% 4% 3.5%' }}
        >
          {/* Verdict Headline (paid, from M42) — top of panel */}
          {headline && (
            <h2
              className="font-display"
              style={{
                fontSize: T.headline,
                fontWeight: 600,
                lineHeight: 1.15,
                color: 'var(--gs-light)',
                marginBottom: '0.7em',
              }}
            >
              &ldquo;{headline}&rdquo;
            </h2>
          )}

          {/* Executive Brief */}
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
            Executive Brief
          </h3>
          <div
            className="font-data"
            style={{
              fontSize: T.body,
              lineHeight: 1.7,
              color: 'var(--gs-light)',
              opacity: 0.85,
              marginBottom: '1.5em',
            }}
          >
            {briefText.split('\n').map((para, i) => (
              <p key={i} style={{ marginBottom: i < briefText.split('\n').length - 1 ? '0.65em' : 0 }}>
                {para}
              </p>
            ))}
          </div>

          {/* Key Findings (paid only) */}
          {keyFindings.length > 0 && (
            <div style={{ minHeight: 0 }}>
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
                Key Findings
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9em' }}>
                {keyFindings.slice(0, 3).map((f, i) => {
                  const urgency = URGENCY_STYLES[f.urgency] ?? URGENCY_STYLES['this_quarter']!;
                  return (
                    <div key={i} style={{ display: 'flex', gap: '0.6em', alignItems: 'flex-start' }}>
                      <span
                        className="font-data uppercase flex-shrink-0"
                        style={{
                          fontSize: T.badge,
                          letterSpacing: '0.06em',
                          padding: '0.15em 0.5em',
                          borderRadius: '3px',
                          background: urgency.bg,
                          color: urgency.text,
                          marginTop: '0.15em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {f.urgency.replace(/_/g, ' ')}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <p
                          className="font-data"
                          style={{
                            fontSize: T.body,
                            color: 'var(--gs-light)',
                            lineHeight: 1.45,
                          }}
                        >
                          {f.finding}
                        </p>
                        <p
                          className="font-data"
                          style={{
                            fontSize: T.meta,
                            color: 'var(--gs-mid)',
                            lineHeight: 1.4,
                            marginTop: '0.2em',
                          }}
                        >
                          {f.business_impact}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      <DitherStrip />
    </div>
  );
}

// ── Dither Strip ──────────────────────────────────────────────────────

function DitherStrip() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = container.offsetWidth;
    const h = container.offsetHeight;
    if (w === 0 || h === 0) return;

    const px = 2;
    const cols = Math.ceil(w / px);
    const rows = Math.ceil(h / px);

    canvas.width = cols;
    canvas.height = rows;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.style.imageRendering = 'pixelated';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(cols, rows);
    const data = imageData.data;
    const r = 255, g = 178, b = 239;

    for (let y = 0; y < rows; y++) {
      const yRatio = y / rows;
      const vDensity = Math.min(0.35, Math.pow(yRatio, 2));
      for (let x = 0; x < cols; x++) {
        const xRatio = x / cols;
        const hFade = 1.0 - Math.pow(1.0 - xRatio, 1.4) * 0.85;
        const intensity = vDensity * hFade * 0.5;
        const threshold = (BAYER8[y % 8]![x % 8]!) / 64;
        const idx = (y * cols + x) * 4;
        if (intensity > threshold) {
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = Math.round(intensity * 255 * 0.6);
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0 pointer-events-none"
      style={{ height: '60px', zIndex: 5 }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
