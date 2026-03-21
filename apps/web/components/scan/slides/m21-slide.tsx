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

// ── Showcase brand configs ────────────────────────────────────────────
interface ShowcaseBrand {
  pageName: string;
  avatarBg: string;
  avatarLetter: string;
  postText: string;
  imageSrc: string;
  imageAlt: string;
  linkDomain: string;
  linkHeadline: string;
  linkDescription: string;
  ctaLabel: string;
}

const SHOWCASE_BRANDS: Record<string, ShowcaseBrand> = {
  santander: {
    pageName: 'Santander US',
    avatarBg: '#EC0000',
    avatarLetter: 'S',
    postText: 'Your savings should work harder than you do. With 4.20% APY and zero fees, your money grows while you rest. Open a High Yield Savings account today.',
    imageSrc: 'https://hrqdatbrlcoxthqybtnp.supabase.co/storage/v1/object/public/ad-screenshots/showcase/santander-ad-creative.png',
    imageAlt: 'Santander savings ad — person relaxing in hammock under money tree',
    linkDomain: 'santanderbank.com',
    linkHeadline: 'Your Money Never Sleeps.',
    linkDescription: 'High Yield Savings · No Fees · Member FDIC',
    ctaLabel: 'Open Account',
  },
  ryder: {
    pageName: 'Ryder System, Inc.',
    avatarBg: '#000000',
    avatarLetter: 'R',
    postText: '"We believe in partnerships and in finding solutions that benefit both parties. Ryder is one of those partners." — Dale Finnestad, VP Customer Service & Logistics, Hill\'s Pet Nutrition. From raw ingredients to pet bowl, Ryder keeps the supply chain running on time.',
    imageSrc: 'https://hrqdatbrlcoxthqybtnp.supabase.co/storage/v1/object/public/ad-screenshots/showcase/ryder-ad-creative.png',
    imageAlt: 'Ryder ad — border collie at loading dock, Sit. Stay. Deliver.',
    linkDomain: 'ryder.com',
    linkHeadline: 'Sit. Stay. Deliver.',
    linkDescription: 'Supply Chain Solutions · Ever better.',
    ctaLabel: 'Learn More',
  },
  senzary: {
    pageName: 'Senzary',
    avatarBg: '#0D2137',
    avatarLetter: 'S',
    postText: 'Every machine on your floor is sending signals. Temperature spikes. Vibration changes. Air quality shifts. Most companies don\'t hear them until something breaks. Senzary makes the invisible visible — wireless sensors, zero cabling, live dashboards in days.',
    imageSrc: 'https://hrqdatbrlcoxthqybtnp.supabase.co/storage/v1/object/public/ad-screenshots/showcase/senzary-agriculture.png',
    imageAlt: 'Senzary ad — smart agriculture IoT sensors in crop field with drone and tablet dashboard',
    linkDomain: 'senzary.com',
    linkHeadline: 'Your Factory Is Talking.',
    linkDescription: 'Wireless IoT · Predictive Maintenance · Enterprise from $25K',
    ctaLabel: 'Learn More',
  },
};

