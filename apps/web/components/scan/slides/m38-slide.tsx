'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  StatBlock,
  StarRating,
  CheckItem,
  Pill,
  SkippedSlide,
} from './module-slide-template';

/**
 * M38 Slide — Local Pack
 * ═════════════════════
 *
 * Layout D: SlideShell with CheckItem grid visualization.
 * Viz: GBP hero stats (business name, rating, review count).
 * Categories as pills. Completeness checklist as CheckItems grid.
 */

interface CompletenessItem {
  item: string;
  status: string;
  detail?: string;
}

export function M38Slide({ scan, onAskChloe }: { scan: ScanWithResults; onAskChloe?: () => void }) {
  const syn = getM41Summary(scan, 'M38');
  const mod = getModuleResult(scan, 'M38');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Local Pack" scan={scan} sourceLabel="Source: Local SERP analysis, Google Business Profile detection" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Local search presence analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const businessProfile = (raw?.['businessProfile'] as Record<string, unknown> | undefined) ?? {};
  const businessName = typeof businessProfile?.['name'] === 'string' ? businessProfile['name'] as string : null;
  const profileRating = typeof businessProfile?.['rating'] === 'number' ? businessProfile['rating'] as number : null;
  const profileReviewCount = typeof businessProfile?.['reviewCount'] === 'number' ? businessProfile['reviewCount'] as number : null;
  const profileCategories = (businessProfile?.['categories'] as string[] | undefined) ?? [];
  const profileAddress = typeof businessProfile?.['address'] === 'string' ? businessProfile['address'] as string : null;
  const profilePhone = typeof businessProfile?.['phone'] === 'string' ? businessProfile['phone'] as string : null;
  const profileWebsite = typeof businessProfile?.['website'] === 'string' ? businessProfile['website'] as string : null;

  const completenessChecklist = (raw?.['completenessChecklist'] as CompletenessItem[] | undefined) ?? [];
  const localPackRank = typeof raw?.['localPackRank'] === 'number' ? raw['localPackRank'] as number : null;
  const topCategories = (raw?.['categories'] as string[] | undefined) ?? profileCategories;

  // Map completeness status to CheckItem status
  function mapStatus(s: string | undefined | null): 'pass' | 'fail' | 'warn' {
    if (!s) return 'warn';
    const lower = s.toLowerCase();
    if (lower === 'complete' || lower === 'pass' || lower === 'yes' || lower === 'true' || lower === 'found') return 'pass';
    if (lower === 'missing' || lower === 'fail' || lower === 'no' || lower === 'false' || lower === 'not found') return 'fail';
    return 'warn';
  }

  return (
    <SlideShell
      moduleName="Local Pack"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Local SERP analysis, Google Business Profile detection"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      onAskChloe={onAskChloe}
    >
      {/* ═══ GBP Profile & Completeness ═══ */}
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        <div style={{ display: 'flex', gap: '3%' }}>
          {/* Left: Business profile hero */}
          <div style={{ flex: '1 1 45%', display: 'flex', flexDirection: 'column', gap: '0.4em' }}>
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.15em' }}>
              Google Business Profile
            </h4>

            {/* Business name */}
            {businessName && (
              <p className="font-data" style={{ fontSize: 'clamp(1px, 1.20cqi, 18px)', fontWeight: 700, color: 'var(--gs-light)', lineHeight: 1.2 }}>
                {businessName}
              </p>
            )}

            {/* Rating + review count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6em' }}>
              {profileRating != null && (
                <>
                  <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.88cqi, 30px)', fontWeight: 700, color: 'var(--gs-light)', lineHeight: 1 }}>
                    {profileRating.toFixed(1)}
                  </span>
                  <StarRating rating={profileRating} />
                </>
              )}
              {profileReviewCount != null && (
                <span className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)' }}>
                  ({profileReviewCount.toLocaleString()} reviews)
                </span>
              )}
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: '1.5em', marginTop: '0.2em' }}>
              {localPackRank != null && (
                <StatBlock
                  value={`#${localPackRank}`}
                  label="Local Pack Rank"
                  color={localPackRank <= 3 ? 'var(--gs-terminal)' : 'var(--gs-warning)'}
                />
              )}
            </div>

            {/* Contact info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15em', marginTop: '0.2em' }}>
              {profileAddress && (
                <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-mid)' }}>
                  {profileAddress}
                </p>
              )}
              {profilePhone && (
                <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-mid)' }}>
                  {profilePhone}
                </p>
              )}
              {profileWebsite && (
                <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-base)', opacity: 0.7 }}>
                  {profileWebsite}
                </p>
              )}
            </div>

            {/* Categories */}
            {topCategories.length > 0 && (
              <div style={{ marginTop: '0.2em' }}>
                <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', letterSpacing: '0.06em', marginBottom: '0.2em' }}>
                  Categories
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em' }}>
                  {topCategories.map((cat, i) => (
                    <Pill key={i} text={cat} color="var(--gs-base)" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'rgba(255,178,239,0.08)', flexShrink: 0 }} />

          {/* Right: Completeness checklist */}
          <div style={{ flex: '1 1 48%' }}>
            {completenessChecklist.length > 0 && (
              <>
                <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.35em' }}>
                  Profile Completeness
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35em 1em' }}>
                  {completenessChecklist.map((item, i) => (
                    <CheckItem
                      key={i}
                      status={mapStatus(item.status)}
                      label={item.item}
                      detail={item.detail ?? item.status}
                    />
                  ))}
                </div>
              </>
            )}

            {completenessChecklist.length === 0 && (
              <>
                <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.35em' }}>
                  Profile Status
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35em 1em' }}>
                  <CheckItem status={businessName ? 'pass' : 'fail'} label="Business Name" detail={businessName ?? 'Not found'} />
                  <CheckItem status={profileRating != null ? 'pass' : 'warn'} label="Rating" detail={profileRating != null ? `${profileRating.toFixed(1)} stars` : 'Not available'} />
                  <CheckItem status={profileAddress ? 'pass' : 'warn'} label="Address" detail={profileAddress ? 'Listed' : 'Not found'} />
                  <CheckItem status={profilePhone ? 'pass' : 'warn'} label="Phone" detail={profilePhone ? 'Listed' : 'Not found'} />
                  <CheckItem status={profileWebsite ? 'pass' : 'warn'} label="Website" detail={profileWebsite ? 'Linked' : 'Not found'} />
                  <CheckItem status={topCategories.length > 0 ? 'pass' : 'warn'} label="Categories" detail={topCategories.length > 0 ? `${topCategories.length} set` : 'None'} />
                  <CheckItem status={profileReviewCount != null && profileReviewCount > 0 ? 'pass' : 'warn'} label="Reviews" detail={profileReviewCount != null ? `${profileReviewCount.toLocaleString()}` : 'None'} />
                  <CheckItem status={localPackRank != null ? 'pass' : 'warn'} label="Local Pack" detail={localPackRank != null ? `Rank #${localPackRank}` : 'Not ranked'} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}
