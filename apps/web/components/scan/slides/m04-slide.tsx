'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShellAlt,
  getM41Summary,
  getModuleResult,
  CheckItem,
  Pill,
  SkippedSlide,
} from './module-slide-template';

/**
 * M04 Slide — Page Metadata & SEO Scorecard
 * ==========================================
 * Layout B (SlideShellAlt): left panel = SEO scorecard viz, right = findings/recs
 *
 * Visualization:
 *   - Title tag preview with length bar
 *   - Meta description preview with length bar
 *   - Canonical, Robots.txt, Sitemap as CheckItems
 *   - OG & Twitter tag dot indicators
 *   - JSON-LD type pills
 *   - Hreflang count
 */

// ── Length bar — colored horizontal indicator ──────────────────────────────
function LengthBar({ value, ranges, label }: {
  value: number;
  ranges: { good: [number, number]; warn: [number, number] };
  label: string;
}) {
  const maxDisplay = Math.max(value, ranges.warn[1] + 20);
  const pct = Math.min(100, (value / maxDisplay) * 100);
  const inGood = value >= ranges.good[0] && value <= ranges.good[1];
  const inWarn = !inGood && value >= ranges.warn[0] && value <= ranges.warn[1];
  const color = inGood ? 'var(--gs-terminal)' : inWarn ? 'var(--gs-warning)' : 'var(--gs-critical)';

  return (
    <div style={{ marginBottom: '0.15em' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.15em' }}>
        <span className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-mid)' }}>{label}</span>
        <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color, fontWeight: 600 }}>{value} chars</span>
      </div>
      <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

// ── Tag dots — small colored circles for tag presence ──────────────────────
function TagDots({ tags, label }: { tags: Array<{ key: string; present: boolean }>; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4em', marginBottom: '0.2em' }}>
      <span className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-light)', minWidth: '6em' }}>{label}</span>
      <div style={{ display: 'flex', gap: '0.3em', alignItems: 'center', flexWrap: 'wrap' }}>
        {tags.map((t) => (
          <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.15em' }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: t.present ? 'var(--gs-terminal)' : 'rgba(255,255,255,0.1)',
              boxShadow: t.present ? '0 0 4px var(--gs-terminal)' : 'none',
            }} />
            <span className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: t.present ? 'var(--gs-light)' : 'var(--gs-mid)', opacity: t.present ? 0.8 : 0.4 }}>
              {t.key}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function M04Slide({ scan, chloeCallout }: { scan: ScanWithResults; chloeCallout?: React.ReactNode }) {
  const syn = getM41Summary(scan, 'M04');
  const mod = getModuleResult(scan, 'M04');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Page Metadata & SEO" scan={scan} sourceLabel="Source: HTML head inspection, structured data, meta tags" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Page metadata and SEO tag analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ─────────────────────────────────────────────────────
  const titleObj = raw?.['title'] as Record<string, unknown> | string | undefined;
  const titleContent = typeof titleObj === 'string' ? titleObj : (titleObj?.['content'] as string | undefined) ?? null;
  const titleLength = typeof titleObj === 'string'
    ? titleObj.length
    : typeof (raw?.['titleLength'] ?? titleObj?.['length']) === 'number'
      ? (raw?.['titleLength'] ?? titleObj?.['length']) as number
      : titleContent?.length ?? 0;

  const descObj = raw?.['metaDescription'] as Record<string, unknown> | string | undefined;
  const descContent = typeof descObj === 'string' ? descObj : (descObj?.['content'] as string | undefined) ?? null;
  const descLength = typeof descObj === 'string'
    ? descObj.length
    : typeof (raw?.['metaDescriptionLength'] ?? descObj?.['length']) === 'number'
      ? (raw?.['metaDescriptionLength'] ?? descObj?.['length']) as number
      : descContent?.length ?? 0;

  const canonical = raw?.['canonical'] as string | boolean | undefined;
  const hasCanonical = typeof canonical === 'string' ? !!canonical : !!canonical;

  const ogTags = (raw?.['ogTags'] as Record<string, string> | undefined) ?? {};
  const twitterCards = (raw?.['twitterCards'] as Record<string, string> | undefined) ?? {};

  const jsonLdObj = raw?.['jsonLd'] as Record<string, unknown> | undefined;
  const jsonLdTypes = (jsonLdObj?.['types'] as string[] | undefined) ?? [];
  const jsonLdRaw = jsonLdObj?.['raw'] as unknown[] | undefined;
  const hasJsonLd = jsonLdTypes.length > 0 || (jsonLdRaw != null && Array.isArray(jsonLdRaw) && jsonLdRaw.length > 0);

  const robotsTxtObj = raw?.['robotsTxt'] as Record<string, unknown> | boolean | string | undefined;
  const hasRobotsTxt = typeof robotsTxtObj === 'boolean'
    ? robotsTxtObj
    : typeof robotsTxtObj === 'object' && robotsTxtObj != null
      ? !!(robotsTxtObj as Record<string, unknown>)['present']
      : !!robotsTxtObj;

  const sitemapObj = raw?.['sitemap'] as Record<string, unknown> | boolean | undefined;
  const hasSitemap = typeof sitemapObj === 'boolean'
    ? sitemapObj
    : typeof sitemapObj === 'object' && sitemapObj != null
      ? !!(sitemapObj as Record<string, unknown>)['present']
      : !!sitemapObj;

  const hreflangArr = (raw?.['hreflang'] as unknown[] | undefined) ?? [];

  // ── OG property checks ──────────────────────────────────────────────────
  const ogChecks = [
    { key: 'title', present: !!ogTags['og:title'] },
    { key: 'desc', present: !!ogTags['og:description'] },
    { key: 'image', present: !!ogTags['og:image'] },
    { key: 'url', present: !!ogTags['og:url'] },
    { key: 'type', present: !!ogTags['og:type'] },
  ];

  const twitterChecks = [
    { key: 'card', present: !!twitterCards['twitter:card'] },
    { key: 'title', present: !!twitterCards['twitter:title'] },
    { key: 'image', present: !!twitterCards['twitter:image'] },
    { key: 'site', present: !!twitterCards['twitter:site'] },
  ];

  // ── Viz content (left panel) ────────────────────────────────────────────
  const vizContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
      <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.1em' }}>
        SEO Scorecard
      </h4>

      {/* Title tag */}
      {titleContent && (
        <div>
          <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-light)', opacity: 0.7, marginBottom: '0.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            &ldquo;{titleContent}&rdquo;
          </p>
          <LengthBar value={titleLength} ranges={{ good: [1, 60], warn: [1, 70] }} label="Title" />
        </div>
      )}
      {!titleContent && <CheckItem status="fail" label="Title tag" detail="Missing" />}

      {/* Meta description */}
      {descContent && (
        <div>
          <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-light)', opacity: 0.7, marginBottom: '0.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            &ldquo;{descContent}&rdquo;
          </p>
          <LengthBar value={descLength} ranges={{ good: [120, 160], warn: [80, 200] }} label="Description" />
        </div>
      )}
      {!descContent && <CheckItem status="fail" label="Meta description" detail="Missing" />}

      {/* Canonical, Robots, Sitemap */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15em', marginTop: '0.15em' }}>
        <CheckItem status={hasCanonical ? 'pass' : 'fail'} label="Canonical URL" detail={typeof canonical === 'string' && canonical ? canonical : undefined} />
        <CheckItem status={hasRobotsTxt ? 'pass' : 'warn'} label="robots.txt" />
        <CheckItem status={hasSitemap ? 'pass' : 'warn'} label="Sitemap" />
      </div>

      {/* OG & Twitter tag dots */}
      <div style={{ marginTop: '0.15em' }}>
        <TagDots tags={ogChecks} label="OG Tags" />
        <TagDots tags={twitterChecks} label="Twitter" />
      </div>

      {/* JSON-LD types */}
      {hasJsonLd && (
        <div style={{ display: 'flex', gap: '0.3em', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.1em' }}>
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-mid)' }}>JSON-LD:</span>
          {jsonLdTypes.length > 0
            ? jsonLdTypes.map((t) => <Pill key={t} text={t} color="var(--gs-terminal)" />)
            : <Pill text="Present" color="var(--gs-terminal)" />
          }
        </div>
      )}
      {!hasJsonLd && (
        <CheckItem status="warn" label="JSON-LD structured data" detail="Not found" />
      )}

      {/* Hreflang */}
      {hreflangArr.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3em', marginTop: '0.1em' }}>
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-mid)' }}>Hreflang:</span>
          <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.86cqi, 14px)', color: 'var(--gs-light)', fontWeight: 600 }}>
            {hreflangArr.length} locale{hreflangArr.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <SlideShellAlt
      moduleName="Page Metadata & SEO"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: HTML head inspection, structured data, meta tags"
      vizContent={vizContent}
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      chloeCallout={chloeCallout}
    />
  );
}
