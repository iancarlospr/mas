'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  StatBlock,
  FreshnessBar,
  CheckItem,
  Pill,
  SkippedSlide,
} from './module-slide-template';

/**
 * M16 Slide — PR & Media
 * ══════════════════════
 *
 * Layout C: SlideShell with StatBlock hero visualization.
 * Viz: Article Count and Most Recent Date stats, FreshnessBar for recency,
 * Wire Services as pills, Press Page/Media Kit/RSS as CheckItems.
 */

export function M16Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M16');
  const mod = getModuleResult(scan, 'M16');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="PR & Media" scan={scan} sourceLabel="Source: Newsroom detection, press release analysis, wire services" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Press and media presence analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data (check both camelCase and snake_case) ──
  const articleCount = typeof raw?.['article_count'] === 'number'
    ? raw['article_count'] as number
    : typeof raw?.['articleCount'] === 'number'
      ? raw['articleCount'] as number
      : null;

  const mostRecentDateRaw = (raw?.['most_recent_date'] as string | undefined)
    ?? (raw?.['mostRecentDate'] as string | undefined)
    ?? null;

  const wireServices = (raw?.['wire_services'] as string[] | undefined)
    ?? (raw?.['wireServices'] as string[] | undefined)
    ?? [];

  const pressPageUrl = (raw?.['press_page_url'] as string | undefined)
    ?? (raw?.['pressPageUrl'] as string | undefined)
    ?? null;

  const mediaKitUrl = (raw?.['media_kit_url'] as string | undefined)
    ?? (raw?.['mediaKitUrl'] as string | undefined)
    ?? null;

  const rssFeedRaw = raw?.['rss_feed'] ?? raw?.['rssFeed'] ?? null;
  const hasRss = rssFeedRaw === true || (typeof rssFeedRaw === 'string' && rssFeedRaw.length > 0);

  // Calculate freshness (days ago)
  let daysAgo: number | null = null;
  let formattedDate = 'Unknown';
  if (mostRecentDateRaw) {
    const parsed = new Date(mostRecentDateRaw);
    if (!isNaN(parsed.getTime())) {
      daysAgo = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)));
      formattedDate = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  return (
    <SlideShell
      moduleName="PR & Media"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Newsroom detection, press release analysis, wire services"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    >
      {/* ═══ PR Stats & Checklist ═══ */}
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        {/* Two columns: stats + checklist */}
        <div style={{ display: 'flex', gap: '3%' }}>
          {/* Left: Stats + wire services */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8em', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            {/* Hero article count */}
            {articleCount != null && (
              <div style={{
                padding: '1.2em 1.5em', borderRadius: '4px', width: '100%',
                background: 'rgba(255,178,239,0.04)',
                border: '1px solid rgba(255,178,239,0.08)',
                textAlign: 'center',
              }}>
                <p className="font-data tabular-nums" style={{
                  fontSize: 'clamp(1px, 3.75cqi, 60px)', fontWeight: 700, lineHeight: 1,
                  color: articleCount > 10 ? 'var(--gs-terminal)' : articleCount > 0 ? 'var(--gs-warning)' : 'var(--gs-critical)',
                }}>
                  {articleCount}
                </p>
                <p className="font-data uppercase" style={{
                  fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)',
                  letterSpacing: '0.1em', marginTop: '0.4em',
                }}>
                  Articles Found
                </p>
              </div>
            )}

            {/* Secondary stats row */}
            <div style={{ display: 'flex', gap: '1.5em', justifyContent: 'center' }}>
              {mostRecentDateRaw && articleCount != null && articleCount > 0 && (
                <StatBlock value={formattedDate} label="Most Recent" color="var(--gs-light)" />
              )}
              {daysAgo != null && articleCount != null && articleCount > 0 && (
                <StatBlock
                  value={daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}
                  label="Last Update"
                  color={daysAgo <= 30 ? 'var(--gs-terminal)' : daysAgo <= 90 ? 'var(--gs-warning)' : 'var(--gs-critical)'}
                />
              )}
              {wireServices.length > 0 && (
                <StatBlock value={wireServices.length} label="Wire Services" color="var(--gs-base)" />
              )}
            </div>

            {/* Freshness bar */}
            {daysAgo != null && articleCount != null && articleCount > 0 && (
              <div style={{ width: '100%' }}>
                <FreshnessBar daysAgo={daysAgo} maxDays={365} />
              </div>
            )}

            {/* Wire service pills */}
            {wireServices.length > 0 && (
              <div style={{ width: '100%' }}>
                <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', letterSpacing: '0.06em', marginBottom: '0.2em' }}>
                  Wire Services
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25em', justifyContent: 'center' }}>
                  {wireServices.map((ws, i) => (
                    <Pill key={i} text={ws} color="var(--gs-base)" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'rgba(255,178,239,0.06)', flexShrink: 0 }} />

          {/* Right: Checklist */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
            <p className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.1em' }}>
              Media Assets
            </p>
            <CheckItem
              status={pressPageUrl ? 'pass' : 'fail'}
              label="Press / Newsroom Page"
              detail={pressPageUrl ? 'Found' : 'Not detected'}
            />
            <CheckItem
              status={mediaKitUrl ? 'pass' : 'fail'}
              label="Media Kit"
              detail={mediaKitUrl ? 'Available' : 'Not found'}
            />
            <CheckItem
              status={hasRss ? 'pass' : 'warn'}
              label="RSS Feed"
              detail={hasRss ? 'Active' : 'Not found'}
            />
            <CheckItem
              status={articleCount != null && articleCount > 0 ? 'pass' : 'fail'}
              label="Active PR Coverage"
              detail={articleCount != null && articleCount > 0 ? `${articleCount} article${articleCount !== 1 ? 's' : ''}` : 'No coverage detected'}
            />
          </div>
        </div>
      </div>
    </SlideShell>
  );
}
