import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext, ModuleExecuteFn } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { fetchWithRetry } from '../../utils/http.js';
import * as cheerio from 'cheerio';

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
  content?: string;
  sitemapUrls: string[];
  disallowedPaths: string[];
}

interface SitemapData {
  present: boolean;
  urlCount?: number;
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
  formats: string[];
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
  jsonLd: unknown[];
  robotsTxt: RobotsTxtData;
  sitemap: SitemapData;
  llmsTxt: LlmsTxtData;
  manifest: ManifestData;
  favicon: FaviconData;
  htmlLang: string | null;
  hreflang: HreflangEntry[];
  preconnectHints: string[];
  metaTags: Record<string, string>;
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

function extractJsonLd($: cheerio.CheerioAPI): unknown[] {
  const data: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (content) {
      try {
        data.push(JSON.parse(content));
      } catch {
        // Invalid JSON-LD, skip
      }
    }
  });
  return data;
}

function extractFavicons($: cheerio.CheerioAPI): FaviconData {
  const formats: string[] = [];
  $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').each((_, el) => {
    const href = $(el).attr('href');
    const rel = $(el).attr('rel') ?? '';
    if (href) {
      const sizes = $(el).attr('sizes') ?? '';
      const label = rel.includes('apple-touch-icon')
        ? `apple-touch-icon${sizes ? ` ${sizes}` : ''}`
        : `icon${sizes ? ` ${sizes}` : ''}`;
      formats.push(label);
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

// ---------------------------------------------------------------------------
// Remote resource fetchers
// ---------------------------------------------------------------------------

function resolveRootUrl(pageUrl: string, path: string): string {
  const parsed = new URL(pageUrl);
  return `${parsed.origin}${path}`;
}

async function fetchRobotsTxt(pageUrl: string): Promise<RobotsTxtData> {
  try {
    const url = resolveRootUrl(pageUrl, '/robots.txt');
    const res = await fetchWithRetry(url, FETCH_OPTIONS);
    if (!res.ok) {
      return { present: false, sitemapUrls: [], disallowedPaths: [] };
    }
    const content = res.body;
    const sitemapUrls: string[] = [];
    const disallowedPaths: string[] = [];
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (/^sitemap:/i.test(trimmed)) {
        const val = trimmed.replace(/^sitemap:\s*/i, '').trim();
        if (val) sitemapUrls.push(val);
      } else if (/^disallow:/i.test(trimmed)) {
        const val = trimmed.replace(/^disallow:\s*/i, '').trim();
        if (val) disallowedPaths.push(val);
      }
    }
    return { present: true, content, sitemapUrls, disallowedPaths };
  } catch {
    return { present: false, sitemapUrls: [], disallowedPaths: [] };
  }
}

async function fetchSitemap(pageUrl: string): Promise<SitemapData> {
  try {
    const url = resolveRootUrl(pageUrl, '/sitemap.xml');
    const res = await fetchWithRetry(url, FETCH_OPTIONS);
    if (!res.ok) {
      return { present: false };
    }
    // Count <url> or <loc> occurrences as a proxy for URL count
    const body = res.body;
    const locMatches = body.match(/<loc>/gi);
    const urlCount = locMatches ? locMatches.length : undefined;
    return { present: true, urlCount };
  } catch {
    return { present: false };
  }
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

    if (canonicalHost === pageHost && canonicalPath === pagePath) {
      return createCheckpoint({
        id, name, weight,
        health: 'excellent',
        evidence: `Self-referencing canonical URL: ${canonical}`,
      });
    }

    if (canonicalHost === pageHost) {
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

function buildSchemaOrgCheckpoint(jsonLd: unknown[]): Checkpoint {
  const id = 'M04-SCHEMA';
  const name = 'Schema.org / JSON-LD';
  const weight = 8 / 10;

  if (jsonLd.length === 0) {
    return createCheckpoint({
      id, name, weight,
      health: 'critical',
      evidence: 'No structured data (JSON-LD) found',
      recommendation: 'Add Schema.org JSON-LD structured data (Organization, WebSite, and content-specific types) for enhanced search results.',
    });
  }

  const types = extractSchemaTypes(jsonLd);
  const hasOrganization = types.some((t) => /organization/i.test(t));
  const hasWebSite = types.some((t) => /website/i.test(t));
  const hasContentType = types.some((t) =>
    /article|product|localBusiness|faq|breadcrumb|howto|event|recipe|review|video|course/i.test(t),
  );

  if (hasOrganization && hasWebSite && hasContentType) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `Rich structured data found: ${types.join(', ')} (${jsonLd.length} blocks)`,
    });
  }

  if (hasOrganization && (hasWebSite || hasContentType)) {
    return createCheckpoint({
      id, name, weight,
      health: 'good',
      evidence: `Structured data found: ${types.join(', ')} (${jsonLd.length} blocks)`,
      recommendation: 'Consider adding additional Schema types (WebSite, content-specific) for richer search results.',
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'warning',
    evidence: `Minimal structured data: ${types.join(', ') || 'unparseable types'} (${jsonLd.length} blocks)`,
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

  if (hasSitemap && robots.disallowedPaths.length >= 0) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `robots.txt present with ${robots.sitemapUrls.length} sitemap reference(s) and ${robots.disallowedPaths.length} disallow rule(s)`,
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
      evidence: 'No sitemap.xml found at /sitemap.xml',
      recommendation: 'Create an XML sitemap to help search engines discover and index all pages.',
    });
  }

  if (sitemap.urlCount !== undefined && sitemap.urlCount > 0) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `Sitemap present and parseable with ${sitemap.urlCount} URL(s)`,
    });
  }

  if (sitemap.urlCount === 0 || sitemap.urlCount === undefined) {
    return createCheckpoint({
      id, name, weight,
      health: 'good',
      evidence: 'Sitemap present but could not determine URL count (may be a sitemap index)',
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'warning',
    evidence: 'Sitemap present but has parsing errors',
    recommendation: 'Validate your XML sitemap using Google Search Console or a sitemap validator.',
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

  const hasAppleTouch = favicon.formats.some((f) => f.includes('apple-touch-icon'));
  const hasMultipleSizes = favicon.formats.length >= 2;

  if (hasMultipleSizes && hasAppleTouch) {
    return createCheckpoint({
      id, name, weight,
      health: 'excellent',
      evidence: `Multiple favicon formats including apple-touch-icon: ${favicon.formats.join(', ')}`,
    });
  }

  if (hasMultipleSizes) {
    return createCheckpoint({
      id, name, weight,
      health: 'good',
      evidence: `Multiple favicon sizes found: ${favicon.formats.join(', ')}`,
      recommendation: 'Add an apple-touch-icon for iOS home screen support.',
    });
  }

  return createCheckpoint({
    id, name, weight,
    health: 'warning',
    evidence: `Single favicon found: ${favicon.formats.join(', ')}`,
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
  if (data.jsonLd.length > 0) {
    const types = extractSchemaTypes(data.jsonLd);
    signals.push(createSignal({
      type: 'structured-data',
      name: 'json-ld',
      confidence: 0.95,
      evidence: `${data.jsonLd.length} JSON-LD block(s): ${types.join(', ') || 'unknown types'}`,
      category: 'seo_content',
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
    signals.push(createSignal({
      type: 'branding',
      name: 'favicon',
      confidence: 0.9,
      evidence: `Favicon formats: ${data.favicon.formats.join(', ')}`,
      category: 'digital_presence',
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
      category: 'performance_ux',
    }));
  }

  // llms.txt signal
  if (data.llmsTxt.present) {
    signals.push(createSignal({
      type: 'ai-readiness',
      name: 'llms-txt',
      confidence: 0.9,
      evidence: 'llms.txt present',
      category: 'digital_presence',
    }));
  }

  // PWA manifest signal
  if (data.manifest.present) {
    signals.push(createSignal({
      type: 'pwa',
      name: 'web-app-manifest',
      confidence: 0.9,
      evidence: 'manifest.json present',
      category: 'digital_presence',
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
  const jsonLd = extractJsonLd($);
  const favicon = extractFavicons($);
  const htmlLang = extractHtmlLang($);
  const hreflang = extractHreflang($);
  const preconnectHints = extractPreconnectHints($);
  const metaTags = extractMetaTags($);

  // Fetch remote resources in parallel (all non-fatal)
  const [robotsTxt, sitemap, llmsTxt, manifest] = await Promise.all([
    fetchRobotsTxt(ctx.url),
    fetchSitemap(ctx.url),
    fetchLlmsTxt(ctx.url),
    fetchManifest(ctx.url),
  ]);

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
  };

  // Build all 15 checkpoints
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
  ];

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

registerModuleExecutor('M04' as ModuleId, execute);
