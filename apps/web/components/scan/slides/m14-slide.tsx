'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  CheckItem,
  Pill,
  SkippedSlide,
} from './module-slide-template';

/**
 * M14 Slide — Mobile & Responsive
 * ════════════════════════════════
 *
 * Layout D: SlideShell with a 2x4 CheckItem grid showing
 * device readiness signals.
 */

export function M14Slide({ scan, onAskChloe, slideNumber }: { scan: ScanWithResults; onAskChloe?: () => void; slideNumber?: string }) {
  const syn = getM41Summary(scan, 'M14');
  const mod = getModuleResult(scan, 'M14');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Mobile & Responsive" scan={scan} sourceLabel="Source: Viewport analysis, breakpoint detection, touch targets" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Mobile responsiveness and device readiness';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const desktopAudit = (raw?.['desktopAudit'] as Record<string, unknown> | undefined) ?? null;
  const mobileAudit = (raw?.['mobileAudit'] as Record<string, unknown> | undefined) ?? null;
  const domComplexity = (raw?.['domComplexity'] as Record<string, unknown> | undefined) ?? null;
  const responsiveImages = (raw?.['responsiveImages'] as Record<string, unknown> | undefined) ?? null;
  const fontLoading = (raw?.['fontLoading'] as Record<string, unknown> | undefined) ?? null;
  const breakpoints = (raw?.['breakpoints'] as number[] | undefined) ?? [];
  const modernCSSFeatures = (raw?.['modernCSSFeatures'] as Record<string, unknown> | undefined) ?? null;

  // Viewport
  const viewportContent = typeof desktopAudit?.['viewportContent'] === 'string' ? desktopAudit['viewportContent'] as string : null;
  const hasViewportMeta = viewportContent != null && viewportContent.includes('width=device-width');
  const zoomBlocked = desktopAudit?.['zoomBlocked'] === true;

  // Mobile audit
  const hasHorizontalScroll = mobileAudit?.['hasHorizontalScroll'] === true;
  const smallTargets = typeof mobileAudit?.['smallTargets'] === 'number' ? mobileAudit['smallTargets'] as number : 0;
  const totalTargets = typeof mobileAudit?.['totalTargets'] === 'number' ? mobileAudit['totalTargets'] as number : 0;
  const smallTextCount = typeof mobileAudit?.['smallTextCount'] === 'number' ? mobileAudit['smallTextCount'] as number : 0;
  const checkedText = typeof mobileAudit?.['checkedText'] === 'number' ? mobileAudit['checkedText'] as number : 0;
  const hasHamburger = mobileAudit?.['hasHamburger'] === true;
  const hasMediaQueries = mobileAudit?.['hasMediaQueries'] === true;
  const mediaQueryCount = typeof mobileAudit?.['mediaQueryCount'] === 'number' ? mobileAudit['mediaQueryCount'] as number : 0;
  const hiddenOnMobile = typeof mobileAudit?.['hiddenOnMobile'] === 'number' ? mobileAudit['hiddenOnMobile'] as number : 0;

  // DOM complexity
  const totalNodes = typeof domComplexity?.['totalNodes'] === 'number' ? domComplexity['totalNodes'] as number : null;
  const maxDepth = typeof domComplexity?.['maxDepth'] === 'number' ? domComplexity['maxDepth'] as number : null;
  const domLevel = totalNodes != null ? (totalNodes > 3000 ? 'high' : totalNodes > 1500 ? 'medium' : 'low') : null;

  // Responsive images
  const hasResponsiveImages = responsiveImages?.['hasResponsiveImages'] === true;
  const srcsetCount = typeof responsiveImages?.['srcsetCount'] === 'number' ? responsiveImages['srcsetCount'] as number : 0;
  const oversizedCount = typeof responsiveImages?.['oversizedCount'] === 'number' ? responsiveImages['oversizedCount'] as number : 0;

  // Font loading
  const totalFonts = typeof fontLoading?.['totalFonts'] === 'number' ? fontLoading['totalFonts'] as number : 0;

  // Touch target calc
  const touchAdequate = totalTargets > 0 ? ((totalTargets - smallTargets) / totalTargets) >= 0.8 : true;

  // Text readability
  const textOk = checkedText > 0 ? ((checkedText - smallTextCount) / checkedText) >= 0.8 : true;

  // Modern CSS
  const hasDarkMode = modernCSSFeatures?.['hasDarkMode'] === true;
  const hasReducedMotion = modernCSSFeatures?.['hasReducedMotion'] === true;

  // Build checklist items
  const checks: Array<{ status: 'pass' | 'fail' | 'warn'; label: string; detail?: string }> = [
    {
      status: hasViewportMeta ? (zoomBlocked ? 'warn' : 'pass') : 'fail',
      label: 'Viewport Meta Tag',
      detail: hasViewportMeta ? (zoomBlocked ? 'Zoom restricted' : 'Properly configured') : 'Missing',
    },
    {
      status: breakpoints.length > 0 || hasMediaQueries ? 'pass' : 'warn',
      label: 'Breakpoints Detected',
      detail: breakpoints.length > 0 ? `${breakpoints.length} breakpoints` : hasMediaQueries ? `${mediaQueryCount} media queries` : 'None found',
    },
    {
      status: touchAdequate ? 'pass' : 'warn',
      label: 'Touch Targets Adequate',
      detail: totalTargets > 0 ? `${totalTargets - smallTargets}/${totalTargets} pass 44px` : 'No targets',
    },
    {
      status: totalFonts > 0 ? 'pass' : 'pass',
      label: 'Font Loading',
      detail: totalFonts > 0 ? `${totalFonts} web font(s)` : 'System fonts',
    },
    {
      status: hasResponsiveImages || srcsetCount > 0 ? 'pass' : (oversizedCount > 3 ? 'warn' : 'pass'),
      label: 'Responsive Images',
      detail: srcsetCount > 0 ? `${srcsetCount} with srcset` : oversizedCount > 0 ? `${oversizedCount} oversized` : 'OK',
    },
    {
      status: domLevel === 'high' ? 'warn' : 'pass',
      label: 'DOM Complexity',
      detail: totalNodes != null ? `${totalNodes.toLocaleString()} nodes, depth ${maxDepth ?? '?'}` : 'Unknown',
    },
    {
      status: !hasHorizontalScroll ? 'pass' : 'fail',
      label: 'No Horizontal Scroll',
      detail: hasHorizontalScroll ? 'Overflow at 375px' : 'Clean at 375px',
    },
    {
      status: textOk ? 'pass' : 'warn',
      label: 'Text Readability',
      detail: checkedText > 0 ? `${smallTextCount} of ${checkedText} too small` : 'OK',
    },
  ];

  return (
    <SlideShell
      moduleName="Mobile & Responsive"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Viewport analysis, breakpoint detection, touch targets"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      onAskChloe={onAskChloe}
      slideNumber={slideNumber}
    >
      {/* ═══ Device Readiness Grid ═══ */}
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0',
        borderTop: '1px solid rgba(255,178,239,0.06)',
        borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
          Device Readiness
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3em 1.5em' }}>
          {checks.map((c, i) => (
            <CheckItem key={i} status={c.status} label={c.label} detail={c.detail} />
          ))}
        </div>

        {/* Extra info row */}
        <div style={{ display: 'flex', gap: '0.6em', flexWrap: 'wrap', marginTop: '0.4em' }}>
          {hasHamburger && <Pill text="Mobile Nav" color="var(--gs-terminal)" />}
          {hasDarkMode && <Pill text="Dark Mode CSS" color="var(--gs-terminal)" />}
          {hasReducedMotion && <Pill text="Reduced Motion" color="var(--gs-terminal)" />}
          {hiddenOnMobile > 0 && <Pill text={`${hiddenOnMobile} hidden on mobile`} color="var(--gs-warning)" />}
          {breakpoints.length > 0 && (
            <span className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)' }}>
              Breakpoints: {breakpoints.slice(0, 5).map(b => `${b}px`).join(', ')}
            </span>
          )}
        </div>
      </div>
    </SlideShell>
  );
}
