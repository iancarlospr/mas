'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  CheckItem,
  SkippedSlide,
} from './module-slide-template';

/**
 * M15 Slide — Social & Sharing
 * =============================
 * Layout D (Checklist): SlideShell with a mock social card preview + OG/Twitter property checklist.
 *
 * Visualization:
 *   - Mock social share card (dark border, og:image placeholder, title, description)
 *   - Grid of OG/Twitter properties as CheckItems with content values
 *   - Social profile links & share button counts
 */

export function M15Slide({ scan, onAskChloe, slideNumber }: { scan: ScanWithResults; onAskChloe?: () => void; slideNumber?: string }) {
  const syn = getM41Summary(scan, 'M15');
  const mod = getModuleResult(scan, 'M15');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Social & Sharing" scan={scan} sourceLabel="Source: Open Graph, Twitter Card, social metadata inspection" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Social sharing metadata assessment';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract social data ────────────────────────────────────────────────
  const socialData = (raw?.['socialData'] as Record<string, unknown> | undefined) ?? {};
  const ogTags = (socialData['ogTags'] as Record<string, string> | undefined) ?? {};
  const twitterTags = (socialData['twitterTags'] as Record<string, string> | undefined) ?? {};
  const shareButtons = (socialData['shareButtons'] as string[] | undefined) ?? [];
  const profileLinks = (socialData['profileLinks'] as string[] | undefined) ?? [];

  // Also check if og data is directly on raw (fallback)
  const ogTitle = ogTags['og:title'] ?? (raw?.['og_title'] as string | undefined) ?? '';
  const ogDesc = ogTags['og:description'] ?? (raw?.['og_description'] as string | undefined) ?? '';
  const ogImage = ogTags['og:image'] ?? (raw?.['og_image'] as string | undefined) ?? '';
  const ogUrl = ogTags['og:url'] ?? (raw?.['og_url'] as string | undefined) ?? '';
  const ogType = ogTags['og:type'] ?? '';
  const ogSiteName = ogTags['og:site_name'] ?? '';

  const twCard = twitterTags['twitter:card'] ?? (raw?.['twitter_card'] as string | undefined) ?? '';
  const twTitle = twitterTags['twitter:title'] ?? (raw?.['twitter_title'] as string | undefined) ?? '';
  const twDesc = twitterTags['twitter:description'] ?? (raw?.['twitter_description'] as string | undefined) ?? '';
  const twImage = twitterTags['twitter:image'] ?? (raw?.['twitter_image'] as string | undefined) ?? '';
  const twSite = twitterTags['twitter:site'] ?? '';

  const displayTitle = ogTitle || twTitle || scan.domain;
  const displayDesc = ogDesc || twDesc || '';

  // ── Property checks ────────────────────────────────────────────────────
  const ogProperties = [
    { label: 'og:title', value: ogTitle, present: !!ogTitle },
    { label: 'og:description', value: ogDesc, present: !!ogDesc },
    { label: 'og:image', value: ogImage ? 'Set' : '', present: !!ogImage },
    { label: 'og:url', value: ogUrl, present: !!ogUrl },
    { label: 'og:type', value: ogType, present: !!ogType },
    { label: 'og:site_name', value: ogSiteName, present: !!ogSiteName },
  ];

  const twProperties = [
    { label: 'twitter:card', value: twCard, present: !!twCard },
    { label: 'twitter:title', value: twTitle, present: !!twTitle },
    { label: 'twitter:description', value: twDesc, present: !!twDesc },
    { label: 'twitter:image', value: twImage ? 'Set' : '', present: !!twImage },
    { label: 'twitter:site', value: twSite, present: !!twSite },
  ];

  return (
    <SlideShell
      moduleName="Social & Sharing"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Open Graph, Twitter Card, social metadata inspection"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      onAskChloe={onAskChloe}
      slideNumber={slideNumber}
    >
      <div style={{
        display: 'flex', gap: '3%', marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>

        {/* Mock social preview card */}
        <div style={{ flex: '0 0 32%' }}>
          <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.3em' }}>
            Social Preview
          </p>
          <div style={{
            border: '1px solid rgba(255,178,239,0.12)', borderRadius: '6px', overflow: 'hidden',
            background: 'rgba(255,255,255,0.02)',
          }}>
            {/* Image area — 1.91:1 aspect ratio matching real social cards, proxied to avoid CORS */}
            {ogImage ? (
              <div style={{
                aspectRatio: '1.91 / 1', borderBottom: '1px solid rgba(255,178,239,0.06)',
                overflow: 'hidden', background: 'rgba(255,255,255,0.02)',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/og-image?url=${encodeURIComponent(ogImage)}`}
                  alt="og:image preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    el.style.display = 'none';
                    if (el.parentElement) el.parentElement.style.height = '0px';
                  }}
                />
              </div>
            ) : (
              <div style={{
                aspectRatio: '1.91 / 1', background: 'rgba(255,255,255,0.03)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderBottom: '1px solid rgba(255,178,239,0.06)',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gs-mid)" strokeWidth="1.5" opacity={0.3}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            )}
            {/* Text content */}
            <div style={{ padding: '0.4em 0.5em' }}>
              <p className="font-data" style={{
                fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-light)', fontWeight: 600,
                lineHeight: 1.25, marginBottom: '0.15em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {displayTitle}
              </p>
              {displayDesc && (
                <p className="font-data" style={{
                  fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', lineHeight: 1.3,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {displayDesc}
                </p>
              )}
              <p className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', opacity: 0.5, marginTop: '0.15em' }}>
                {scan.domain}
              </p>
            </div>
          </div>

          {/* Social profiles & share buttons */}
          {(profileLinks.length > 0 || shareButtons.length > 0) && (
            <div style={{ marginTop: '0.4em', display: 'flex', flexDirection: 'column', gap: '0.15em' }}>
              {profileLinks.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3em', flexWrap: 'wrap' }}>
                  <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)' }}>Profiles:</span>
                  <span className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-light)' }}>
                    {profileLinks.join(', ')}
                  </span>
                </div>
              )}
              {shareButtons.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3em', flexWrap: 'wrap' }}>
                  <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)' }}>Share:</span>
                  <span className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-light)' }}>
                    {shareButtons.join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', background: 'rgba(255,178,239,0.1)', flexShrink: 0 }} />

        {/* OG & Twitter property checklist */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
          {/* OG Tags */}
          <div>
            <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.2em' }}>
              Open Graph
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.15em 1em' }}>
              {ogProperties.map((p) => (
                <CheckItem
                  key={p.label}
                  status={p.present ? 'pass' : 'fail'}
                  label={p.label.replace('og:', '')}
                  detail={p.present && p.value !== 'Set' ? (p.value.length > 35 ? p.value.slice(0, 35) + '...' : p.value) : undefined}
                />
              ))}
            </div>
          </div>

          {/* Twitter Cards */}
          <div>
            <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.2em' }}>
              Twitter Card
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.15em 1em' }}>
              {twProperties.map((p) => (
                <CheckItem
                  key={p.label}
                  status={p.present ? 'pass' : 'warn'}
                  label={p.label.replace('twitter:', '')}
                  detail={p.present && p.value !== 'Set' ? (p.value.length > 30 ? p.value.slice(0, 30) + '...' : p.value) : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideShell>
  );
}
