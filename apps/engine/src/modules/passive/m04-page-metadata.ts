import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext, ModuleExecuteFn } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { fetchWithRetry } from '../../utils/http.js';
import * as cheerio from 'cheerio';
import { extractStructuredData } from '../../utils/schema-org-parser.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TitleData {
  content: string | null;
  length: number;
}

interface MetaDescriptionData {
  content: string | null;
  length: number;
}

interface RobotsTxtData {
  present: boolean;
  blocked: boolean; // 403 = server blocks access (Googlebot treats as full block)
  content?: string;
  sitemapUrls: string[];
  disallowedPaths: string[];
  userAgentCount: number;
}

interface SitemapData {
  present: boolean;
  urlCount?: number;
  urls?: string[];
  source: 'standard' | 'index' | 'robots-txt' | null;
}

interface LlmsTxtData {
  present: boolean;
  content?: string;
}

interface ManifestData {
  present: boolean;
  data?: Record<string, unknown>;
}

interface FaviconData {
  present: boolean;
  formats: Array<{ rel: string; href: string; sizes?: string; type?: string }>;
}

interface JsonLdDeep {
  raw: unknown[];
  types: string[];
  organizationName: string | null;
  organizationLogo: string | null;
  socialProfiles: string[];
  contactPoints: Array<{ type: string; telephone?: string; email?: string }>;
  websiteName: string | null;
  hasSearchAction: boolean;
}

interface RobotsDirectives {
  metaRobots: string | null;
  xRobotsTag: string | null;
  noindex: boolean;
  nofollow: boolean;
}

interface ViewportData {
  content: string | null;
  hasWidth: boolean;
  hasInitialScale: boolean;
}

interface CharsetData {
  charset: string | null;
  source: 'meta' | 'header' | null;
}

interface AdsTxtData {
  present: boolean;
  blocked: boolean;
  lineCount?: number;
  body?: string;
}

interface AlternateLink {
  type: string; // 'rss', 'atom', 'amphtml'
  href: string;
  title?: string;
}

interface PaginationLinks {
  next: string | null;
  prev: string | null;
}

interface OpenSearchData {
  present: boolean;
  title?: string;
  href?: string;
}

interface HreflangEntry {
  lang: string;
  href: string;
}

interface M04Data {
  title: TitleData;
  metaDescription: MetaDescriptionData;
  canonical: string | null;
  ogTags: Record<string, string>;
  twitterCards: Record<string, string>;
  jsonLd: JsonLdDeep;
  robotsTxt: RobotsTxtData;
  sitemap: SitemapData;
  llmsTxt: LlmsTxtData;
  manifest: ManifestData;
  favicon: FaviconData;
  htmlLang: string | null;
  hreflang: HreflangEntry[];
  preconnectHints: string[];
  metaTags: Record<string, string>;
  robotsDirectives: RobotsDirectives;
  viewport: ViewportData;
  charset: CharsetData;
  adsTxt: AdsTxtData;
  alternateLinks: AlternateLink[];
  pagination: PaginationLinks;
  openSearch: OpenSearchData;
  isAMP: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CORE_OG_TAGS = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:site_name'];

const FETCH_OPTIONS = {
  retries: 1,
  timeout: 10_000,
};

// ---------------------------------------------------------------------------
// HTML extraction helpers
// ---------------------------------------------------------------------------

function extractTitle($: cheerio.CheerioAPI): TitleData {
  const text = $('title').first().text().trim() || null;
  return { content: text, length: text?.length ?? 0 };
}

function extractMetaDescription($: cheerio.CheerioAPI): MetaDescriptionData {
  const content = $('meta[name="description"]').attr('content')?.trim() ?? null;
  return { content, length: content?.length ?? 0 };
}

function extractCanonical($: cheerio.CheerioAPI): string | null {
  return $('link[rel="canonical"]').attr('href')?.trim() ?? null;
}

function extractOgTags($: cheerio.CheerioAPI): Record<string, string> {
  const og: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const property = $(el).attr('property');
    const content = $(el).attr('content');
    if (property && content) {
      og[property] = content;
    }
  });
  return og;
}

function extractTwitterCards($: cheerio.CheerioAPI): Record<string, string> {
  const twitter: Record<string, string> = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    if (name && content) {
      twitter[name] = content;
    }
  });
  return twitter;
}

function extractFavicons($: cheerio.CheerioAPI): FaviconData {
  const formats: FaviconData['formats'] = [];
  $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').each((_, el) => {
    const href = $(el).attr('href');
    const rel = $(el).attr('rel') ?? 'icon';
    if (href) {
      const sizes = $(el).attr('sizes');
      const type = $(el).attr('type');
      formats.push({ rel, href, ...(sizes ? { sizes } : {}), ...(type ? { type } : {}) });
    }
  });
  return { present: formats.length > 0, formats };
}

function extractHtmlLang($: cheerio.CheerioAPI): string | null {
  return $('html').attr('lang')?.trim() ?? null;
}

function extractHreflang($: cheerio.CheerioAPI): HreflangEntry[] {
  const entries: HreflangEntry[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr('hreflang');
    const href = $(el).attr('href');
    if (lang && href) {
      entries.push({ lang, href });
    }
  });
  return entries;
}

function extractPreconnectHints($: cheerio.CheerioAPI): string[] {
  const hints: string[] = [];
  $('link[rel="preconnect"], link[rel="dns-prefetch"], link[rel="prefetch"], link[rel="preload"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      hints.push(href);
    }
  });
  return hints;
}

function extractMetaTags($: cheerio.CheerioAPI): Record<string, string> {
  const tags: Record<string, string> = {};
  $('meta').each((_, el) => {
    const name = $(el).attr('name') ?? $(el).attr('property') ?? $(el).attr('http-equiv');
    const content = $(el).attr('content');
    if (name && content) {
      tags[name] = content;
    }
  });
  return tags;
}

function extractJsonLdDeep($: cheerio.CheerioAPI): JsonLdDeep {
  const raw: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (content) {
      try { raw.push(JSON.parse(content)); } catch { /* skip */ }
    }
  });

  const types = extractSchemaTypes(raw);
  let organizationName: string | null = null;
  let organizationLogo: string | null = null;
  const socialProfiles: string[] = [];
  const contactPoints: JsonLdDeep['contactPoints'] = [];
  let websiteName: string | null = null;
  let hasSearchAction = false;

  function walk(items: unknown[]) {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const t = typeof rec['@type'] === 'string' ? rec['@type'] : '';

      if (/organization/i.test(t)) {
        organizationName ??= (rec['name'] as string) ?? null;
        if (typeof rec['logo'] === 'string') organizationLogo ??= rec['logo'];
        else if (rec['logo'] && typeof (rec['logo'] as Record<string, unknown>)['url'] === 'string')
          organizationLogo ??= (rec['logo'] as Record<string, unknown>)['url'] as string;
        if (Array.isArray(rec['sameAs'])) {
          for (const s of rec['sameAs']) { if (typeof s === 'string') socialProfiles.push(s); }
        }
        if (Array.isArray(rec['contactPoint'])) {
          for (const cp of rec['contactPoint']) {
            if (cp && typeof cp === 'object') {
              const c = cp as Record<string, unknown>;
              contactPoints.push({
                type: (c['contactType'] as string) ?? 'unknown',
                ...(typeof c['telephone'] === 'string' ? { telephone: c['telephone'] } : {}),
                ...(typeof c['email'] === 'string' ? { email: c['email'] } : {}),
              });
            }
          }
        }
        if (typeof rec['email'] === 'string' && !contactPoints.some(c => c.email)) {
          contactPoints.push({ type: 'general', email: (rec['email'] as string).replace('mailto:', '') });
        }
      }

      if (/website/i.test(t)) {
        websiteName ??= (rec['name'] as string) ?? null;
        if (rec['potentialAction']) hasSearchAction = true;
      }

      if (Array.isArray(rec['@graph'])) walk(rec['@graph'] as unknown[]);
    }
  }
  walk(raw);

  return { raw, types, organizationName, organizationLogo, socialProfiles, contactPoints, websiteName, hasSearchAction };
}

function extractRobotsDirectives($: cheerio.CheerioAPI, headers: Record<string, string>): RobotsDirectives {
  const metaRobots = $('meta[name="robots"]').attr('content')?.trim() ?? null;
  const xRobotsTag = headers['x-robots-tag'] ?? null;
  const combined = [metaRobots, xRobotsTag].filter(Boolean).join(', ').toLowerCase();
  return {
    metaRobots,
    xRobotsTag,
    noindex: combined.includes('noindex'),
    nofollow: combined.includes('nofollow'),
  };
}

function extractViewport($: cheerio.CheerioAPI): ViewportData {
  const content = $('meta[name="viewport"]').attr('content')?.trim() ?? null;
  return {
    content,
    hasWidth: content ? /width\s*=/.test(content) : false,
    hasInitialScale: content ? /initial-scale\s*=/.test(content) : false,
  };
}

