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
 * M39 Slide — Sitemap & Indexing
 * ===============================
 * Layout C (StatBlock hero): stats row + sitemap details + freshness + URL categories.
 *
 * Visualization:
 *   - Hero stats: Total URLs, Sitemap Count, Is Index Sitemap
 *   - FreshnessBar for last modified date
 *   - Sitemap list with URL counts
 *   - URL categories breakdown
 *   - llms.txt check
 */

interface SitemapResult {
  url: string;
  valid: boolean;
  urlCount: number;
  isIndex: boolean;
}

interface UrlCategory {
  category: string;
  count: number;
  pct: number;
  examples: string[];
}

interface FreshnessData {
  lastModified: string | null;
  updatedLast30Days: number;
  updatedLast90Days: number;
  urlsWithLastmod: number;
}

export function M39Slide({ scan, onAskChloe }: { scan: ScanWithResults; onAskChloe?: () => void }) {
  const syn = getM41Summary(scan, 'M39');
  const mod = getModuleResult(scan, 'M39');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Sitemap & Indexing" scan={scan} sourceLabel="Source: Sitemap parsing, robots.txt, indexation analysis" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Sitemap and indexation assessment';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Raw data extraction ────────────────────────────────────────────────
  const totalUrls = typeof raw?.['totalUrls'] === 'number' ? raw['totalUrls'] as number : 0;
  const isSitemapIndex = raw?.['isSitemapIndex'] === true;
  const childSitemapCount = typeof raw?.['childSitemapCount'] === 'number' ? raw['childSitemapCount'] as number : 0;
  const hasRobotsTxt = raw?.['hasRobotsTxt'] === true;
  const sitemapDirectives = typeof raw?.['sitemapDirectives'] === 'number' ? raw['sitemapDirectives'] as number : 0;
  const sitemaps = (raw?.['sitemaps'] as SitemapResult[] | undefined) ?? [];
  const urlCategories = (raw?.['urlCategories'] as UrlCategory[] | undefined) ?? [];
  const freshness = raw?.['freshness'] as FreshnessData | undefined;
  const locales = (raw?.['locales'] as string[] | undefined) ?? [];

  const llmsTxtObj = raw?.['llmsTxt'] as Record<string, unknown> | undefined;
  const hasLlmsTxt = llmsTxtObj?.['exists'] === true;

  // Compute days since last modified
  let daysAgo = -1;
  if (freshness?.lastModified) {
    const lastMod = new Date(freshness.lastModified);
    if (!isNaN(lastMod.getTime())) {
      daysAgo = Math.floor((Date.now() - lastMod.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  const validSitemapCount = sitemaps.filter(s => s.valid).length;

  return (
    <SlideShell
      moduleName="Sitemap & Indexing"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Sitemap parsing, robots.txt, indexation analysis"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      onAskChloe={onAskChloe}
    >
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        {/* Hero stats in cards */}
        <div style={{ display: 'flex', gap: '0.6em', marginBottom: '0.5em' }}>
          {[
            { value: totalUrls > 0 ? totalUrls.toLocaleString() : '—', label: 'URLs in Sitemap', color: totalUrls > 0 ? 'var(--gs-light)' : 'var(--gs-mid)', show: true },
            { value: isSitemapIndex ? childSitemapCount : validSitemapCount, label: isSitemapIndex ? 'Child Sitemaps' : 'Sitemaps Found', color: 'var(--gs-light)', show: true },
            { value: 'INDEX', label: 'Sitemap Index', color: 'var(--gs-base)', show: isSitemapIndex },
            { value: sitemapDirectives, label: 'robots.txt Directives', color: 'var(--gs-light)', show: sitemapDirectives > 0 },
          ].filter(s => s.show).map((s, i) => (
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

        {/* Freshness bar + checks */}
        <div style={{ display: 'flex', gap: '3%' }}>
          {/* Left: freshness + checks */}
          <div style={{ flex: 1 }}>
            {daysAgo >= 0 && (
              <div style={{ marginBottom: '0.4em' }}>
                <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.2em' }}>
                  Content Freshness
                </p>
                <FreshnessBar daysAgo={daysAgo} />
                {freshness && (
                  <div style={{ display: 'flex', gap: '1.5em', marginTop: '0.2em' }}>
                    <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-light)' }}>
                      {freshness.updatedLast30Days} updated &lt;30d
                    </span>
                    <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)' }}>
                      {freshness.updatedLast90Days} updated &lt;90d
                    </span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15em' }}>
              <CheckItem status={hasRobotsTxt ? 'pass' : 'warn'} label="robots.txt" detail={hasRobotsTxt ? `${sitemapDirectives} sitemap directive(s)` : 'Not found'} />
              <CheckItem status={hasLlmsTxt ? 'pass' : 'warn'} label="llms.txt (AI discoverability)" detail={hasLlmsTxt ? 'Present' : 'Not found'} />
            </div>
          </div>

          {/* Right: sitemap list + URL categories */}
          <div style={{ flex: 1 }}>
            {/* Sitemap list */}
            {sitemaps.length > 0 && (
              <div style={{ marginBottom: '0.3em' }}>
                <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.2em' }}>
                  Sitemaps
                </p>
                {sitemaps.map((sm, i) => {
                  let shortUrl = sm.url;
                  try { shortUrl = new URL(sm.url).pathname; } catch { /* keep full */ }
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4em', marginBottom: '0.1em' }}>
                      <span style={{
                        fontSize: 'clamp(1px, 0.98cqi, 15px)', fontWeight: 700,
                        color: sm.valid ? 'var(--gs-terminal)' : 'var(--gs-critical)',
                      }}>
                        {sm.valid ? '\u2713' : '\u2717'}
                      </span>
                      <span className="font-data" style={{
                        fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-light)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      }}>
                        {shortUrl}
                      </span>
                      {sm.valid && (
                        <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', flexShrink: 0 }}>
                          {sm.isIndex ? 'Index' : `${sm.urlCount} URLs`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* URL categories */}
            {urlCategories.length > 0 && (
              <div>
                <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-base)', letterSpacing: '0.1em', marginBottom: '0.2em' }}>
                  Content Types
                </p>
                <div style={{ display: 'flex', gap: '0.3em', flexWrap: 'wrap' }}>
                  {urlCategories.slice(0, 6).map((cat) => (
                    <Pill key={cat.category} text={`${cat.category} (${cat.count})`} color="var(--gs-light)" />
                  ))}
                </div>
              </div>
            )}

            {/* Locales */}
            {locales.length > 0 && (
              <div style={{ marginTop: '0.2em' }}>
                <span className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)' }}>
                  Locales: {locales.slice(0, 8).join(', ')}{locales.length > 8 ? ` +${locales.length - 8} more` : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}
