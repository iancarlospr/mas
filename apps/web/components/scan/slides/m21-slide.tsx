'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShellAlt,
  getM41Summary,
  getModuleResult,
  StatBlock,
  SkippedSlide,
} from './module-slide-template';

/**
 * M21 Slide — Ad Library Intelligence
 * =====================================
 * Layout B (SlideShellAlt): left panel = platform coverage viz, right = findings/recs.
 *
 * Visualization:
 *   - Platform coverage cards (Facebook/Meta, Google Search)
 *   - Active/inactive status indicators per platform
 *   - Summary stats: total images captured, platforms active
 */

// ── Platform status card ────────────────────────────────────────────────
function PlatformCard({ name, active, adCount, icon }: {
  name: string;
  active: boolean;
  adCount: number;
  icon: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5em',
      padding: '0.4em 0.6em', borderRadius: '4px',
      background: active ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)'}`,
    }}>
      {/* Icon */}
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
        background: active ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-light)', fontWeight: 600, lineHeight: 1.2 }}>
          {name}
        </p>
        <p className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: active ? 'var(--gs-terminal)' : 'var(--gs-mid)', lineHeight: 1.2 }}>
          {active ? `${adCount} ad${adCount !== 1 ? 's' : ''} found` : 'No ads detected'}
        </p>
      </div>

      {/* Status dot */}
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
        background: active ? 'var(--gs-terminal)' : 'rgba(255,255,255,0.1)',
        boxShadow: active ? '0 0 6px var(--gs-terminal)' : 'none',
      }} />
    </div>
  );
}

// ── Simple platform SVG icons ──────────────────────────────────────────
function MetaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="var(--gs-base)" strokeWidth="1.2" />
      <path d="M4 7c0-1.5.7-2.5 1.5-2.5S7 5.5 7 7s-.7 2.5-1.5 2.5S4 8.5 4 7z" fill="var(--gs-base)" opacity="0.6" />
      <path d="M7 7c0-1.5.7-2.5 1.5-2.5S10 5.5 10 7s-.7 2.5-1.5 2.5S7 8.5 7 7z" fill="var(--gs-base)" opacity="0.6" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 3.5c1 0 1.8.4 2.4 1L11 3a5.5 5.5 0 10-2 9.2c2.5-.8 3.5-3.2 3.2-5.2H7v2h3.1c-.3 1-1.2 1.8-2.3 2a3.5 3.5 0 01-2.6-6z" fill="var(--gs-base)" opacity="0.7" />
    </svg>
  );
}

export function M21Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M21');
  const mod = getModuleResult(scan, 'M21');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Ad Library Intelligence" scan={scan} sourceLabel="Source: Meta Ad Library, Google Ads Transparency" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Ad library and paid creative analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data (very defensive) ─────────────────────────────────
  const summary = (raw?.['summary'] as Record<string, unknown> | undefined) ?? {};
  const facebookActive = summary['facebookActive'] === true;
  const googleSearchActive = summary['googleSearchActive'] === true;
  const totalImages = typeof summary['totalImages'] === 'number' ? summary['totalImages'] as number : 0;

  // Facebook data
  const fbObj = raw?.['facebook'] as Record<string, unknown> | undefined;
  const fbTotalAds = typeof fbObj?.['totalAdsVisible'] === 'number' ? fbObj['totalAdsVisible'] as number : 0;

  // Google data
  const googleObj = raw?.['google'] as Record<string, unknown> | undefined;
  const googleSearchAds = typeof googleObj?.['totalAdsVisible'] === 'number' ? googleObj['totalAdsVisible'] as number : 0;

  const activePlatforms = [facebookActive, googleSearchActive].filter(Boolean).length;

  // ── Viz content (left panel) ────────────────────────────────────────────
  const vizContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em', height: '100%' }}>
      {/* Summary stats in cards */}
      <div style={{ display: 'flex', gap: '0.6em', justifyContent: 'center', marginBottom: '0.3em' }}>
        {[
          { value: activePlatforms, label: `Platform${activePlatforms !== 1 ? 's' : ''} Active`, color: activePlatforms > 0 ? 'var(--gs-terminal)' : 'var(--gs-mid)' },
          { value: totalImages, label: 'Screenshots', color: 'var(--gs-light)' },
          { value: fbTotalAds + googleSearchAds, label: 'Total Ads Found', color: fbTotalAds + googleSearchAds > 0 ? 'var(--gs-base)' : 'var(--gs-mid)' },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, padding: '0.6em 0.8em', borderRadius: '4px', textAlign: 'center',
            background: 'rgba(255,178,239,0.04)',
            border: '1px solid rgba(255,178,239,0.08)',
          }}>
            <p className="font-data tabular-nums" style={{
              fontSize: 'clamp(1px, 1.65cqi, 26px)', fontWeight: 700, lineHeight: 1, color: s.color,
            }}>
              {s.value}
            </p>
            <p className="font-data uppercase" style={{
              fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-base)',
              letterSpacing: '0.08em', marginTop: '0.3em',
            }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Platform cards */}
      <div>
        <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.3em' }}>
          Platform Coverage
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
          <PlatformCard
            name="Facebook / Meta"
            active={facebookActive}
            adCount={fbTotalAds}
            icon={<MetaIcon />}
          />
          <PlatformCard
            name="Google Search"
            active={googleSearchActive}
            adCount={googleSearchAds}
            icon={<GoogleIcon />}
          />
        </div>
      </div>

      {/* No advertising detected message */}
      {activePlatforms === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.6, textAlign: 'center' }}>
            No active advertising detected across monitored platforms
          </p>
        </div>
      )}
    </div>
  );

  return (
    <SlideShellAlt
      moduleName="Ad Library Intelligence"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Meta Ad Library, Google Ads Transparency"
      vizContent={vizContent}
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    />
  );
}