function extractCharset($: cheerio.CheerioAPI, headers: Record<string, string>): CharsetData {
  const metaCharset = $('meta[charset]').attr('charset')?.trim() ?? null;
  if (metaCharset) return { charset: metaCharset, source: 'meta' };

  const ct = headers['content-type'] ?? '';
  const match = ct.match(/charset=([^\s;]+)/i);
  if (match) return { charset: match[1]!, source: 'header' };

  return { charset: null, source: null };
}

function extractAlternateLinks($: cheerio.CheerioAPI): AlternateLink[] {
  const links: AlternateLink[] = [];
  $('link[rel="alternate"]').each((_, el) => {
    const href = $(el).attr('href');
    const type = $(el).attr('type') ?? '';
    const hreflang = $(el).attr('hreflang');
    if (!href || hreflang) return; // skip hreflang entries (handled separately)

    if (/rss\+xml/i.test(type)) {
      links.push({ type: 'rss', href, title: $(el).attr('title') });
    } else if (/atom\+xml/i.test(type)) {
      links.push({ type: 'atom', href, title: $(el).attr('title') });
    } else if (/amphtml/i.test($(el).attr('rel') ?? '')) {
      // link rel="amphtml" — treat separately
    }
  });
  // AMP link
  const ampHref = $('link[rel="amphtml"]').attr('href');
  if (ampHref) links.push({ type: 'amphtml', href: ampHref });
  return links;
}

function extractPagination($: cheerio.CheerioAPI): PaginationLinks {
  return {
    next: $('link[rel="next"]').attr('href')?.trim() ?? null,
    prev: $('link[rel="prev"]').attr('href')?.trim() ?? null,
  };
}

function extractOpenSearch($: cheerio.CheerioAPI): OpenSearchData {
  const el = $('link[rel="search"][type="application/opensearchdescription+xml"]');
  if (el.length === 0) return { present: false };
  return {
    present: true,
    title: el.attr('title'),
    href: el.attr('href') ?? undefined,
  };
}

function detectAMP($: cheerio.CheerioAPI): boolean {
  const htmlAttribs = $('html').attr() ?? {};
  // <html amp>, <html ⚡>, or <html amp4ads>
  if ('amp' in htmlAttribs || '\u26A1' in htmlAttribs || 'amp4ads' in htmlAttribs) {
    return true;
  }
  // <link rel="amphtml" href="...">
  if ($('link[rel="amphtml"]').length > 0) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Remote resource fetchers
// ---------------------------------------------------------------------------

function resolveRootUrl(pageUrl: string, path: string): string {
  const parsed = new URL(pageUrl);
  return `${parsed.origin}${path}`;
}

async function fetchRobotsTxt(pageUrl: string): Promise<RobotsTxtData> {
  const empty: RobotsTxtData = { present: false, blocked: false, sitemapUrls: [], disallowedPaths: [], userAgentCount: 0 };
  try {
    const url = resolveRootUrl(pageUrl, '/robots.txt');
    const res = await fetchWithRetry(url, FETCH_OPTIONS);
    if (!res.ok) {
      return empty;
    }
    const content = res.body;
    // Sanity check: robots.txt should be text, not HTML
    if (content.trimStart().startsWith('<!') || content.trimStart().startsWith('<html')) {
      return empty;
    }
    const sitemapUrls: string[] = [];
    const disallowedPaths: string[] = [];
    const userAgents = new Set<string>();
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (/^sitemap:/i.test(trimmed)) {
        const val = trimmed.replace(/^sitemap:\s*/i, '').trim();
        if (val) sitemapUrls.push(val);
      } else if (/^disallow:/i.test(trimmed)) {
        const val = trimmed.replace(/^disallow:\s*/i, '').trim();
        if (val) disallowedPaths.push(val);
      } else if (/^user-agent:/i.test(trimmed)) {
        const val = trimmed.replace(/^user-agent:\s*/i, '').trim();
        if (val) userAgents.add(val.toLowerCase());
      }
    }
    return { present: true, blocked: false, content, sitemapUrls, disallowedPaths, userAgentCount: userAgents.size };
  } catch (err) {
    // fetchWithRetry throws on HTTP errors — check for 403
    if (String(err).includes('403')) return { ...empty, blocked: true };
    return empty;
  }
}

const SITEMAP_PATHS = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml', '/sitemaps/sitemap.xml'];

async function fetchSitemap(pageUrl: string, robotsSitemapUrls: string[]): Promise<SitemapData> {
  // Helper to try a single sitemap URL
  const trySitemap = async (sitemapUrl: string, source: 'robots-txt' | 'standard'): Promise<SitemapData | null> => {
    try {
      const res = await fetchWithRetry(sitemapUrl, FETCH_OPTIONS);
      if (res.ok && res.body.includes('<')) {
        const isSitemapIndex = /<sitemapindex/i.test(res.body);
        const locMatches = res.body.match(/<loc>(.*?)<\/loc>/gi);
        const urls = locMatches
          ?.map(m => m.replace(/<\/?loc>/gi, '').trim())
          .filter(Boolean)
          .slice(0, 500) ?? [];
        return { present: true, urlCount: urls.length, urls, source: isSitemapIndex ? 'index' : source };
      }
    } catch { /* ignore */ }
    return null;
  };

  // Try robots.txt sitemap references first (parallel)
  if (robotsSitemapUrls.length > 0) {
    const robotsResults = await Promise.allSettled(
      robotsSitemapUrls.map(url => trySitemap(url, 'robots-txt'))
    );
    for (const r of robotsResults) {
      if (r.status === 'fulfilled' && r.value) return r.value;
    }
  }

  // Try common sitemap paths in parallel (not sequential — avoids bot-protection timeouts)
  const standardResults = await Promise.allSettled(
    SITEMAP_PATHS.map(path => trySitemap(resolveRootUrl(pageUrl, path), 'standard'))
  );
  for (const r of standardResults) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }

  return { present: false, source: null };
}

async function fetchLlmsTxt(pageUrl: string): Promise<LlmsTxtData> {
  try {
    const url = resolveRootUrl(pageUrl, '/llms.txt');
    const res = await fetchWithRetry(url, FETCH_OPTIONS);
    if (!res.ok) {
      return { present: false };
    }
    return { present: true, content: res.body.slice(0, 5000) };
  } catch {
    return { present: false };
  }
}

async function fetchManifest(pageUrl: string): Promise<ManifestData> {
  try {
    const url = resolveRootUrl(pageUrl, '/manifest.json');
    const res = await fetchWithRetry(url, FETCH_OPTIONS);
    if (!res.ok) {
      return { present: false };
    }
    const data = JSON.parse(res.body) as Record<string, unknown>;
    return { present: true, data };
  } catch {
    return { present: false };
  }
}

async function fetchAdsTxt(pageUrl: string): Promise<AdsTxtData> {
  try {
    const url = resolveRootUrl(pageUrl, '/ads.txt');
    const res = await fetchWithRetry(url, FETCH_OPTIONS);
    if (!res.ok) return { present: false, blocked: false };
    const body = res.body;
    if (body.trimStart().startsWith('<')) return { present: false, blocked: false };
    const lines = body.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    return { present: true, blocked: false, lineCount: lines.length, body };
  } catch (err) {
    if (String(err).includes('403')) return { present: false, blocked: true };
    return { present: false, blocked: false };
  }
}

// ---------------------------------------------------------------------------
// Checkpoint builders
// ---------------------------------------------------------------------------

function buildTitleCheckpoint(title: TitleData): Checkpoint {
  const id = 'M04-TITLE';
  const name = 'Title Tag';
  const weight = 7 / 10;

  if (!title.content) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'No title tag found',
      recommendation: 'Add a descriptive <title> tag between 30-60 characters.',
    });
  }

  if (title.length >= 30 && title.length <= 60) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `Title present (${title.length} chars): "${title.content.slice(0, 80)}"`,
    });
  }

  if (title.length > 70) {
    return createCheckpoint({
      id, name, weight,
      health: 'warning',
      evidence: `Title too long (${title.length} chars): "${title.content.slice(0, 80)}..."`,
      recommendation: 'Shorten the title tag to 30-60 characters for optimal display in search results.',
    });
  }

  if (title.length < 10) {
    return createCheckpoint({
      id, name, weight,
      health: 'warning',
      evidence: `Title very short (${title.length} chars): "${title.content}"`,
      recommendation: 'Expand the title tag to 30-60 characters for better SEO impact.',
    });
  }

  // Slightly over/under the ideal range
  return createCheckpoint({
    id, name, weight,
    health: 'good',
    evidence: `Title present (${title.length} chars): "${title.content.slice(0, 80)}"`,
    recommendation: 'Consider adjusting title length to the ideal 30-60 character range.',
  });
}

