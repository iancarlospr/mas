'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShellAlt,
  getM41Summary,
  getModuleResult,
  CheckItem,
  Pill,
  HorizontalBar,
  SkippedSlide,
} from './module-slide-template';

/**
 * M06b Slide — PPC Landing Audit
 * ═══════════════════════════════
 *
 * Layout B: SlideShellAlt — left panel shows Landing vs Homepage parity,
 * CTA analysis, and load time badge.
 */

export function M06bSlide({ scan, onAskChloe, slideNumber }: { scan: ScanWithResults; onAskChloe?: () => void; slideNumber?: string }) {
  const syn = getM41Summary(scan, 'M06b');
  const mod = getModuleResult(scan, 'M06b');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="PPC Landing Audit" scan={scan} sourceLabel="Source: Landing page analysis, tracking parity, conversion paths" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'PPC landing page conversion readiness';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const pageAudit = (raw?.['pageAudit'] as Record<string, unknown> | undefined) ?? null;
  const homepageBaseline = (raw?.['homepageBaseline'] as Record<string, unknown> | undefined) ?? null;
  const trackingParity = (raw?.['trackingParity'] as Record<string, unknown> | undefined) ?? null;
  const loadTimeMs = typeof raw?.['loadTimeMs'] === 'number' ? raw['loadTimeMs'] as number : 0;
  const ctaAnalysis = (raw?.['ctaAnalysis'] as Record<string, unknown> | undefined) ?? null;
  const isRealPaidPage = raw?.['isRealPaidPage'] === true;

  // Parity data
  const parityRatio = typeof trackingParity?.['parityRatio'] === 'number' ? trackingParity['parityRatio'] as number : null;
  const missingTrackers = (trackingParity?.['missing'] as string[] | undefined) ?? [];
  const matchedTrackers = (trackingParity?.['paidPageTrackingSet'] as string[] | undefined) ?? [];

  // Page audit signals
  const hasGA4 = pageAudit?.['hasGA4'] === true;
  const hasGTM = pageAudit?.['hasGTM'] === true;
  const hasMetaPixel = pageAudit?.['hasMetaPixel'] === true;
  const hasConsent = pageAudit?.['hasConsent'] === true;
  const ctaAboveFold = pageAudit?.['ctaAboveFold'] === true;
  const ctaText = typeof pageAudit?.['ctaText'] === 'string' ? pageAudit['ctaText'] as string : null;
  const formCount = typeof pageAudit?.['formCount'] === 'number' ? pageAudit['formCount'] as number : 0;
  const hasNoindex = pageAudit?.['hasNoindex'] === true;
  const h1Text = typeof pageAudit?.['h1Text'] === 'string' ? pageAudit['h1Text'] as string : null;
  const navLinkCount = typeof pageAudit?.['navLinkCount'] === 'number' ? pageAudit['navLinkCount'] as number : 0;

  // Load time color
  const loadColor = loadTimeMs < 3000 ? 'var(--gs-terminal)' : loadTimeMs < 5000 ? 'var(--gs-warning)' : 'var(--gs-critical)';

  const vizContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
      {/* Tracking Parity Section */}
      <div>
        <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.3em' }}>
          Landing vs Homepage Parity
        </h4>

        {parityRatio != null && (
          <div style={{ marginBottom: '0.3em' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.15em' }}>
              <span className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 14px)', color: 'var(--gs-light)' }}>
                Tracking Parity
              </span>
              <span className="font-data tabular-nums" style={{
                fontSize: 'clamp(1px, 1.20cqi, 18px)', fontWeight: 700,
                color: parityRatio >= 0.9 ? 'var(--gs-terminal)' : parityRatio >= 0.6 ? 'var(--gs-warning)' : 'var(--gs-critical)',
              }}>
                {Math.round(parityRatio * 100)}%
              </span>
            </div>
            <HorizontalBar value={parityRatio * 100} max={100} color={parityRatio >= 0.9 ? 'var(--gs-terminal)' : parityRatio >= 0.6 ? 'var(--gs-warning)' : 'var(--gs-critical)'} />
          </div>
        )}

        {/* Matched trackers */}
        {matchedTrackers.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em', marginBottom: '0.2em' }}>
            {matchedTrackers.map((t, i) => (
              <Pill key={i} text={t} color="var(--gs-terminal)" />
            ))}
          </div>
        )}

        {/* Missing trackers */}
        {missingTrackers.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em', marginBottom: '0.2em' }}>
            {missingTrackers.map((t, i) => (
              <Pill key={i} text={`Missing: ${t}`} color="var(--gs-critical)" />
            ))}
          </div>
        )}
      </div>

      {/* Page Signals Checklist */}
      <div>
        <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.25em' }}>
          Conversion Readiness
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25em 0.8em' }}>
          <CheckItem status={ctaAboveFold ? 'pass' : 'fail'} label="CTA Above Fold" detail={ctaText ?? undefined} />
          <CheckItem status={formCount > 0 ? 'pass' : 'warn'} label={`Forms: ${formCount}`} />
          <CheckItem status={hasGA4 ? 'pass' : 'fail'} label="GA4 Present" />
          <CheckItem status={hasGTM ? 'pass' : 'fail'} label="GTM Present" />
          <CheckItem status={hasConsent ? 'pass' : 'warn'} label="Consent Banner" />
          <CheckItem status={navLinkCount <= 10 ? 'pass' : 'warn'} label={`Nav Links: ${navLinkCount}`} />
        </div>
      </div>

      {/* Load Time Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8em', marginTop: '0.2em' }}>
        {loadTimeMs > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'baseline', gap: '0.3em',
            padding: '0.25em 0.6em', borderRadius: '3px',
            background: `color-mix(in srgb, ${loadColor} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${loadColor} 20%, transparent)`,
          }}>
            <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.35cqi, 20px)', fontWeight: 700, color: loadColor }}>
              {loadTimeMs < 1000 ? `${loadTimeMs}ms` : `${(loadTimeMs / 1000).toFixed(1)}s`}
            </span>
            <span className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)' }}>
              load time
            </span>
          </div>
        )}
        {isRealPaidPage && (
          <Pill text="Real PPC Page" color="var(--gs-terminal)" />
        )}
        {hasNoindex && (
          <Pill text="noindex" color="var(--gs-mid)" />
        )}
      </div>

      {/* H1 if available */}
      {h1Text && (
        <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 14px)', color: 'var(--gs-mid)', fontStyle: 'italic', marginTop: '0.1em' }}>
          H1: &ldquo;{h1Text}&rdquo;
        </p>
      )}
    </div>
  );

  return (
    <SlideShellAlt
      moduleName="PPC Landing Audit"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Landing page analysis, tracking parity, conversion paths"
      vizContent={vizContent}
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      onAskChloe={onAskChloe}
      slideNumber={slideNumber}
    />
  );
}
