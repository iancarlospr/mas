'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShellAlt,
  getM41Summary,
  getModuleResult,
  scoreColor,
  HorizontalBar,
  RankedBar,
  StatBlock,
  CheckItem,
  SkippedSlide,
} from './module-slide-template';

/**
 * M10 Slide — Accessibility
 * ═════════════════════════
 *
 * Layout E: SlideShellAlt with ranked bars for WCAG compliance areas,
 * plus coverage bars for image alt text, form labels, link accessibility.
 */

export function M10Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M10');
  const mod = getModuleResult(scan, 'M10');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Accessibility" scan={scan} sourceLabel="Source: ARIA audit, form labels, color contrast, image alt text" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Web accessibility and WCAG compliance audit';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const a11y = (raw?.['a11y'] as Record<string, unknown> | undefined) ?? null;
  const formAccessibility = (raw?.['formAccessibility'] as Record<string, unknown> | undefined) ?? null;
  const imageAccessibility = (raw?.['imageAccessibility'] as Record<string, unknown> | undefined) ?? null;
  const linkAccessibility = (raw?.['linkAccessibility'] as Record<string, unknown> | undefined) ?? null;

  // Image alt text
  const images = (a11y?.['images'] as Record<string, unknown> | undefined) ?? null;
  const imgTotal = typeof images?.['total'] === 'number' ? images['total'] as number
    : typeof imageAccessibility?.['totalImages'] === 'number' ? imageAccessibility['totalImages'] as number
    : 0;
  const imgWithAlt = typeof images?.['withAlt'] === 'number' ? images['withAlt'] as number : 0;
  const imgMissing = typeof imageAccessibility?.['missingAlt'] === 'number' ? imageAccessibility['missingAlt'] as number : imgTotal - imgWithAlt;
  const altCoverage = typeof imageAccessibility?.['altTextCoverage'] === 'number'
    ? imageAccessibility['altTextCoverage'] as number
    : imgTotal > 0 ? Math.round((imgWithAlt / imgTotal) * 100) : 100;

  // Form labels
  const forms = (a11y?.['forms'] as Record<string, unknown> | undefined) ?? null;
  const formTotal = typeof forms?.['total'] === 'number' ? forms['total'] as number
    : typeof formAccessibility?.['totalFields'] === 'number' ? formAccessibility['totalFields'] as number
    : 0;
  const formLabeled = typeof forms?.['withLabel'] === 'number' ? forms['withLabel'] as number : 0;
  const labelCoverage = typeof formAccessibility?.['labelCoverage'] === 'number'
    ? formAccessibility['labelCoverage'] as number
    : formTotal > 0 ? Math.round((formLabeled / formTotal) * 100) : 100;

  // Link accessibility
  const totalLinks = typeof linkAccessibility?.['totalLinks'] === 'number' ? linkAccessibility['totalLinks'] as number : 0;
  const emptyAnchors = typeof linkAccessibility?.['emptyAnchors'] === 'number' ? linkAccessibility['emptyAnchors'] as number : 0;
  const javascriptLinks = typeof linkAccessibility?.['javascriptLinks'] === 'number' ? linkAccessibility['javascriptLinks'] as number : 0;
  const linkIssues = emptyAnchors + javascriptLinks;
  const linkCoverage = totalLinks > 0 ? Math.round(((totalLinks - linkIssues) / totalLinks) * 100) : 100;

  // Heading hierarchy
  const headings = (a11y?.['headings'] as Record<string, unknown> | undefined) ?? null;
  const h1Count = typeof headings?.['h1Count'] === 'number' ? headings['h1Count'] as number : 0;
  const headingCount = typeof headings?.['count'] === 'number' ? headings['count'] as number : 0;
  const hasSkippedLevels = headings?.['hasSkippedLevels'] === true;

  // Landmarks
  const hasLandmarks = a11y?.['hasLandmarks'] === true;
  const landmarks = (a11y?.['landmarks'] as Record<string, unknown> | undefined) ?? null;

  // Focus
  const focusRemoved = a11y?.['focusRemoved'] === true;
  const hasFocusVisible = a11y?.['hasFocusVisible'] === true;
  const hasLang = a11y?.['hasLang'] === true;
  const hasSkipNav = a11y?.['hasSkipNav'] === true;

  // ARIA issues
  const ariaIssues = (a11y?.['ariaIssues'] as Record<string, unknown> | undefined) ?? null;
  const hiddenFocusable = typeof ariaIssues?.['hiddenFocusable'] === 'number' ? ariaIssues['hiddenFocusable'] as number : 0;
  const emptyButtons = typeof ariaIssues?.['emptyButtons'] === 'number' ? ariaIssues['emptyButtons'] as number : 0;
  const totalAriaIssues = hiddenFocusable + emptyButtons;

  // Overlays
  const overlays = (a11y?.['overlays'] as string[] | undefined) ?? [];

  // Coverage color helper
  const coverageColor = (pct: number) => pct >= 90 ? 'var(--gs-terminal)' : pct >= 70 ? 'var(--gs-warning)' : 'var(--gs-critical)';

  const vizContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
      <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.1em' }}>
        WCAG Compliance
      </h4>

      {/* Coverage bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
        {/* Image Alt Text */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.1em' }}>
            <span className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 14px)', color: 'var(--gs-light)' }}>
              Image Alt Text
            </span>
            <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.86cqi, 14px)', fontWeight: 600, color: coverageColor(altCoverage) }}>
              {altCoverage}%
            </span>
          </div>
          <HorizontalBar value={altCoverage} max={100} color={coverageColor(altCoverage)} />
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)' }}>
            {imgWithAlt}/{imgTotal} images{imgMissing > 0 ? ` · ${imgMissing} missing` : ''}
          </span>
        </div>

        {/* Form Labels */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.1em' }}>
            <span className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 14px)', color: 'var(--gs-light)' }}>
              Form Labels
            </span>
            <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.86cqi, 14px)', fontWeight: 600, color: coverageColor(labelCoverage) }}>
              {labelCoverage}%
            </span>
          </div>
          <HorizontalBar value={labelCoverage} max={100} color={coverageColor(labelCoverage)} />
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)' }}>
            {formLabeled}/{formTotal} fields labeled
          </span>
        </div>

        {/* Link Accessibility */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.1em' }}>
            <span className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 14px)', color: 'var(--gs-light)' }}>
              Link Accessibility
            </span>
            <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.86cqi, 14px)', fontWeight: 600, color: coverageColor(linkCoverage) }}>
              {linkCoverage}%
            </span>
          </div>
          <HorizontalBar value={linkCoverage} max={100} color={coverageColor(linkCoverage)} />
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)' }}>
            {totalLinks} links{linkIssues > 0 ? ` · ${linkIssues} issues` : ''}
          </span>
        </div>
      </div>

      {/* Structural checks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25em 0.8em', marginTop: '0.2em' }}>
        <CheckItem
          status={h1Count === 1 && !hasSkippedLevels ? 'pass' : h1Count === 0 ? 'fail' : 'warn'}
          label="Heading Hierarchy"
          detail={`${h1Count} H1, ${headingCount} total${hasSkippedLevels ? ', skipped levels' : ''}`}
        />
        <CheckItem
          status={hasLandmarks ? 'pass' : 'warn'}
          label="ARIA Landmarks"
          detail={landmarks ? `main: ${landmarks['main'] ?? 0}, nav: ${landmarks['navigation'] ?? 0}` : undefined}
        />
        <CheckItem
          status={hasLang ? 'pass' : 'fail'}
          label="Language Attribute"
        />
        <CheckItem
          status={!focusRemoved || hasFocusVisible ? 'pass' : 'fail'}
          label="Focus Indicators"
          detail={hasFocusVisible ? ':focus-visible' : focusRemoved ? 'outline removed' : undefined}
        />
        <CheckItem
          status={hasSkipNav ? 'pass' : 'warn'}
          label="Skip Navigation"
        />
        <CheckItem
          status={totalAriaIssues === 0 ? 'pass' : totalAriaIssues > 5 ? 'fail' : 'warn'}
          label="ARIA Usage"
          detail={totalAriaIssues > 0 ? `${totalAriaIssues} issues` : 'Clean'}
        />
      </div>

      {/* Overlay warning */}
      {overlays.length > 0 && (
        <div style={{
          padding: '0.3em 0.5em', borderRadius: '3px', marginTop: '0.15em',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
        }}>
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-critical)' }}>
            Accessibility overlay detected: {overlays.join(', ')} — overlays are not a substitute for native WCAG compliance
          </span>
        </div>
      )}
    </div>
  );

  return (
    <SlideShellAlt
      moduleName="Accessibility"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: ARIA audit, form labels, color contrast, image alt text"
      vizContent={vizContent}
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    />
  );
}