function buildMetaDescriptionCheckpoint(desc: MetaDescriptionData): Checkpoint {
  const id = 'M04-META-DESC';
  const name = 'Meta Description';
  const weight = 6 / 10;

  if (!desc.content) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'No meta description found',
      recommendation: 'Add a meta description between 120-160 characters summarizing the page content.',
    });
  }

  if (desc.length >= 120 && desc.length <= 160) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `Meta description present (${desc.length} chars)`,
    });
  }

  if (desc.length < 70 || desc.length > 170) {
    return createCheckpoint({
      id, name, weight,
      health: 'warning',
      evidence: `Meta description length suboptimal (${desc.length} chars)`,
      recommendation: 'Adjust meta description to 120-160 characters for optimal search result snippets.',
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'good',
    evidence: `Meta description present (${desc.length} chars)`,
    recommendation: 'Fine-tune meta description to the ideal 120-160 character range.',
  });
}

function buildCanonicalCheckpoint(canonical: string | null, pageUrl: string): Checkpoint {
  const id = 'M04-CANONICAL';
  const name = 'Canonical URL';
  const weight = 7 / 10;

  if (!canonical) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'No canonical URL found',
      recommendation: 'Add a <link rel="canonical"> tag to prevent duplicate content issues.',
    });
  }

  try {
    const canonicalHost = new URL(canonical).hostname;
    const pageHost = new URL(pageUrl).hostname;
    const canonicalPath = new URL(canonical).pathname;
    const pagePath = new URL(pageUrl).pathname;
    // Treat www ↔ apex as the same domain (standard canonicalization)
    const normHost = (h: string) => h.replace(/^www\./, '');
    const sameHost = canonicalHost === pageHost;
    const sameDomain = sameHost || normHost(canonicalHost) === normHost(pageHost);

    if (sameHost && canonicalPath === pagePath) {
      return createCheckpoint({
        id, name, weight,
        health: 'excellent',
        evidence: `Self-referencing canonical URL: ${canonical}`,
      });
    }

    if (sameDomain && canonicalPath === pagePath) {
      return createCheckpoint({
        id, name, weight,
        health: 'excellent',
        evidence: `Canonical URL consolidates www/apex: ${canonical}`,
      });
    }

    if (sameDomain) {
      return createCheckpoint({
        id, name, weight,
        health: 'good',
        evidence: `Canonical URL points to different path on same domain: ${canonical}`,
      });
    }

    return createCheckpoint({
      id, name, weight,
      health: 'warning',
      evidence: `Canonical URL points to different domain: ${canonical}`,
      recommendation: 'Verify the canonical URL is intentional. Cross-domain canonicals can affect indexing.',
    });
  } catch {
    // Relative or malformed canonical
    return createCheckpoint({
      id, name, weight,
      health: 'warning',
      evidence: `Canonical URL present but may be relative or malformed: ${canonical}`,
      recommendation: 'Use an absolute URL for the canonical tag.',
    });
  }
}

function buildOgTagsCheckpoint(ogTags: Record<string, string>): Checkpoint {
  const id = 'M04-OG-TAGS';
  const name = 'Open Graph Tags';
  const weight = 6 / 10;

  const corePresent = CORE_OG_TAGS.filter((tag) => ogTags[tag]);
  const count = corePresent.length;
  const missing = CORE_OG_TAGS.filter((tag) => !ogTags[tag]);

  if (count === 0) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'No Open Graph tags found',
      recommendation: 'Add Open Graph meta tags (og:title, og:description, og:image, og:url, og:type, og:site_name) for rich social sharing.',
    });
  }

  if (count >= 6) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `All ${count} core OG tags present: ${corePresent.join(', ')}`,
    });
  }

  if (count >= 4) {
    return createCheckpoint({
      id, name, weight,
      health: 'good',
      evidence: `${count}/6 core OG tags present. Missing: ${missing.join(', ')}`,
      recommendation: `Add missing OG tags: ${missing.join(', ')}`,
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'warning',
    evidence: `Only ${count}/6 core OG tags present: ${corePresent.join(', ')}`,
    recommendation: `Add missing OG tags: ${missing.join(', ')}`,
  });
}

function buildOgImageCheckpoint(ogTags: Record<string, string>): Checkpoint {
  const id = 'M04-OG-IMAGE';
  const name = 'OG Image';
  const weight = 5 / 10;

  const ogImage = ogTags['og:image'];
  if (!ogImage) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'No og:image tag found',
      recommendation: 'Add an og:image tag with a high-quality image (1200x630 recommended) for social sharing.',
    });
  }

  const hasWidth = !!ogTags['og:image:width'];
  const hasHeight = !!ogTags['og:image:height'];

  if (hasWidth && hasHeight) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `OG image present with dimensions (${ogTags['og:image:width']}x${ogTags['og:image:height']}): ${ogImage.slice(0, 100)}`,
    });
  }

  // Check if URL seems valid
  const seemsValid = /^https?:\/\/.+\..+/.test(ogImage);
  if (!seemsValid) {
    return createCheckpoint({
      id, name, weight,
      health: 'warning',
      evidence: `OG image present but URL seems invalid: ${ogImage.slice(0, 100)}`,
      recommendation: 'Use a fully qualified HTTPS URL for the og:image tag.',
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'good',
    evidence: `OG image present: ${ogImage.slice(0, 100)}`,
    recommendation: 'Add og:image:width and og:image:height tags for faster social previews.',
  });
}

function buildTwitterCardCheckpoint(twitterCards: Record<string, string>): Checkpoint {
  const id = 'M04-TWITTER';
  const name = 'Twitter Card';
  const weight = 4 / 10;

  const cardType = twitterCards['twitter:card'];
  if (!cardType) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'No Twitter Card tags found',
      recommendation: 'Add Twitter Card meta tags for enhanced Twitter/X sharing.',
    });
  }

  const hasTitle = !!twitterCards['twitter:title'];
  const hasDescription = !!twitterCards['twitter:description'];
  const hasImage = !!twitterCards['twitter:image'];
  const hasSite = !!twitterCards['twitter:site'];
  const allFields = hasTitle && hasDescription && hasImage && hasSite;

  if (cardType === 'summary_large_image' && allFields) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: 'summary_large_image Twitter Card with all fields (title, description, image, site)',
    });
  }

  if (cardType === 'summary' || (cardType === 'summary_large_image' && !allFields)) {
    return createCheckpoint({
      id, name, weight,
      health: 'good',
      evidence: `Twitter Card type "${cardType}" present${allFields ? ' with all fields' : ''}`,
      recommendation: allFields
        ? 'Consider upgrading to summary_large_image for more visual impact.'
        : 'Add all Twitter Card fields (twitter:title, twitter:description, twitter:image, twitter:site).',
    });
  }

  // Card type only, minimal fields
  return createCheckpoint({
    id, name, weight,
    health: 'warning',
    evidence: `Twitter Card type "${cardType}" with minimal fields`,
    recommendation: 'Add twitter:title, twitter:description, twitter:image, and twitter:site tags.',
  });
}

function buildSchemaOrgCheckpoint(jsonLd: JsonLdDeep): Checkpoint {
  const id = 'M04-SCHEMA';
  const name = 'Schema.org / JSON-LD';
  const weight = 8 / 10;

  if (jsonLd.raw.length === 0) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'No structured data (JSON-LD) found',
      recommendation: 'Add Schema.org JSON-LD structured data (Organization, WebSite, and content-specific types) for enhanced search results.',
    });
  }

  const { types } = jsonLd;
  const hasOrganization = types.some((t) => /organization/i.test(t));
  const hasWebSite = types.some((t) => /website/i.test(t));
  const hasContentType = types.some((t) =>
    /article|product|localBusiness|faq|breadcrumb|howto|event|recipe|review|video|course/i.test(t),
  );

  const extras: string[] = [];
  if (jsonLd.organizationName) extras.push(`org: ${jsonLd.organizationName}`);
  if (jsonLd.socialProfiles.length > 0) extras.push(`${jsonLd.socialProfiles.length} social profiles`);
  if (jsonLd.hasSearchAction) extras.push('SearchAction');
  const extrasStr = extras.length > 0 ? ` — ${extras.join(', ')}` : '';

  if (hasOrganization && hasWebSite && hasContentType) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `Rich structured data: ${types.join(', ')} (${jsonLd.raw.length} blocks)${extrasStr}`,
    });
  }

  if (hasOrganization && (hasWebSite || hasContentType)) {
    return createCheckpoint({
      id, name, weight,
      health: 'good',
      evidence: `Structured data: ${types.join(', ')} (${jsonLd.raw.length} blocks)${extrasStr}`,
      recommendation: 'Consider adding additional Schema types (WebSite, content-specific) for richer search results.',
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'warning',
    evidence: `Minimal structured data: ${types.join(', ') || 'unparseable types'} (${jsonLd.raw.length} blocks)${extrasStr}`,
    recommendation: 'Add Organization and WebSite Schema.org types at minimum, plus content-specific types.',
  });
}

function extractSchemaTypes(jsonLd: unknown[]): string[] {
  const types: string[] = [];
  for (const item of jsonLd) {
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      if (typeof record['@type'] === 'string') {
        types.push(record['@type']);
      } else if (Array.isArray(record['@type'])) {
        for (const t of record['@type']) {
          if (typeof t === 'string') types.push(t);
        }
      }
      // Handle @graph arrays
      if (Array.isArray(record['@graph'])) {
        types.push(...extractSchemaTypes(record['@graph'] as unknown[]));
      }
    }
  }
  return types;
}