// ── Facebook Ad Preview (showcase) ────────────────────────────────────
function FacebookAdPreview({ brand }: { brand: ShowcaseBrand }) {
  return (
    <div style={{
      borderRadius: '8px',
      overflow: 'hidden',
      background: '#ffffff',
      border: '1px solid #dddfe2',
      fontFamily: 'Helvetica, Arial, sans-serif',
      maxWidth: '100%',
    }}>
      {/* Header — Page + Sponsored */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
        {/* Page avatar */}
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
          background: brand.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700, lineHeight: 1 }}>{brand.avatarLetter}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#050505', lineHeight: 1.2, margin: 0 }}>
            {brand.pageName}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#65676b', lineHeight: 1.2 }}>Sponsored</span>
            <span style={{ fontSize: '11px', color: '#65676b' }}>·</span>
            {/* Globe icon */}
            <svg width="10" height="10" viewBox="0 0 16 16" fill="#65676b">
              <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 1.5a6.5 6.5 0 015.25 2.67h-1.9A9.5 9.5 0 009.5 1.6 6.5 6.5 0 018 1.5zm-1.5.1A9.5 9.5 0 004.65 4.17H2.75A6.5 6.5 0 016.5 1.6zM1.5 8c0-.87.17-1.7.48-2.46h2.4A16 16 0 004 8c0 .85.05 1.67.14 2.46H1.98A6.5 6.5 0 011.5 8zm1.25 3.83h1.9A9.5 9.5 0 006.5 14.4 6.5 6.5 0 012.75 11.83zM8 14.5a6.5 6.5 0 01-1.5-.1 9.5 9.5 0 001.85-2.57h-1.9a8 8 0 01-.9-2.37H5.5c-.1-.78-.15-1.6-.15-2.46s.05-1.68.15-2.46h5c.1.78.15 1.6.15 2.46s-.05 1.68-.15 2.46h-1.95a8 8 0 01-.9 2.37h-1.9A9.5 9.5 0 009.5 14.4 6.5 6.5 0 018 14.5zm5.25-2.67h-1.9a9.5 9.5 0 001.85-2.57h2.4A6.5 6.5 0 0113.25 11.83zM14.02 8H11.86c.09-.79.14-1.61.14-2.46s-.05-1.67-.14-2.46h2.16c.31.76.48 1.59.48 2.46s-.17 1.7-.48 2.46z" />
            </svg>
          </div>
        </div>
        {/* Three dots */}
        <div style={{ color: '#65676b', fontSize: '16px', cursor: 'default', lineHeight: 1 }}>•••</div>
      </div>

      {/* Post text */}
      <div style={{ padding: '0 12px 10px' }}>
        <p style={{ fontSize: '13px', color: '#050505', lineHeight: 1.4, margin: 0 }}>
          {brand.postText}
        </p>
      </div>

      {/* Ad image — square 1:1, padding-bottom trick for bulletproof aspect ratio */}
      <div style={{
        width: '100%', position: 'relative', background: '#f7f7f2',
        paddingBottom: '100%', overflow: 'hidden',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brand.imageSrc}
          alt={brand.imageAlt}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
          }}
        />
      </div>

      {/* Link preview bar */}
      <div style={{
        padding: '10px 12px',
        background: '#f0f2f5',
        borderBottom: '1px solid #dddfe2',
      }}>
        <p style={{ fontSize: '11px', color: '#65676b', lineHeight: 1.2, margin: 0, textTransform: 'uppercase' }}>
          {brand.linkDomain}
        </p>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#050505', lineHeight: 1.3, margin: '2px 0 0' }}>
          {brand.linkHeadline}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
          <p style={{ fontSize: '12px', color: '#65676b', lineHeight: 1.2, margin: 0 }}>
            {brand.linkDescription}
          </p>
          {/* CTA button */}
          <span style={{
            fontSize: '12px', fontWeight: 600, color: '#050505',
            background: '#e4e6eb', padding: '4px 14px', borderRadius: '4px',
            whiteSpace: 'nowrap',
          }}>
            {brand.ctaLabel}
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-around', padding: '6px 12px',
        borderTop: '1px solid #dddfe2',
      }}>
        {['👍 Like', '💬 Comment', '↗ Share'].map((action) => (
          <span key={action} style={{
            fontSize: '12px', fontWeight: 600, color: '#65676b',
            padding: '4px 8px', borderRadius: '4px',
          }}>
            {action}
          </span>
        ))}
      </div>
    </div>
  );
}

export function M21Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M21');
  const mod = getModuleResult(scan, 'M21');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  const hasData = raw && (raw['facebook'] || raw['google']);
  if (!syn && !hasData && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
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

  // Showcase mode: show proposed ad creative for specific presentation domains
  const domain = (scan.url ?? '').toLowerCase();
  const showcaseBrand = domain.includes('santander') ? SHOWCASE_BRANDS['santander']!
    : domain.includes('ryder') ? SHOWCASE_BRANDS['ryder']!
    : domain.includes('senzary') ? SHOWCASE_BRANDS['senzary']!
    : null;
  const showShowcase = showcaseBrand !== null;

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
      {activePlatforms === 0 && !showShowcase && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.6, textAlign: 'center' }}>
            No active advertising detected across monitored platforms
          </p>
        </div>
      )}

      {/* Showcase: Proposed Facebook Ad Creative */}
      {showShowcase && (
        <div style={{ marginTop: '0.2em' }}>
          <p className="font-data uppercase" style={{
            fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-base)',
            letterSpacing: '0.1em', marginBottom: '0.3em',
          }}>
            Proposed Creative
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '60%', maxWidth: '280px', minWidth: '180px', borderRadius: '6px', overflow: 'hidden' }}>
              <FacebookAdPreview brand={showcaseBrand!} />
            </div>
          </div>
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