function buildRobotsTxtCheckpoint(robots: RobotsTxtData): Checkpoint {
  const id = 'M04-ROBOTS';
  const name = 'robots.txt';
  const weight = 5 / 10;

  if (robots.blocked) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'robots.txt returns HTTP 403 (Forbidden). Googlebot treats this as a full block on all URLs.',
      recommendation: 'Fix server configuration to return a proper robots.txt (200) or 404. A 403 causes search engines to assume all URLs are disallowed.',
    });
  }

  if (!robots.present) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'No robots.txt found',
      recommendation: 'Create a robots.txt file to guide search engine crawlers and reference your sitemap.',
    });
  }

  const hasSitemap = robots.sitemapUrls.length > 0;
  const blocksImportant = robots.disallowedPaths.some((p) =>
    /^\/$|^\/\*$/.test(p),
  );

  if (blocksImportant) {
    return createCheckpoint({
      id, name, weight,
      health: 'warning',
      evidence: `robots.txt present but blocks important paths: ${robots.disallowedPaths.join(', ')}`,
      recommendation: 'Review robots.txt disallow rules -- broad blocks may prevent search engine indexing.',
    });
  }

  if (hasSitemap) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `robots.txt present with ${robots.sitemapUrls.length} sitemap reference(s), ${robots.disallowedPaths.length} disallow rule(s), ${robots.userAgentCount} user-agent block(s)`,
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'good',
    evidence: `robots.txt present (${robots.disallowedPaths.length} disallow rules, no sitemap reference)`,
    recommendation: 'Add a Sitemap directive to your robots.txt.',
  });
}

function buildSitemapCheckpoint(sitemap: SitemapData): Checkpoint {
  const id = 'M04-SITEMAP';
  const name = 'Sitemap.xml';
  const weight = 6 / 10;

  if (!sitemap.present) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'No sitemap found (checked /sitemap.xml, /sitemap_index.xml, /sitemap-index.xml, and robots.txt references)',
      recommendation: 'Create an XML sitemap to help search engines discover and index all pages.',
    });
  }

  const sourceLabel = sitemap.source === 'index' ? ' (sitemap index)' : sitemap.source === 'robots-txt' ? ' (from robots.txt)' : '';

  if (sitemap.urlCount !== undefined && sitemap.urlCount > 0) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `Sitemap present${sourceLabel} with ${sitemap.urlCount} URL(s)`,
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'good',
    evidence: `Sitemap present${sourceLabel} but could not determine URL count`,
  });
}

function buildFaviconCheckpoint(favicon: FaviconData): Checkpoint {
  const id = 'M04-FAVICON';
  const name = 'Favicon';
  const weight = 3 / 10;

  if (!favicon.present) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'No favicon references found in HTML',
      recommendation: 'Add favicon link tags including apple-touch-icon for cross-browser/device support.',
    });
  }

  const labels = favicon.formats.map(f => {
    const s = f.sizes ? ` ${f.sizes}` : '';
    return `${f.rel}${s}`;
  });
  const hasAppleTouch = favicon.formats.some((f) => f.rel.includes('apple-touch-icon'));
  const hasMultipleSizes = favicon.formats.length >= 2;

  if (hasMultipleSizes && hasAppleTouch) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `Multiple favicon formats including apple-touch-icon: ${labels.join(', ')}`,
    });
  }

  if (hasMultipleSizes) {
    return createCheckpoint({
      id, name, weight,
      health: 'good',
      evidence: `Multiple favicon sizes found: ${labels.join(', ')}`,
      recommendation: 'Add an apple-touch-icon for iOS home screen support.',
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'warning',
    evidence: `Single favicon found: ${labels.join(', ')}`,
    recommendation: 'Add multiple favicon sizes and an apple-touch-icon for cross-device support.',
  });
}

function buildHtmlLangCheckpoint(htmlLang: string | null): Checkpoint {
  const id = 'M04-LANG';
  const name = 'Language (html lang)';
  const weight = 4 / 10;

  if (!htmlLang) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'No lang attribute on <html> element',
      recommendation: 'Add a lang attribute (e.g., <html lang="en">) for accessibility and SEO.',
    });
  }

  // Check if it is a well-formed lang code (e.g., "en", "en-US", "fr-FR")
  const wellFormed = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(htmlLang);

  if (wellFormed && htmlLang.length > 2) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `Specific language attribute: lang="${htmlLang}"`,
    });
  }

  if (wellFormed) {
    return createCheckpoint({
      id, name, weight,
      health: 'good',
      evidence: `Language attribute present: lang="${htmlLang}"`,
      recommendation: 'Consider using a more specific locale (e.g., "en-US" instead of "en").',
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'warning',
    evidence: `Language attribute present but may be non-standard: lang="${htmlLang}"`,
    recommendation: 'Use a valid BCP 47 language tag (e.g., "en", "en-US", "fr-FR").',
  });
}

function buildHreflangCheckpoint(hreflang: HreflangEntry[]): Checkpoint {
  const id = 'M04-HREFLANG';
  const name = 'Hreflang Tags';
  const weight = 4 / 10;

  if (hreflang.length === 0) {
    // For single-language sites, hreflang is not required; treat as informational
    return infoCheckpoint(
      id,
      name,
      'No hreflang tags found (informational -- may be a single-language site)',
    );
  }

  const hasXDefault = hreflang.some((h) => h.lang === 'x-default');
  const langCodes = hreflang.map((h) => h.lang);

  if (hasXDefault && hreflang.length >= 2) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `Hreflang tags with x-default and ${hreflang.length - 1} locale(s): ${langCodes.join(', ')}`,
    });
  }

  if (hreflang.length >= 2) {
    return createCheckpoint({
      id, name, weight,
      health: 'good',
      evidence: `Hreflang tags for ${hreflang.length} locale(s): ${langCodes.join(', ')}`,
      recommendation: 'Add an x-default hreflang entry for users whose language is not matched.',
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'warning',
    evidence: `Hreflang present but only ${hreflang.length} entry: ${langCodes.join(', ')}`,
    recommendation: 'Ensure hreflang tags include all language/region variants and an x-default.',
  });
}

function buildPreconnectCheckpoint(hints: string[], $: cheerio.CheerioAPI): Checkpoint {
  const id = 'M04-PRECONNECT';
  const name = 'Preconnect Hints';
  const weight = 3 / 10;

  // Count external scripts/stylesheets to see if the site uses many 3rd-party resources
  const externalScripts: string[] = [];
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && /^https?:\/\//.test(src)) {
      externalScripts.push(src);
    }
  });
  const heavyThirdParty = externalScripts.length >= 5;

  if (hints.length === 0) {
    if (heavyThirdParty) {
      return infoCheckpoint(
        id,
        name,
        `No preconnect/prefetch hints found despite ${externalScripts.length} external scripts. Consider adding preconnect hints for key third-party origins.`,
      );
    }
    return infoCheckpoint(
      id,
      name,
      'No preconnect/prefetch hints found (informational -- site may not need them)',
    );
  }

  if (hints.length >= 3) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `${hints.length} resource hints found: ${hints.slice(0, 5).join(', ')}${hints.length > 5 ? '...' : ''}`,
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'good',
    evidence: `${hints.length} resource hint(s) found: ${hints.join(', ')}`,
    recommendation: 'Consider adding preconnect hints for additional critical third-party origins.',
  });
}

function buildLlmsTxtCheckpoint(llmsTxt: LlmsTxtData): Checkpoint {
  const id = 'M04-LLMS-TXT';
  const name = 'llms.txt';

  if (!llmsTxt.present) {
    return infoCheckpoint(
      id,
      name,
      'No llms.txt found (informational -- optional emerging standard for LLM guidance)',
    );
  }

  const hasDirectives = llmsTxt.content
    ? llmsTxt.content.trim().length > 20
    : false;

  if (hasDirectives) {
    return createCheckpoint({
      id, name,
      weight: 2 / 10,
      health: 'excellent',
      evidence: `llms.txt present with directives (${llmsTxt.content!.length} chars)`,
    });
  }

  return createCheckpoint({
    id, name,
    weight: 2 / 10,
    health: 'good',
    evidence: 'llms.txt present',
  });
}

function buildManifestCheckpoint(manifest: ManifestData): Checkpoint {
  const id = 'M04-MANIFEST';
  const name = 'manifest.json (PWA)';

  if (!manifest.present) {
    return infoCheckpoint(
      id,
      name,
      'No manifest.json found (informational -- required only for PWA installability)',
    );
  }

  if (manifest.data) {
    const d = manifest.data;
    const hasName = !!d['name'] || !!d['short_name'];
    const hasIcons = Array.isArray(d['icons']) && (d['icons'] as unknown[]).length > 0;
    const hasStartUrl = !!d['start_url'];
    const hasDisplay = !!d['display'];
    const installable = hasName && hasIcons && hasStartUrl && hasDisplay;

    if (installable) {
      return createCheckpoint({
        id, name,
        weight: 3 / 10,
        health: 'excellent',
        evidence: `Valid PWA manifest with name, icons, start_url, and display mode`,
      });
    }

    return createCheckpoint({
      id, name,
      weight: 3 / 10,
      health: 'good',
      evidence: `manifest.json present but may be incomplete for PWA installability`,
      recommendation: 'Ensure manifest includes name, icons, start_url, and display for full PWA support.',
    });
  }

  return createCheckpoint({
    id, name,
    weight: 3 / 10,
    health: 'warning',
    evidence: 'manifest.json present but could not be parsed as valid JSON',
    recommendation: 'Fix JSON syntax errors in manifest.json.',
  });
}

function buildRobotsDirectivesCheckpoint(rd: RobotsDirectives): Checkpoint {
  const id = 'M04-ROBOTS-DIRECTIVES';
  const name = 'Robots Directives';
  const weight = 6 / 10;

  if (rd.noindex) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: `Page is marked noindex${rd.metaRobots ? ` (meta: "${rd.metaRobots}")` : ''}${rd.xRobotsTag ? ` (X-Robots-Tag: "${rd.xRobotsTag}")` : ''}`,
      recommendation: 'Remove noindex directive if this page should appear in search results.',
    });
  }

  if (rd.nofollow) {
    return createCheckpoint({
      id, name, weight,
      health: 'warning',
      evidence: `Page is marked nofollow${rd.metaRobots ? ` (meta: "${rd.metaRobots}")` : ''}${rd.xRobotsTag ? ` (X-Robots-Tag: "${rd.xRobotsTag}")` : ''}`,
      recommendation: 'The nofollow directive prevents link equity from flowing to linked pages. Remove if unintended.',
    });
  }

  if (!rd.metaRobots && !rd.xRobotsTag) {
    return infoCheckpoint(id, name, 'No explicit robots directives (defaults to index, follow)');
  }

  return createCheckpoint({
    id, name, weight,
    health: 'excellent',
    evidence: `Robots directives present: ${[rd.metaRobots, rd.xRobotsTag].filter(Boolean).join(' / ')}`,
  });
}

function buildViewportCheckpoint(vp: ViewportData): Checkpoint {
  const id = 'M04-VIEWPORT';
  const name = 'Viewport Meta';
  const weight = 6 / 10;

  if (!vp.content) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'No viewport meta tag found',
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> for mobile-first indexing and responsive design.',
    });
  }

  if (vp.hasWidth && vp.hasInitialScale) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `Viewport configured: ${vp.content}`,
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'good',
    evidence: `Viewport present but may be incomplete: ${vp.content}`,
    recommendation: 'Ensure viewport includes both width=device-width and initial-scale=1.',
  });
}

function buildCharsetCheckpoint(cs: CharsetData): Checkpoint {
  const id = 'M04-CHARSET';
  const name = 'Character Encoding';
  const weight = 3 / 10;

  if (!cs.charset) {
    return createCheckpoint({
      id, name, weight,
      health: 'warning',
      evidence: 'No charset declaration found in meta tag or Content-Type header',
      recommendation: 'Add <meta charset="utf-8"> as the first child of <head> for consistent character encoding.',
    });
  }

  if (/utf-?8/i.test(cs.charset)) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `UTF-8 charset declared via ${cs.source}: ${cs.charset}`,
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'good',
    evidence: `Charset declared via ${cs.source}: ${cs.charset}`,
    recommendation: 'Consider using UTF-8 encoding for maximum compatibility.',
  });
}

function buildAdsTxtCheckpoint(adsTxt: AdsTxtData): Checkpoint {
  const id = 'M04-ADS-TXT';
  const name = 'ads.txt';

  if (adsTxt.blocked) {
    return infoCheckpoint(id, name, 'ads.txt returns 403 (Forbidden) — if running programmatic ads, this blocks ad verification.');
  }

  if (!adsTxt.present) {
    return infoCheckpoint(id, name, 'No ads.txt found (informational — required only for sites running programmatic advertising)');
  }

  return createCheckpoint({
    id, name,
    weight: 2 / 10,
    health: 'excellent',
    evidence: `ads.txt present with ${adsTxt.lineCount ?? 0} seller record(s)`,
  });
}

// ---------------------------------------------------------------------------
// Signal builders
// ---------------------------------------------------------------------------

function buildSignals(data: M04Data): Signal[] {
  const signals: Signal[] = [];

  // Title signal
  if (data.title.content) {
    signals.push(createSignal({
      type: 'seo',
      name: 'title-tag',
      confidence: 0.95,
      evidence: `Title: "${data.title.content.slice(0, 80)}" (${data.title.length} chars)`,
      category: 'seo_content',
    }));
  }

  // Meta description signal
  if (data.metaDescription.content) {
    signals.push(createSignal({
      type: 'seo',
      name: 'meta-description',
      confidence: 0.95,
      evidence: `Meta description present (${data.metaDescription.length} chars)`,
      category: 'seo_content',
    }));
  }

  // Canonical signal
  if (data.canonical) {
    signals.push(createSignal({
      type: 'seo',
      name: 'canonical-url',
      confidence: 0.95,
      evidence: `Canonical: ${data.canonical}`,
      category: 'seo_content',
    }));
  }

  // Open Graph signal
  const ogCount = Object.keys(data.ogTags).length;
  if (ogCount > 0) {
    signals.push(createSignal({
      type: 'social',
      name: 'open-graph',
      confidence: 0.95,
      evidence: `${ogCount} OG tags: ${Object.keys(data.ogTags).join(', ')}`,
      category: 'seo_content',
    }));
  }

  // Twitter Card signal
  if (data.twitterCards['twitter:card']) {
    signals.push(createSignal({
      type: 'social',
      name: 'twitter-card',
      confidence: 0.95,
      evidence: `Twitter Card: ${data.twitterCards['twitter:card']}`,
      category: 'seo_content',
    }));
  }

  // JSON-LD signal
  if (data.jsonLd.raw.length > 0) {
    signals.push(createSignal({
      type: 'structured-data',
      name: 'json-ld',
      confidence: 0.95,
      evidence: `${data.jsonLd.raw.length} JSON-LD block(s): ${data.jsonLd.types.join(', ') || 'unknown types'}`,
      category: 'seo_content',
    }));
  }

  // Social profiles from JSON-LD sameAs
  if (data.jsonLd.socialProfiles.length > 0) {
    signals.push(createSignal({
      type: 'social-profiles',
      name: 'schema-same-as',
      confidence: 0.95,
      evidence: `${data.jsonLd.socialProfiles.length} social profiles in JSON-LD: ${data.jsonLd.socialProfiles.map(u => { try { return new URL(u).hostname; } catch { return u; } }).join(', ')}`,
      category: 'brand_presence',
    }));
  }

  // robots.txt signal
  if (data.robotsTxt.present) {
    signals.push(createSignal({
      type: 'crawlability',
      name: 'robots-txt',
      confidence: 0.95,
      evidence: `robots.txt present with ${data.robotsTxt.sitemapUrls.length} sitemap ref(s), ${data.robotsTxt.disallowedPaths.length} disallow rule(s)`,
      category: 'seo_content',
    }));
  }

  // Sitemap signal
  if (data.sitemap.present) {
    signals.push(createSignal({
      type: 'crawlability',
      name: 'sitemap-xml',
      confidence: 0.95,
      evidence: `sitemap.xml present${data.sitemap.urlCount !== undefined ? ` with ${data.sitemap.urlCount} URLs` : ''}`,
      category: 'seo_content',
    }));
  }

  // Favicon signal
  if (data.favicon.present) {
    const faviconLabels = data.favicon.formats.map(f => `${f.rel}${f.sizes ? ` ${f.sizes}` : ''}`);
    signals.push(createSignal({
      type: 'branding',
      name: 'favicon',
      confidence: 0.9,
      evidence: `Favicon formats: ${faviconLabels.join(', ')}`,
      category: 'brand_presence',
    }));
  }

  // Language signal
  if (data.htmlLang) {
    signals.push(createSignal({
      type: 'i18n',
      name: 'html-lang',
      confidence: 0.95,
      evidence: `HTML lang="${data.htmlLang}"`,
      category: 'seo_content',
    }));
  }

  // Hreflang signal
  if (data.hreflang.length > 0) {
    signals.push(createSignal({
      type: 'i18n',
      name: 'hreflang',
      confidence: 0.95,
      evidence: `${data.hreflang.length} hreflang entries: ${data.hreflang.map((h) => h.lang).join(', ')}`,
      category: 'seo_content',
    }));
  }

  // Preconnect hints signal
  if (data.preconnectHints.length > 0) {
    signals.push(createSignal({
      type: 'performance',
      name: 'resource-hints',
      confidence: 0.85,
      evidence: `${data.preconnectHints.length} resource hint(s)`,
      category: 'performance_experience',
    }));
  }

  // llms.txt signal
  if (data.llmsTxt.present) {
    signals.push(createSignal({
      type: 'ai-readiness',
      name: 'llms-txt',
      confidence: 0.9,
      evidence: 'llms.txt present',
      category: 'brand_presence',
    }));
  }

  // PWA manifest signal
  if (data.manifest.present) {
    signals.push(createSignal({
      type: 'pwa',
      name: 'web-app-manifest',
      confidence: 0.9,
      evidence: 'manifest.json present',
      category: 'brand_presence',
    }));
  }

  // Robots directives signal
  if (data.robotsDirectives.noindex || data.robotsDirectives.nofollow) {
    signals.push(createSignal({
      type: 'crawlability',
      name: 'robots-directives',
      confidence: 0.95,
      evidence: `Robots directives: ${[data.robotsDirectives.metaRobots, data.robotsDirectives.xRobotsTag].filter(Boolean).join(' / ')}`,
      category: 'seo_content',
    }));
  }

  // Alternate links signal (RSS/Atom feeds)
  if (data.alternateLinks.length > 0) {
    signals.push(createSignal({
      type: 'feed',
      name: 'alternate-links',
      confidence: 0.95,
      evidence: `${data.alternateLinks.length} alternate link(s): ${data.alternateLinks.map(l => l.type).join(', ')}`,
      category: 'brand_presence',
    }));
  }

  // OpenSearch signal
  if (data.openSearch.present) {
    signals.push(createSignal({
      type: 'search',
      name: 'opensearch',
      confidence: 0.9,
      evidence: `OpenSearch descriptor${data.openSearch.title ? `: ${data.openSearch.title}` : ''}`,
      category: 'brand_presence',
    }));
  }

  // AMP signal
  if (data.isAMP) {
    signals.push(createSignal({
      type: 'amp',
      name: 'amp-page',
      confidence: 0.95,
      evidence: 'AMP version detected',
      category: 'performance_experience',
    }));
  }

  // ads.txt signal
  if (data.adsTxt.present) {
    signals.push(createSignal({
      type: 'advertising',
      name: 'ads-txt',
      confidence: 0.95,
      evidence: `ads.txt present with ${data.adsTxt.lineCount ?? 0} seller record(s)`,
      category: 'marketing',
    }));
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Module execute function
// ---------------------------------------------------------------------------

const execute: ModuleExecuteFn = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const startTime = Date.now();

  if (!ctx.html) {
    return {
      moduleId: 'M04' as ModuleId,
      status: 'error',
      data: {},
      signals: [],
      score: null,
      checkpoints: [],
      duration: Date.now() - startTime,
      error: 'No HTML available for metadata extraction',
    };
  }

  // Parse HTML with cheerio
  const $ = cheerio.load(ctx.html);

  // Extract all metadata from HTML
  const title = extractTitle($);
  const metaDescription = extractMetaDescription($);
  const canonical = extractCanonical($);
  const ogTags = extractOgTags($);
  const twitterCards = extractTwitterCards($);
  const jsonLd = extractJsonLdDeep($);
  const favicon = extractFavicons($);
  const htmlLang = extractHtmlLang($);
  const hreflang = extractHreflang($);
  const preconnectHints = extractPreconnectHints($);
  const metaTags = extractMetaTags($);
  const robotsDirectives = extractRobotsDirectives($, ctx.headers);
  const viewport = extractViewport($);
  const charset = extractCharset($, ctx.headers);
  const alternateLinks = extractAlternateLinks($);
  const pagination = extractPagination($);
  const openSearch = extractOpenSearch($);
  const isAMP = detectAMP($);

  // Fetch remote resources in parallel (all non-fatal)
  const [robotsTxt, llmsTxt, manifest, adsTxt] = await Promise.all([
    fetchRobotsTxt(ctx.url),
    fetchLlmsTxt(ctx.url),
    fetchManifest(ctx.url),
    fetchAdsTxt(ctx.url),
  ]);

  // Sitemap needs robots.txt sitemapUrls first
  const sitemap = await fetchSitemap(ctx.url, robotsTxt.sitemapUrls);

  // Structured data extraction (microdata, RDFa, rich snippet eligibility)
  const structuredData = extractStructuredData(ctx.html);

  // Assemble data output
  const data: M04Data = {
    title,
    metaDescription,
    canonical,
    ogTags,
    twitterCards,
    jsonLd,
    robotsTxt,
    sitemap,
    llmsTxt,
    manifest,
    favicon,
    htmlLang,
    hreflang,
    preconnectHints,
    metaTags,
    robotsDirectives,
    viewport,
    charset,
    adsTxt,
    alternateLinks,
    pagination,
    openSearch,
    isAMP,
  } as M04Data;

  // Add structured data to data output (outside M04Data interface to avoid breaking changes)
  const extendedData = data as unknown as Record<string, unknown>;
  extendedData['structuredData'] = {
    microdata: structuredData.microdata,
    rdfa: structuredData.rdfa,
    richSnippetEligibility: structuredData.richSnippetEligibility,
    validationErrors: structuredData.validationErrors,
    totalItems: structuredData.totalItems,
  };

  // ── Enhancement: Content Analysis Integration ─────────────────────────────
  if (ctx.contentAnalysis) {
    extendedData['contentAnalysis'] = ctx.contentAnalysis;
  }

  // ── Enhancement: robots.txt Deep Parsing ──────────────────────────────────
  const robotsAnalysis: Record<string, unknown> = {};
  if (robotsTxt.content) {
    const adminPaths: string[] = [];
    const stagingPaths: string[] = [];
    const internalPaths: string[] = [];
    const sensitivePaths: string[] = [];
    const otherPaths: string[] = [];
    let crawlDelay: number | null = null;

    for (const path of robotsTxt.disallowedPaths) {
      if (/admin|wp-admin|dashboard|cpanel/i.test(path)) adminPaths.push(path);
      else if (/staging|dev|test|preview/i.test(path)) stagingPaths.push(path);
      else if (/internal|debug|api\/debug/i.test(path)) internalPaths.push(path);
      else if (/backup|\.env|\.git|\.svn|config|secret|credential/i.test(path)) sensitivePaths.push(path);
      else otherPaths.push(path);
    }

    const grouped = { admin: adminPaths, staging: stagingPaths, internal: internalPaths, sensitive: sensitivePaths, other: otherPaths };

    // Extract crawl-delay from content
    const crawlDelayMatch = robotsTxt.content.match(/^crawl-delay:\s*(\d+)/im);
    if (crawlDelayMatch) crawlDelay = parseInt(crawlDelayMatch[1]!, 10);

    // Flag security-sensitive paths
    const securityFlags = [
      ...(adminPaths.length > 0 ? ['Exposed admin paths in robots.txt'] : []),
      ...(sensitivePaths.length > 0 ? ['Security-sensitive paths listed in robots.txt (visible to attackers)'] : []),
    ];

    robotsAnalysis.groupedPaths = grouped;
    robotsAnalysis.crawlDelay = crawlDelay;
    robotsAnalysis.securityFlags = securityFlags;
  }
  extendedData['robotsTxtAnalysis'] = robotsAnalysis;

  // ── Enhancement: ads.txt Entry Parsing ────────────────────────────────────
  if (adsTxt.present && adsTxt.body) {
    interface AdsTxtEntry {
      domain: string;
      publisherId: string;
      relationship: string;
      certAuthorityId: string | null;
    }
    const parsedEntries: AdsTxtEntry[] = [];
    let directCount = 0;
    let resellerCount = 0;
    const networkSet = new Set<string>();
    const knownNetworks: Record<string, string> = {
      'google.com': 'Google',
      'facebook.com': 'Facebook',
      'amazon.com': 'Amazon',
      'openx.com': 'OpenX',
      'indexexchange.com': 'Index Exchange',
      'appnexus.com': 'AppNexus',
      'rubiconproject.com': 'Rubicon Project',
      'pubmatic.com': 'PubMatic',
      'sovrn.com': 'Sovrn',
      'criteo.com': 'Criteo',
      'smartadserver.com': 'Smart AdServer',
      'adcolony.com': 'AdColony',
      'districtm.io': 'District M',
      'contextweb.com': 'Contextweb',
      'triplelift.com': 'TripleLift',
      'sharethrough.com': 'Sharethrough',
      'yieldmo.com': 'Yieldmo',
      'spotxchange.com': 'SpotX',
    };

    const adLines = adsTxt.body.split('\n');
    for (const line of adLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parts = trimmed.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        const entryDomain = parts[0]!;
        const publisherId = parts[1]!;
        const relationship = parts[2]!.toUpperCase();
        const certAuthorityId = parts.length >= 4 ? parts[3]! : null;

        parsedEntries.push({ domain: entryDomain, publisherId, relationship, certAuthorityId });

        if (relationship === 'DIRECT') directCount++;
        else if (relationship === 'RESELLER') resellerCount++;

        // Identify partner network
        const domainLower = entryDomain.toLowerCase();
        for (const [networkDomain, networkName] of Object.entries(knownNetworks)) {
          if (domainLower.includes(networkDomain)) {
            networkSet.add(networkName);
            break;
          }
        }
      }
    }

    extendedData['adsTxtParsed'] = {
      entries: parsedEntries.slice(0, 100),
      directCount,
      resellerCount,
      partnerNetworks: [...networkSet],
    };
  }

  // ── Enhancement: Sitemap lastmod Freshness ────────────────────────────────
  {
    // Re-fetch sitemap to extract lastmod dates (only if sitemap was found)
    if (sitemap.present) {
      try {
        // Try to find a sitemap URL to fetch
        const sitemapUrlCandidates = [
          ...robotsTxt.sitemapUrls,
          ...SITEMAP_PATHS.map(p => resolveRootUrl(ctx.url, p)),
        ];
        let sitemapBody: string | null = null;
        for (const sitemapUrl of sitemapUrlCandidates) {
          try {
            const sitemapRes = await fetchWithRetry(sitemapUrl, FETCH_OPTIONS);
            if (sitemapRes.ok && sitemapRes.body.includes('<')) {
              sitemapBody = sitemapRes.body;
              break;
            }
          } catch { /* try next */ }
        }

        if (sitemapBody) {
          const lastmodMatches = [...sitemapBody.matchAll(/<lastmod>([^<]+)<\/lastmod>/gi)];
          if (lastmodMatches.length > 0) {
            const now = Date.now();
            const DAY_MS = 86_400_000;
            let newest = 0;
            let oldest = Infinity;
            let staleCount = 0;
            let last30d = 0;
            let last90d = 0;
            let last365d = 0;
            let totalWithLastmod = 0;

            for (const m of lastmodMatches) {
              const dateStr = m[1]!.trim();
              const ts = Date.parse(dateStr);
              if (isNaN(ts)) continue;

              totalWithLastmod++;
              const ageMs = now - ts;

              if (ts > newest) newest = ts;
              if (ts < oldest) oldest = ts;

              if (ageMs > 365 * DAY_MS) staleCount++;
              if (ageMs <= 30 * DAY_MS) last30d++;
              if (ageMs <= 90 * DAY_MS) last90d++;
              if (ageMs <= 365 * DAY_MS) last365d++;
            }

            if (totalWithLastmod > 0) {
              extendedData['sitemapFreshness'] = {
                newestLastmod: new Date(newest).toISOString(),
                oldestLastmod: oldest !== Infinity ? new Date(oldest).toISOString() : null,
                staleCount,
                totalWithLastmod,
                freshnessDistribution: {
                  last30d,
                  last90d,
                  last365d,
                },
              };
            }
          }
        }
      } catch { /* sitemap freshness is best-effort */ }
    }
  }

  // ── Enhancement: Viewport Quality Validation ──────────────────────────────
  {
    const viewportConfig: Record<string, unknown> = { ...viewport };
    if (viewport.content) {
      const attrs = Object.fromEntries(
        viewport.content.split(',').map(p => p.trim().split('=').map(s => s.trim()))
      );
      viewportConfig.attributes = attrs;
      viewportConfig.blocksZoom = attrs['user-scalable'] === 'no' || attrs['maximum-scale'] === '1';
      viewportConfig.isOptimal = attrs['width'] === 'device-width' && attrs['initial-scale'] === '1';
    }
    extendedData['viewportConfig'] = viewportConfig;
  }

  // ── Enhancement: Link Structure ───────────────────────────────────────────
  if (ctx.linkAnalysis) {
    extendedData['linkStructure'] = ctx.linkAnalysis;
  }

  // Build checkpoints
  const checkpoints: Checkpoint[] = [
    buildTitleCheckpoint(title),
    buildMetaDescriptionCheckpoint(metaDescription),
    buildCanonicalCheckpoint(canonical, ctx.url),
    buildOgTagsCheckpoint(ogTags),
    buildOgImageCheckpoint(ogTags),
    buildTwitterCardCheckpoint(twitterCards),
    buildSchemaOrgCheckpoint(jsonLd),
    buildRobotsTxtCheckpoint(robotsTxt),
    buildSitemapCheckpoint(sitemap),
    buildFaviconCheckpoint(favicon),
    buildHtmlLangCheckpoint(htmlLang),
    buildHreflangCheckpoint(hreflang),
    buildPreconnectCheckpoint(preconnectHints, $),
    buildLlmsTxtCheckpoint(llmsTxt),
    buildManifestCheckpoint(manifest),
    buildRobotsDirectivesCheckpoint(robotsDirectives),
    buildViewportCheckpoint(viewport),
    buildCharsetCheckpoint(charset),
    buildAdsTxtCheckpoint(adsTxt),
  ];

  // Structured Data Coverage checkpoint
  {
    const totalSD = structuredData.totalItems;
    const formats: string[] = [];
    if (jsonLd.types.length > 0) formats.push('JSON-LD');
    if (structuredData.microdata.length > 0) formats.push('Microdata');
    if (structuredData.rdfa.length > 0) formats.push('RDFa');

    if (totalSD > 0) {
      const hasErrors = structuredData.validationErrors.length > 0;
      checkpoints.push(createCheckpoint({
        id: 'm04-structured-data',
        name: 'Structured Data Coverage',
        weight: 0.5,
        health: hasErrors ? 'good' : 'excellent',
        evidence: `${totalSD} structured data item(s) across ${formats.join(', ')} (types: ${[...jsonLd.types, ...structuredData.microdata.map(m => m.type), ...structuredData.rdfa.map(r => r.type)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6).join(', ')})${hasErrors ? ` — ${structuredData.validationErrors.length} validation issue(s)` : ''}`,
        recommendation: hasErrors ? `Fix missing required properties: ${structuredData.validationErrors.slice(0, 3).map(e => `${e.type} missing ${e.missing.join(', ')}`).join('; ')}` : undefined,
      }));
    } else {
      checkpoints.push(createCheckpoint({
        id: 'm04-structured-data',
        name: 'Structured Data Coverage',
        weight: 0.5,
        health: 'warning',
        evidence: 'No structured data found (JSON-LD, Microdata, or RDFa)',
        recommendation: 'Add JSON-LD structured data (Organization, WebSite, BreadcrumbList at minimum) to improve search engine understanding.',
      }));
    }
  }

  // Rich Snippet Eligibility checkpoint
  {
    const eligible = structuredData.richSnippetEligibility.filter(a => a.eligible);
    const ineligible = structuredData.richSnippetEligibility.filter(a => !a.eligible);

    if (eligible.length > 0) {
      checkpoints.push(createCheckpoint({
        id: 'm04-rich-snippets',
        name: 'Rich Snippet Eligibility',
        weight: 0.4,
        health: ineligible.length === 0 ? 'excellent' : 'good',
        evidence: `Eligible for ${eligible.length} rich result feature(s): ${eligible.map(e => e.feature).join(', ')}${ineligible.length > 0 ? ` — ${ineligible.length} type(s) missing required fields` : ''}`,
        recommendation: ineligible.length > 0 ? `Fix: ${ineligible.slice(0, 3).map(e => `${e.feature} missing ${e.missingRequired.join(', ')}`).join('; ')}` : undefined,
      }));
    } else if (structuredData.richSnippetEligibility.length > 0) {
      checkpoints.push(createCheckpoint({
        id: 'm04-rich-snippets',
        name: 'Rich Snippet Eligibility',
        weight: 0.4,
        health: 'warning',
        evidence: `${structuredData.richSnippetEligibility.length} rich result type(s) found but none fully valid`,
        recommendation: `Add missing required properties: ${ineligible.slice(0, 3).map(e => `${e.feature} needs ${e.missingRequired.join(', ')}`).join('; ')}`,
      }));
    } else if (structuredData.totalItems > 0) {
      checkpoints.push(infoCheckpoint(
        'm04-rich-snippets',
        'Rich Snippet Eligibility',
        'Structured data present but no Google rich result types detected (Organization, WebSite are informational only)',
      ));
    }
  }

  // ── Enhancement Checkpoints: Content Analysis ────────────────────────────
  if (ctx.contentAnalysis) {
    const ca = ctx.contentAnalysis;

    // Content Readability checkpoint
    {
      const score = ca.readabilityScore;
      let health: 'critical' | 'warning' | 'good' | 'excellent';
      let evidence: string;
      let recommendation: string | undefined;

      if (score >= 70) {
        health = 'excellent';
        evidence = `Content readability is strong (Flesch score: ${score}, grade level: ${ca.readingGradeLevel})`;
      } else if (score >= 50) {
        health = 'good';
        evidence = `Content readability is adequate (Flesch score: ${score}, grade level: ${ca.readingGradeLevel})`;
      } else if (score >= 30) {
        health = 'warning';
        evidence = `Content readability is below average (Flesch score: ${score}, grade level: ${ca.readingGradeLevel})`;
        recommendation = 'Simplify sentence structure and reduce complex vocabulary to improve readability.';
      } else {
        health = 'critical';
        evidence = `Content is very difficult to read (Flesch score: ${score}, grade level: ${ca.readingGradeLevel})`;
        recommendation = 'Content requires a high reading level. Simplify language, shorten sentences, and use common words to reach a broader audience.';
      }

      checkpoints.push(createCheckpoint({
        id: 'M04-READABILITY',
        name: 'Content Readability',
        weight: 0.4,
        health,
        evidence,
        recommendation,
      }));
    }

    // Heading Structure checkpoint
    {
      const issues: string[] = [];
      if (ca.duplicateH1) issues.push('Multiple H1 tags found');
      if (!ca.hasProperHierarchy) issues.push('Heading hierarchy has gaps');

      let health: 'warning' | 'good' | 'excellent';
      let recommendation: string | undefined;

      if (issues.length >= 2) {
        health = 'warning';
        recommendation = 'Fix heading structure: use a single H1 tag and ensure heading levels do not skip (e.g., H1 -> H3 without H2).';
      } else if (issues.length === 1) {
        health = 'warning';
        recommendation = issues[0] === 'Multiple H1 tags found'
          ? 'Use a single H1 tag per page for clear content hierarchy.'
          : 'Ensure heading levels do not skip (e.g., H1 -> H3 without H2).';
      } else {
        health = 'excellent';
      }

      checkpoints.push(createCheckpoint({
        id: 'M04-HEADINGS',
        name: 'Heading Structure',
        weight: 0.5,
        health,
        evidence: `H1 count: ${ca.h1Count}, proper hierarchy: ${ca.hasProperHierarchy ? 'yes' : 'no'}${issues.length > 0 ? ` — ${issues.join('; ')}` : ''}`,
        recommendation,
      }));
    }

    // Content Freshness checkpoint
    {
      const currentYear = new Date().getFullYear();
      const hasCopyrightYear = ca.copyrightYear !== null;
      const hasDates = ca.publishedDate !== null || ca.modifiedDate !== null || ca.lastModifiedHeader !== null;

      if (hasCopyrightYear && ca.copyrightYear! < currentYear - 2) {
        checkpoints.push(createCheckpoint({
          id: 'M04-FRESHNESS',
          name: 'Content Freshness',
          weight: 0.3,
          health: 'warning',
          evidence: `Copyright year is ${ca.copyrightYear}, which is more than 2 years old (current: ${currentYear})`,
          recommendation: 'Update the copyright year and review content for accuracy. Outdated copyright dates signal neglect to visitors and search engines.',
        }));
      } else if (!hasCopyrightYear && !hasDates) {
        checkpoints.push(infoCheckpoint(
          'M04-FRESHNESS',
          'Content Freshness',
          'No content dates found (no published date, modified date, or copyright year). Consider adding date metadata for content freshness signals.',
        ));
      } else if (ca.modifiedDate || ca.publishedDate) {
        // Check if the most recent date is within the last year
        const recentDate = ca.modifiedDate ?? ca.publishedDate;
        let dateTs: number | null = null;
        if (recentDate) {
          const parsed = Date.parse(recentDate);
          if (!isNaN(parsed)) dateTs = parsed;
        }

        if (dateTs && Date.now() - dateTs < 365 * 86_400_000) {
          checkpoints.push(createCheckpoint({
            id: 'M04-FRESHNESS',
            name: 'Content Freshness',
            weight: 0.3,
            health: 'excellent',
            evidence: `Content recently updated: ${ca.modifiedDate ? `modified ${ca.modifiedDate}` : `published ${ca.publishedDate}`}${hasCopyrightYear ? `, copyright ${ca.copyrightYear}` : ''}`,
          }));
        } else {
          checkpoints.push(createCheckpoint({
            id: 'M04-FRESHNESS',
            name: 'Content Freshness',
            weight: 0.3,
            health: 'good',
            evidence: `Content dates present: ${ca.modifiedDate ? `modified ${ca.modifiedDate}` : `published ${ca.publishedDate}`}${hasCopyrightYear ? `, copyright ${ca.copyrightYear}` : ''}`,
            recommendation: 'Consider updating content to maintain freshness signals for search engines.',
          }));
        }
      } else {
        // Has copyright year that is recent
        checkpoints.push(createCheckpoint({
          id: 'M04-FRESHNESS',
          name: 'Content Freshness',
          weight: 0.3,
          health: 'good',
          evidence: `Copyright year is current: ${ca.copyrightYear}`,
        }));
      }
    }
  }

  // ── Enhancement Checkpoint: Viewport Accessibility ────────────────────────
  {
    const vc = extendedData['viewportConfig'] as Record<string, unknown> | undefined;
    if (vc && viewport.content) {
      const blocksZoom = vc['blocksZoom'] === true;
      if (blocksZoom) {
        checkpoints.push(createCheckpoint({
          id: 'M04-VIEWPORT-A11Y',
          name: 'Viewport Accessibility',
          weight: 0.4,
          health: 'warning',
          evidence: `Viewport prevents user zoom — accessibility issue (content: "${viewport.content}")`,
          recommendation: 'Remove user-scalable=no and maximum-scale=1 from the viewport meta tag. Users with low vision need to be able to zoom.',
        }));
      } else {
        checkpoints.push(createCheckpoint({
          id: 'M04-VIEWPORT-A11Y',
          name: 'Viewport Accessibility',
          weight: 0.4,
          health: 'excellent',
          evidence: `Viewport allows user zoom (content: "${viewport.content}")`,
        }));
      }
    }
  }

  // ── Enhancement Checkpoints: Link Structure ───────────────────────────────
  if (ctx.linkAnalysis) {
    const la = ctx.linkAnalysis;

    // Internal Link Quality checkpoint
    {
      const totalLinks = la.totalLinks || 1; // avoid division by zero
      const genericPct = (la.genericAnchors / totalLinks) * 100;
      const issues: string[] = [];

      if (genericPct > 20) issues.push(`${la.genericAnchors} generic anchor texts (${Math.round(genericPct)}% of links)`);
      if (la.emptyAnchors > 0) issues.push(`${la.emptyAnchors} empty anchor(s) with no accessible text`);

      let health: 'warning' | 'good' | 'excellent';
      let recommendation: string | undefined;

      if (issues.length > 0) {
        health = 'warning';
        recommendation = issues.length > 1
          ? 'Replace generic anchor text ("click here", "read more") with descriptive text, and add text or aria-labels to empty links.'
          : (la.emptyAnchors > 0
            ? 'Add descriptive text or aria-label attributes to empty anchor elements.'
            : 'Replace generic anchor text ("click here", "read more") with descriptive link text for better SEO and accessibility.');
      } else if (la.genericAnchors === 0 && la.emptyAnchors === 0) {
        health = 'excellent';
      } else {
        health = 'good';
      }

      checkpoints.push(createCheckpoint({
        id: 'M04-LINK-QUALITY',
        name: 'Internal Link Quality',
        weight: 0.4,
        health,
        evidence: `${la.totalLinks} total links, ${la.genericAnchors} generic anchors, ${la.emptyAnchors} empty anchors, ${la.imageOnlyAnchors} image-only anchors`,
        recommendation,
      }));
    }

    // Link Security checkpoint
    {
      if (la.newTabCount > 0) {
        // Check how many target="_blank" links lack noopener
        // newTabCount = all target="_blank" links, noopenerCount = those with noopener
        // Links with target="_blank" but WITHOUT noopener = newTabCount - noopenerCount (approximate)
        const unsafeBlankLinks = la.newTabCount - la.noopenerCount;

        if (unsafeBlankLinks > 0) {
          checkpoints.push(createCheckpoint({
            id: 'M04-LINK-SECURITY',
            name: 'Link Security',
            weight: 0.3,
            health: 'warning',
            evidence: `${unsafeBlankLinks} link(s) with target="_blank" missing rel="noopener" (${la.newTabCount} total target="_blank" links, ${la.noopenerCount} with noopener)`,
            recommendation: 'Add rel="noopener" (or rel="noopener noreferrer") to all links with target="_blank" to prevent reverse tabnapping attacks.',
          }));
        } else {
          checkpoints.push(createCheckpoint({
            id: 'M04-LINK-SECURITY',
            name: 'Link Security',
            weight: 0.3,
            health: 'excellent',
            evidence: `All ${la.newTabCount} target="_blank" link(s) have rel="noopener"`,
          }));
        }
      } else {
        checkpoints.push(infoCheckpoint(
          'M04-LINK-SECURITY',
          'Link Security',
          'No target="_blank" links found (informational -- no reverse tabnapping risk)',
        ));
      }
    }
  }

  // AMP info checkpoint
  if (isAMP) {
    const ampHref = $('link[rel="amphtml"]').attr('href');
    const ampEvidence = ampHref
      ? `AMP version detected with amphtml link: ${ampHref}`
      : 'AMP page detected (<html amp> or <html ⚡>)';
    checkpoints.push(infoCheckpoint('M04-AMP', 'AMP Detection', ampEvidence));
  }

  // Build signals
  const signals = buildSignals(data);

  return {
    moduleId: 'M04' as ModuleId,
    status: 'success',
    data: data as unknown as Record<string, unknown>,
    signals,
    score: null, // Score is calculated by the runner from checkpoints
    checkpoints,
    duration: Date.now() - startTime,
  };
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export { execute };
registerModuleExecutor('M04' as ModuleId, execute);
