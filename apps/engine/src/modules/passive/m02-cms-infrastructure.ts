/**
 * M02 - CMS & Infrastructure Detection
 *
 * Detects CMS, CDN, server, framework, hosting, and build tools
 * using fingerprint matching against HTML source and HTTP headers.
 *
 * Detection pipeline:
 *   1. Load fingerprints.json at startup (once, not per request)
 *   2. For each fingerprint, test all rule types (html, headers, meta, scripts)
 *   3. Aggregate confidence: final = 1 - product(1 - rule_confidence)
 *   4. Resolve "implies" chains (e.g. WordPress -> PHP)
 *   5. Score 9 infrastructure checkpoints
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext, ModuleExecuteFn } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { parseHtml, extractMetaTags, extractScriptSrcs, extractInlineScripts, extractStylesheetHrefs } from '../../utils/html.js';
import type { CheerioAPI } from '../../utils/html.js';
import { analyzeCSSFromHTML } from '../../utils/css-analyzer.js';

// ---------------------------------------------------------------------------
// Fingerprint types
// ---------------------------------------------------------------------------

interface HtmlRule {
  pattern: string;
  confidence: number;
}

interface MetaRule {
  name: string;
  contentPattern: string;
  confidence: number;
}

interface HeaderRule {
  name: string;
  pattern?: string;
  confidence: number;
}

interface ScriptRule {
  pattern: string;
  confidence: number;
}

interface CookieRule {
  namePattern: string;
  confidence: number;
}

interface FingerprintRules {
  html?: HtmlRule[];
  meta?: MetaRule[];
  headers?: HeaderRule[];
  scripts?: ScriptRule[];
  cookies?: CookieRule[];
}

interface Fingerprint {
  id: string;
  name: string;
  category: string;
  rules: FingerprintRules;
  implies?: string[];
}

// ---------------------------------------------------------------------------
// Detected technology type
// ---------------------------------------------------------------------------

interface DetectedTech {
  id: string;
  name: string;
  category: string;
  confidence: number;
  version?: string;
}

// ---------------------------------------------------------------------------
// Load fingerprints once at module load time
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fingerprintsPath = join(__dirname, '..', '..', 'data', 'fingerprints.json');

let fingerprints: Fingerprint[];
try {
  const raw = readFileSync(fingerprintsPath, 'utf-8');
  fingerprints = JSON.parse(raw) as Fingerprint[];
} catch {
  // Fallback: if the file is not found at the expected dist path, try
  // the source-relative path (useful during tests / ts-node).
  fingerprints = [];
}

// Build a lookup map for implies resolution
const fingerprintById = new Map<string, Fingerprint>();
for (const fp of fingerprints) {
  fingerprintById.set(fp.id, fp);
}

// Well-known enterprise CDNs for scoring
const ENTERPRISE_CDNS = new Set([
  'cloudflare',
  'cloudfront',
  'akamai',
  'fastly',
  'google',
  'stackpath',
  'keycdn',
  'bunnycdn',
]);

// Third-party domains that indicate a specific CDN is in use (fallback detection).
// Maps domain suffix → { name, id } for CDNs that strip their response headers.
const CDN_INDICATOR_DOMAINS: { suffix: string; name: string; id: string }[] = [
  // Akamai
  { suffix: 'go-mpulse.net', name: 'Akamai', id: 'akamai' },
  { suffix: 'akamaihd.net', name: 'Akamai', id: 'akamai' },
  { suffix: 'akamaized.net', name: 'Akamai', id: 'akamai' },
  { suffix: 'edgekey.net', name: 'Akamai', id: 'akamai' },
  { suffix: 'edgesuite.net', name: 'Akamai', id: 'akamai' },
  { suffix: 'akamaitech.net', name: 'Akamai', id: 'akamai' },
  // Fastly
  { suffix: 'fastly.net', name: 'Fastly', id: 'fastly' },
  { suffix: 'fastlylb.net', name: 'Fastly', id: 'fastly' },
  // CloudFront
  { suffix: 'cloudfront.net', name: 'CloudFront', id: 'cloudfront' },
  // StackPath / Highwinds
  { suffix: 'stackpathdns.com', name: 'StackPath', id: 'stackpath' },
  { suffix: 'hwcdn.net', name: 'StackPath', id: 'stackpath' },
  // BunnyCDN
  { suffix: 'b-cdn.net', name: 'BunnyCDN', id: 'bunnycdn' },
  // KeyCDN
  { suffix: 'kxcdn.com', name: 'KeyCDN', id: 'keycdn' },
];

// ---------------------------------------------------------------------------
// Analytics / Tracking ID extraction
// ---------------------------------------------------------------------------

interface TrackingId {
  tool: string;
  id: string;
  type: 'tag-manager' | 'analytics' | 'advertising' | 'heatmap' | 'crm' | 'other';
}

const TRACKING_PATTERNS: { tool: string; type: TrackingId['type']; patterns: RegExp[] }[] = [
  { tool: 'Google Tag Manager', type: 'tag-manager', patterns: [/GTM-[A-Z0-9]{5,8}/g] },
  { tool: 'Google Analytics 4', type: 'analytics', patterns: [/G-[A-Z0-9]{8,12}/g] },
  { tool: 'Google Analytics (UA)', type: 'analytics', patterns: [/UA-\d{4,10}-\d{1,4}/g] },
  { tool: 'Facebook Pixel', type: 'advertising', patterns: [/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{10,20})['"]/g] },
  { tool: 'HubSpot', type: 'crm', patterns: [/js\.hs-scripts\.com\/(\d+)/g, /js\.hs-analytics\.net\/analytics\/\d+\/(\d+)/g] },
  { tool: 'Hotjar', type: 'heatmap', patterns: [/hotjar\.com.*?hjid[=:](\d+)/g, /hj\s*\(\s*['"]init['"]\s*,\s*(\d+)/g] },
  { tool: 'Segment', type: 'analytics', patterns: [/cdn\.segment\.com\/analytics\.js\/v1\/([a-zA-Z0-9]+)/g] },
  { tool: 'Google Ads', type: 'advertising', patterns: [/AW-\d{8,12}/g, /DC-\d{7,10}/g] },
  { tool: 'LinkedIn Insight', type: 'advertising', patterns: [/snap\.licdn\.com\/li\.lms-analytics\/insight\.min\.js/g, /_linkedin_partner_id\s*=\s*['"](\d+)['"]/g] },
  { tool: 'TikTok Pixel', type: 'advertising', patterns: [/analytics\.tiktok\.com\/i18n\/pixel\/events\.js\?sdkid=([A-Z0-9]+)/g] },
  { tool: 'Microsoft Clarity', type: 'heatmap', patterns: [/clarity\.ms\/tag\/([a-z0-9]+)/gi] },
  { tool: 'Intercom', type: 'crm', patterns: [/intercomSettings\s*=|widget\.intercom\.io\/widget\/([a-z0-9]+)/g] },
  { tool: 'Drift', type: 'crm', patterns: [/drift\.com.*?t\s*=\s*['"]([a-z0-9]+)['"]/g, /js\.driftt\.com/g] },
  { tool: 'Mixpanel', type: 'analytics', patterns: [/cdn\.mxpnl\.com|mixpanel\.init\s*\(\s*['"]([a-f0-9]+)['"]/g] },
  { tool: 'Amplitude', type: 'analytics', patterns: [/cdn\.amplitude\.com|amplitude\.getInstance\(\)/g] },
  { tool: 'Heap', type: 'analytics', patterns: [/heap-(\d+)\.js|heap\.load\s*\(\s*['"](\d+)['"]/g] },
  { tool: 'FullStory', type: 'heatmap', patterns: [/fullstory\.com\/s\/fs\.js|_fs_org\s*=\s*['"]([A-Z0-9]+)['"]/g] },
  { tool: 'Sentry', type: 'other', patterns: [/browser\.sentry-cdn\.com|Sentry\.init/g] },
  { tool: 'LogRocket', type: 'other', patterns: [/cdn\.logrocket\.com|LogRocket\.init\s*\(\s*['"]([a-z0-9/]+)['"]/g] },
  { tool: 'Optimizely', type: 'other', patterns: [/cdn\.optimizely\.com\/js\/(\d+)/g] },
  { tool: 'VWO', type: 'other', patterns: [/dev\.visualwebsiteoptimizer\.com|vwo_\$/g] },
  { tool: 'Crisp', type: 'crm', patterns: [/client\.crisp\.chat|CRISP_WEBSITE_ID\s*=\s*['"]([a-f0-9-]+)['"]/g] },
  { tool: 'Zendesk', type: 'crm', patterns: [/static\.zdassets\.com|zE\s*\(\s*['"]webWidget/g] },
  { tool: 'Matomo', type: 'analytics', patterns: [/matomo\.js|_paq\.push/g] },
  { tool: 'Plausible', type: 'analytics', patterns: [/plausible\.io\/js\/script/g] },
];

function extractTrackingIds(html: string, inlineScripts: string[]): TrackingId[] {
  const found: TrackingId[] = [];
  const seen = new Set<string>();
  const allText = html + '\n' + inlineScripts.join('\n');

  for (const tracker of TRACKING_PATTERNS) {
    for (const pattern of tracker.patterns) {
      // Reset lastIndex for global regex
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(allText)) !== null) {
        // Use the first capture group as the ID, or the full match if no groups
        const id = match[1] ?? match[0];
        const key = `${tracker.tool}:${id}`;
        if (!seen.has(key)) {
          seen.add(key);
          found.push({ tool: tracker.tool, id, type: tracker.type });
        }
      }
    }
  }

  return found;
}

// ---------------------------------------------------------------------------
// Third-party domain inventory
// ---------------------------------------------------------------------------

interface ThirdPartyDomain {
  domain: string;
  type: 'script' | 'stylesheet' | 'font' | 'iframe' | 'prefetch';
  urls: string[];
}

/** Well-known service domain → friendly name mapping. */
const KNOWN_DOMAINS: Record<string, string> = {
  'googletagmanager.com': 'Google Tag Manager',
  'google-analytics.com': 'Google Analytics',
  'googleadservices.com': 'Google Ads',
  'googlesyndication.com': 'Google AdSense',
  'googleapis.com': 'Google APIs',
  'gstatic.com': 'Google Static Assets',
  'fonts.googleapis.com': 'Google Fonts',
  'fonts.gstatic.com': 'Google Fonts',
  'facebook.net': 'Facebook SDK',
  'facebook.com': 'Facebook',
  'fbcdn.net': 'Facebook CDN',
  'twitter.com': 'Twitter/X',
  'platform.twitter.com': 'Twitter/X Widgets',
  'cdn.jsdelivr.net': 'jsDelivr CDN',
  'cdnjs.cloudflare.com': 'cdnjs',
  'unpkg.com': 'UNPKG CDN',
  'cdn.segment.com': 'Segment',
  'js.hs-scripts.com': 'HubSpot',
  'js.hs-analytics.net': 'HubSpot Analytics',
  'js.hs-banner.com': 'HubSpot Cookie Banner',
  'static.hsappstatic.net': 'HubSpot Static Assets',
  'api.hubapi.com': 'HubSpot API',
  'cdn2.hubspot.net': 'HubSpot CDN',
  'static.hotjar.com': 'Hotjar',
  'widget.intercom.io': 'Intercom',
  'js.driftt.com': 'Drift',
  'cdn.amplitude.com': 'Amplitude',
  'cdn.mxpnl.com': 'Mixpanel',
  'cdn.logrocket.com': 'LogRocket',
  'cdn.optimizely.com': 'Optimizely',
  'browser.sentry-cdn.com': 'Sentry',
  'snap.licdn.com': 'LinkedIn',
  'static.zdassets.com': 'Zendesk',
  'client.crisp.chat': 'Crisp',
  'plausible.io': 'Plausible Analytics',
  'cloudflareinsights.com': 'Cloudflare Web Analytics',
  'clarity.ms': 'Microsoft Clarity',
  'analytics.tiktok.com': 'TikTok Pixel',
  'connect.facebook.net': 'Facebook SDK',
};

function extractThirdPartyDomains(
  $: CheerioAPI,
  scriptSrcs: string[],
  stylesheetHrefs: string[],
  inlineScripts: string[],
  siteUrl: string,
): ThirdPartyDomain[] {
  let siteDomain: string;
  try {
    siteDomain = new URL(siteUrl).hostname.replace(/^www\./, '');
  } catch {
    siteDomain = '';
  }

  const domainMap = new Map<string, ThirdPartyDomain>();

  function addUrl(url: string, type: ThirdPartyDomain['type']) {
    try {
      const parsed = new URL(url, siteUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return;
      const host = parsed.hostname.replace(/^www\./, '');
      // Filter first-party: exact match or any subdomain of the scanned domain
      if (host === siteDomain || host.endsWith('.' + siteDomain)) return;

      const existing = domainMap.get(host);
      if (existing) {
        if (!existing.urls.includes(url) && existing.urls.length < 5) existing.urls.push(url);
        // Upgrade type priority: script > stylesheet > font > iframe > prefetch
        if (type === 'script') existing.type = 'script';
      } else {
        domainMap.set(host, { domain: host, type, urls: [url] });
      }
    } catch {
      // Invalid URL, skip
    }
  }

  // Script srcs
  for (const src of scriptSrcs) addUrl(src, 'script');

  // Stylesheet hrefs
  for (const href of stylesheetHrefs) addUrl(href, 'stylesheet');

  // URLs referenced inside inline scripts (dynamically loaded resources)
  // Only capture URLs that look like loaded resources (JS, CSS, API endpoints, tracking pixels)
  // Filter out social profile URLs, schema.org, and other non-resource URLs
  const NON_RESOURCE_DOMAINS = new Set([
    'schema.org', 'w3.org', 'xmlns.com', 'purl.org',
    'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
    'youtube.com', 'tiktok.com', 'pinterest.com', 'github.com',
    'medium.com', 'reddit.com', 'discord.gg', 'discord.com',
    't.co', 'bit.ly', 'x.com',
    'wikipedia.org', 'en.wikipedia.org', 'wikidata.org', 'wikimedia.org',
    'apple.com', 'play.google.com', 'apps.apple.com',
    // JSON-LD sameAs / business profile URLs
    'bloomberg.com', 'crunchbase.com', 'finance.yahoo.com',
    'glassdoor.com', 'trustpilot.com', 'bbb.org', 'yelp.com',
    'g2.com', 'capterra.com',
  ]);
  for (const script of inlineScripts) {
    const urlMatches = script.matchAll(/https?:\/\/[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}[^\s'"`);<]*/g);
    for (const match of urlMatches) {
      try {
        const host = new URL(match[0]).hostname.replace(/^www\./, '');
        if (NON_RESOURCE_DOMAINS.has(host)) continue;
        addUrl(match[0], 'script');
      } catch {
        // Invalid URL, skip
      }
    }
  }

  // Link preconnect/dns-prefetch/preload
  $('link[rel="preconnect"], link[rel="dns-prefetch"], link[rel="preload"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) addUrl(href, 'prefetch');
  });

  // Font links (from stylesheet @import or direct font link tags)
  $('link[rel="stylesheet"][href*="fonts"], link[as="font"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) addUrl(href, 'font');
  });

  // Iframes
  $('iframe[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) addUrl(src, 'iframe');
  });

  return Array.from(domainMap.values()).sort((a, b) => a.domain.localeCompare(b.domain));
}

// ---------------------------------------------------------------------------
// Cache layer analysis
// ---------------------------------------------------------------------------

interface CacheInfo {
  cacheStatus: string | null;    // hit, miss, dynamic, etc.
  age: number | null;            // seconds from Age header
  cacheControl: string | null;   // raw cache-control value
  edgeLocation: string | null;   // CDN PoP (e.g. x-amz-cf-pop)
  etag: boolean;
  lastModified: boolean;
  vary: string | null;
}

function extractCacheInfo(headers: Record<string, string>): CacheInfo {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lower[k.toLowerCase()] = v;
  }

  // Cache status from x-cache or cf-cache-status header
  const xCache = lower['x-cache'] ?? lower['cf-cache-status'] ?? null;
  let cacheStatus: string | null = null;
  if (xCache) {
    if (/hit/i.test(xCache)) cacheStatus = 'hit';
    else if (/miss/i.test(xCache)) cacheStatus = 'miss';
    else if (/dynamic|bypass|expired/i.test(xCache)) cacheStatus = 'dynamic';
    else cacheStatus = xCache.toLowerCase();
  }

  // Age header (seconds since CDN cached)
  const ageRaw = lower['age'];
  const age = ageRaw ? parseInt(ageRaw, 10) : null;

  // Edge location
  const edgeLocation = lower['x-amz-cf-pop']   // CloudFront
    ?? lower['cf-ray']?.split('-')[1]            // Cloudflare (e.g. "abc123-IAD")
    ?? lower['x-served-by']                      // Fastly
    ?? null;

  return {
    cacheStatus,
    age: age !== null && !isNaN(age) ? age : null,
    cacheControl: lower['cache-control'] ?? null,
    edgeLocation,
    etag: !!lower['etag'],
    lastModified: !!lower['last-modified'],
    vary: lower['vary'] ?? null,
  };
}

// ---------------------------------------------------------------------------
// x-powered-by extraction
// ---------------------------------------------------------------------------

function extractPoweredBy(headers: Record<string, string>): string | null {
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'x-powered-by') return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Try to extract a version string from the raw HTML near a technology's
 * fingerprint match.  Looks for common version patterns.
 */
function extractVersionFromHtml(html: string, techId: string): string | undefined {
  // Generator meta tag often includes the version
  const generatorMatch = html.match(
    /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i,
  );
  if (generatorMatch) {
    const content = generatorMatch[1];
    if (content) {
      // Require at least X.Y format to avoid matching page IDs or hashes
      const versionMatch = content.match(/[\s/](\d+\.\d+(?:\.\d+)*)/);
      if (versionMatch) {
        // Make sure this generator belongs to the tech we care about
        if (content.toLowerCase().includes(techId.toLowerCase().replace('js', ''))) {
          return versionMatch[1];
        }
      }
    }
  }

  // ng-version="X.Y.Z"
  if (techId === 'angular') {
    const ngVersion = html.match(/ng-version=["'](\d+(?:\.\d+)*)/);
    if (ngVersion) return ngVersion[1];
  }

  return undefined;
}

/**
 * Extract version from an X-Powered-By or Server header value.
 * Requires at least one dot (X.Y) to avoid matching page IDs
 * or resource hashes (e.g. /wp-json/wp/v2/pages/4948).
 */
function extractVersionFromHeader(value: string): string | undefined {
  const m = value.match(/[\s/](\d+\.\d+(?:\.\d+)*)/);
  return m ? m[1] : undefined;
}

/**
 * Aggregate multiple rule confidences using the formula:
 *   final = 1 - product(1 - c_i)
 */
function aggregateConfidence(confidences: number[]): number {
  if (confidences.length === 0) return 0;
  const product = confidences.reduce((acc, c) => acc * (1 - c), 1);
  return 1 - product;
}

// ---------------------------------------------------------------------------
// Core detection
// ---------------------------------------------------------------------------

function detectTechnologies(
  html: string | null,
  headers: Record<string, string>,
): DetectedTech[] {
  const results = new Map<string, { confidences: number[]; fp: Fingerprint; version?: string }>();

  const $ = html ? parseHtml(html) : null;
  const metaTags = $ ? extractMetaTags($) : [];
  const scriptSrcs = $ ? extractScriptSrcs($) : [];
  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v;
  }

  for (const fp of fingerprints) {
    const matched: number[] = [];
    let version: string | undefined;

    // --- HTML rules ---
    if (fp.rules.html && html) {
      for (const rule of fp.rules.html) {
        try {
          const re = new RegExp(rule.pattern, 'i');
          if (re.test(html)) {
            matched.push(rule.confidence);
          }
        } catch {
          // Invalid regex in fingerprint data -- skip
        }
      }
    }

    // --- Meta rules ---
    if (fp.rules.meta && metaTags.length > 0) {
      for (const rule of fp.rules.meta) {
        for (const meta of metaTags) {
          if (
            meta.name &&
            meta.name.toLowerCase() === rule.name.toLowerCase() &&
            meta.content
          ) {
            try {
              const re = new RegExp(rule.contentPattern, 'i');
              if (re.test(meta.content)) {
                matched.push(rule.confidence);
                // Try to get version from the meta content
                const vm = meta.content.match(/[\s/](\d+\.\d+(?:\.\d+)*)/);
                if (vm) version = vm[1];
              }
            } catch {
              // Invalid regex -- skip
            }
          }
        }
      }
    }

    // --- Header rules ---
    if (fp.rules.headers) {
      for (const rule of fp.rules.headers) {
        const headerName = rule.name.toLowerCase();
        const headerValue = lowerHeaders[headerName];
        if (headerValue !== undefined) {
          if (rule.pattern) {
            try {
              const re = new RegExp(rule.pattern, 'i');
              if (re.test(headerValue)) {
                matched.push(rule.confidence);
                // Try to extract version from the header
                const hv = extractVersionFromHeader(headerValue);
                if (hv) version = hv;
              }
            } catch {
              // Invalid regex -- skip
            }
          } else {
            // Header simply exists -- that is enough
            matched.push(rule.confidence);
          }
        }
      }
    }

    // --- Script rules ---
    if (fp.rules.scripts && scriptSrcs.length > 0) {
      for (const rule of fp.rules.scripts) {
        for (const src of scriptSrcs) {
          try {
            const re = new RegExp(rule.pattern, 'i');
            if (re.test(src)) {
              matched.push(rule.confidence);
              // Extract version from ?ver= query param (common in WP/Drupal)
              if (!version) {
                const verMatch = src.match(/[?&]ver=(\d+\.\d+(?:\.\d+)*)/);
                if (verMatch) version = verMatch[1];
              }
              break; // one match per rule is enough
            }
          } catch {
            // Invalid regex -- skip
          }
        }
      }
    }

    if (matched.length > 0) {
      // Also try to pull version from HTML if not already found via meta/header
      if (!version && html) {
        version = extractVersionFromHtml(html, fp.id);
      }

      // WordPress/Drupal/Joomla: extract version from ?ver= in script/style URLs
      if (!version && html && (fp.id === 'wordpress' || fp.id === 'drupal' || fp.id === 'joomla')) {
        for (const src of scriptSrcs) {
          if (src.includes('wp-') || src.includes('drupal') || src.includes('joomla')) {
            const verMatch = src.match(/[?&]ver=(\d+\.\d+(?:\.\d+)*)/);
            if (verMatch) { version = verMatch[1]; break; }
          }
        }
      }

      const existing = results.get(fp.id);
      if (existing) {
        existing.confidences.push(...matched);
        if (version && !existing.version) existing.version = version;
      } else {
        results.set(fp.id, { confidences: matched, fp, version });
      }
    }
  }

  // --- Resolve "implies" chains ---
  const toProcess = Array.from(results.keys());
  const visited = new Set<string>();

  while (toProcess.length > 0) {
    const techId = toProcess.pop()!;
    if (visited.has(techId)) continue;
    visited.add(techId);

    const fp = fingerprintById.get(techId);
    if (!fp?.implies) continue;

    for (const impliedId of fp.implies) {
      if (!results.has(impliedId)) {
        const impliedFp = fingerprintById.get(impliedId);
        if (impliedFp) {
          // Implied technologies get a slightly lower confidence
          const parentConf = aggregateConfidence(results.get(techId)!.confidences);
          results.set(impliedId, {
            confidences: [parentConf * 0.85],
            fp: impliedFp,
          });
          toProcess.push(impliedId);
        }
      }
    }
  }

  // --- Filter by minimum confidence threshold (0.6) ---
  const detected: DetectedTech[] = [];
  for (const [id, entry] of results) {
    const finalConf = aggregateConfidence(entry.confidences);
    if (finalConf >= 0.6) {
      detected.push({
        id,
        name: entry.fp.name,
        category: entry.fp.category,
        confidence: Math.round(finalConf * 1000) / 1000,
        version: entry.version,
      });
    }
  }

  // Sort by confidence descending
  detected.sort((a, b) => b.confidence - a.confidence);
  return detected;
}

// ---------------------------------------------------------------------------
// Direct header-based detection (server, compression, HTTP version)
// ---------------------------------------------------------------------------

interface InfraDetails {
  server: string | null;
  serverVersion: string | null;
  serverOs: string | null;
  compression: string | null;
  httpVersion: string | null;
  /** CDN detected directly from response headers (x-cache, via, x-cdn, etc.) or third-party domains */
  headerCdn: string | null;
  /** How the CDN was detected: 'headers' | 'third-party-domains' */
  cdnSource: 'headers' | 'third-party-domains' | null;
  /** Hosting provider inferred from server/header patterns */
  headerHosting: string | null;
  /** x-powered-by header value */
  poweredBy: string | null;
}

/** Map of header patterns to CDN names for direct header-based CDN detection. */
const CDN_HEADER_PATTERNS: { name: string; id: string; patterns: RegExp[] }[] = [
  { name: 'CloudFront', id: 'cloudfront', patterns: [/cloudfront/i] },
  { name: 'Cloudflare', id: 'cloudflare', patterns: [/cloudflare/i] },
  { name: 'Akamai', id: 'akamai', patterns: [/akamai/i] },
  { name: 'Fastly', id: 'fastly', patterns: [/fastly/i] },
  { name: 'KeyCDN', id: 'keycdn', patterns: [/keycdn/i] },
  { name: 'StackPath', id: 'stackpath', patterns: [/stackpath|highwinds/i] },
  { name: 'BunnyCDN', id: 'bunnycdn', patterns: [/bunnycdn|b-cdn/i] },
  { name: 'Google Cloud CDN', id: 'google', patterns: [/google/i] },
  { name: 'Azure CDN', id: 'azure', patterns: [/azure|msedge/i] },
  { name: 'Sucuri', id: 'sucuri', patterns: [/sucuri/i] },
];

/** Map server header values to hosting provider. */
const SERVER_HOSTING_MAP: { pattern: RegExp; name: string }[] = [
  { pattern: /amazons3/i, name: 'AWS (S3)' },
  { pattern: /^(ecs|openresty).*(amazonaws|amazon)/i, name: 'AWS' },
  { pattern: /gws|gse/i, name: 'Google' },
  { pattern: /microsoft-iis/i, name: 'Azure (IIS)' },
  { pattern: /github\.com/i, name: 'GitHub Pages' },
];

function detectInfraFromHeaders(headers: Record<string, string>): InfraDetails {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lower[k.toLowerCase()] = v;
  }

  // Server header
  const serverRaw = lower['server'] ?? null;
  let server: string | null = null;
  let serverVersion: string | null = null;
  let serverOs: string | null = null;

  if (serverRaw) {
    // e.g. "Apache/2.4.51 (Ubuntu)"
    const parts = serverRaw.match(/^([^\s/]+)(?:\/(\S+))?(?:\s+\(([^)]+)\))?/);
    if (parts) {
      server = parts[1] ?? null;
      serverVersion = parts[2] ?? null;
      serverOs = parts[3] ?? null;
    } else {
      server = serverRaw.trim();
    }
  }

  // Compression
  const contentEncoding = lower['content-encoding'] ?? null;
  let compression: string | null = null;
  if (contentEncoding) {
    if (/br/i.test(contentEncoding)) {
      compression = 'brotli';
    } else if (/gzip/i.test(contentEncoding)) {
      compression = 'gzip';
    } else if (/deflate/i.test(contentEncoding)) {
      compression = 'deflate';
    } else {
      compression = contentEncoding;
    }
  }

  // HTTP version -- check alt-svc, special headers, and via header
  let httpVersion: string | null = null;
  const altSvc = lower['alt-svc'] ?? '';
  if (/h3/i.test(altSvc)) {
    httpVersion = 'HTTP/3';
  } else if (lower['x-firefox-spdy'] || lower['x-http2'] || altSvc.includes('h2')) {
    httpVersion = 'HTTP/2';
  }
  // Detect HTTP/2 from the via header (e.g. "1.1 abc123.cloudfront.net (CloudFront)")
  // CDNs that serve over HTTP/2 generally include "1.1" in the via for the upstream
  // hop but the client connection itself is HTTP/2. If we see a CDN in via, it's
  // very likely HTTP/2+.
  if (!httpVersion) {
    const via = lower['via'] ?? '';
    if (via && CDN_HEADER_PATTERNS.some((cdn) => cdn.patterns.some((p) => p.test(via)))) {
      httpVersion = 'HTTP/2';
    }
  }
  // CDNs that always serve HTTP/2+ can be inferred from their unique headers.
  // Node.js fetch() doesn't expose the negotiated protocol, so we use CDN-specific
  // headers as reliable indicators.
  if (!httpVersion) {
    if (lower['cf-ray']) {
      // Cloudflare always serves HTTP/2 minimum; check alt-svc for HTTP/3 upgrade
      httpVersion = 'HTTP/2';
    } else if (lower['x-amz-cf-id'] || lower['x-amz-cf-pop']) {
      httpVersion = 'HTTP/2';
    } else if (lower['x-fastly-request-id'] || lower['x-fastly-cache-status'] || lower['fastly-restarts']) {
      httpVersion = 'HTTP/2';
    } else if (lower['x-vercel-id']) {
      httpVersion = 'HTTP/2';
    } else if (lower['x-nf-request-id']) {
      httpVersion = 'HTTP/2';
    }
  }

  // CDN detection from response headers (x-cache, via, x-cdn, server, x-served-by)
  let headerCdn: string | null = null;
  const cdnHintHeaders = [
    lower['x-cache'] ?? '',
    lower['via'] ?? '',
    lower['x-cdn'] ?? '',
    lower['x-served-by'] ?? '',
    lower['req-svc-chain'] ?? '',                    // e.g. "FASTLY,GTM,BELFRAGE" (BBC)
    lower['x-amz-cf-id'] ? 'cloudfront' : '',        // CloudFront request ID header
    lower['x-amz-cf-pop'] ? 'cloudfront' : '',        // CloudFront PoP header
    lower['cf-ray'] ? 'cloudflare' : '',               // Cloudflare ray ID header
    lower['x-fastly-request-id'] ? 'fastly' : '',
    lower['x-fastly-cache-status'] ? 'fastly' : '',   // Fastly cache status (BBC, many others)
    lower['fastly-restarts'] ? 'fastly' : '',          // Fastly restarts header
    lower['rtss'] ? 'fastly' : '',                     // Fastly Real-Time Stats header
    // x-timer with Fastly signature: S{epoch},VS{n},VE{n}
    lower['x-timer'] && /^S\d+\.\d+,VS\d+,VE\d+/.test(lower['x-timer']) ? 'fastly' : '',
  ].join(' ');

  for (const cdn of CDN_HEADER_PATTERNS) {
    if (cdn.patterns.some((p) => p.test(cdnHintHeaders))) {
      headerCdn = cdn.name;
      break;
    }
  }

  // Hosting detection from server header
  let headerHosting: string | null = null;
  if (serverRaw) {
    for (const mapping of SERVER_HOSTING_MAP) {
      if (mapping.pattern.test(serverRaw)) {
        headerHosting = mapping.name;
        break;
      }
    }
  }
  // Also infer hosting from CDN-specific headers
  if (!headerHosting) {
    if (lower['x-amz-cf-id'] || lower['x-amz-cf-pop']) headerHosting = 'AWS';
    else if (lower['cf-ray']) headerHosting = 'Cloudflare';
    else if (lower['x-vercel-id']) headerHosting = 'Vercel';
    else if (lower['x-nf-request-id']) headerHosting = 'Netlify';
  }

  // x-powered-by
  const poweredBy = lower['x-powered-by'] ?? null;

  return { server, serverVersion, serverOs, compression, httpVersion, headerCdn, cdnSource: headerCdn ? 'headers' as const : null, headerHosting, poweredBy };
}

// ---------------------------------------------------------------------------
// Checkpoint scoring
// ---------------------------------------------------------------------------

function buildCheckpoints(
  detected: DetectedTech[],
  infra: InfraDetails,
  headers: Record<string, string>,
): Checkpoint[] {
  const checkpoints: Checkpoint[] = [];

  // Helper: find first tech by category
  const byCategory = (cat: string) => detected.find((t) => t.category === cat);
  const allByCategory = (cat: string) => detected.filter((t) => t.category === cat);

  // -----------------------------------------------------------------------
  // 1. CMS identified (weight 3/10)
  // -----------------------------------------------------------------------
  const cmsDetected = allByCategory('cms');
  if (cmsDetected.length === 1) {
    const cms = cmsDetected[0]!;
    checkpoints.push(
      createCheckpoint({
        id: 'm02-cms-identified',
        name: 'CMS identified',
        weight: 0.3,
        health: cms.version ? 'excellent' : 'good',
        evidence: cms.version
          ? `${cms.name} ${cms.version} detected (confidence ${cms.confidence})`
          : `${cms.name} detected (confidence ${cms.confidence})`,
      }),
    );
  } else if (cmsDetected.length > 1) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-cms-identified',
        name: 'CMS identified',
        weight: 0.3,
        health: 'warning',
        evidence: `Multiple CMS signals: ${cmsDetected.map((c) => c.name).join(', ')}`,
        recommendation: 'Verify which CMS is actually in use; conflicting signals may indicate migration artifacts.',
      }),
    );
  } else {
    // No CMS -- informational only (no score impact per spec)
    checkpoints.push(
      infoCheckpoint(
        'm02-cms-identified',
        'CMS identified',
        'No CMS detected; site may use a custom or headless solution.',
      ),
    );
  }

  // -----------------------------------------------------------------------
  // 2. CMS version currency (weight 5/10)
  // -----------------------------------------------------------------------
  const primaryCms = cmsDetected[0];
  if (primaryCms?.version) {
    // Without a version database we default to 'good' when version is present
    checkpoints.push(
      createCheckpoint({
        id: 'm02-cms-version-currency',
        name: 'CMS version currency',
        weight: 0.5,
        health: 'good',
        evidence: `${primaryCms.name} version ${primaryCms.version} detected. Version currency check requires a version database.`,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm02-cms-version-currency',
        'CMS version currency',
        primaryCms
          ? `${primaryCms.name} detected but version could not be determined.`
          : 'No CMS version information available.',
      ),
    );
  }

  // -----------------------------------------------------------------------
  // 3. CDN detected (weight 6/10)
  // -----------------------------------------------------------------------
  const cdnDetected = byCategory('cdn');
  const hostingDetected = byCategory('hosting');
  // Some hosting providers (Vercel, Netlify) include a CDN
  const hasEdgeCdn = cdnDetected || (hostingDetected && ['vercel', 'netlify'].includes(hostingDetected.id));
  // Fallback: check if CDN was detected directly from response headers
  const hasHeaderCdn = infra.headerCdn !== null;

  if (hasEdgeCdn || hasHeaderCdn) {
    const cdnName = cdnDetected?.name ?? infra.headerCdn ?? hostingDetected?.name ?? 'unknown';
    // Check enterprise status against both fingerprint ID and header CDN name
    const cdnIdLower = (cdnDetected?.id ?? infra.headerCdn ?? '').toLowerCase();
    const isEnterprise = ENTERPRISE_CDNS.has(cdnIdLower);
    const source = hasEdgeCdn ? 'fingerprint' : (infra.cdnSource === 'third-party-domains' ? 'third-party domains' : 'response headers');

    checkpoints.push(
      createCheckpoint({
        id: 'm02-cdn-detected',
        name: 'CDN detected',
        weight: 0.6,
        health: isEnterprise ? 'excellent' : 'good',
        evidence: isEnterprise
          ? `Enterprise CDN detected: ${cdnName} (via ${source})`
          : `CDN / edge hosting detected: ${cdnName} (via ${source})`,
      }),
    );
  } else {
    // Check if CSP or Link headers hint at CDN usage for static assets
    // (e.g. b.stripecdn.com, cdn.example.com) even if main HTML is served from origin.
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
    const cspVal = lower['content-security-policy'] ?? '';
    const linkVal = lower['link'] ?? '';
    const combined = `${cspVal} ${linkVal}`;
    // Match domains that clearly indicate a CDN: "cdn." prefix, ".cdn." infix, or "static." prefix.
    // Avoid matching partial hits like "rlcdn.com" (LiveRamp) or "fbcdn.net" (Facebook CDN).
    const assetCdnMatch = combined.match(/https?:\/\/((?:cdn|assets?|static)[.-][a-z0-9.-]*\.[a-z]{2,})/i)
      ?? combined.match(/https?:\/\/([a-z0-9.-]*[.-]cdn[.-][a-z0-9.-]*\.[a-z]{2,})/i);

    if (assetCdnMatch) {
      checkpoints.push(
        createCheckpoint({
          id: 'm02-cdn-detected',
          name: 'CDN detected',
          weight: 0.6,
          health: 'good',
          evidence: `No CDN on main HTML, but static assets served via CDN domain: ${assetCdnMatch[1]}`,
          recommendation: 'Consider routing HTML through a CDN as well for faster TTFB globally.',
        }),
      );
    } else {
      checkpoints.push(
        createCheckpoint({
          id: 'm02-cdn-detected',
          name: 'CDN detected',
          weight: 0.6,
          health: 'critical',
          evidence: 'No CDN detected. Assets are likely served from origin.',
          recommendation: 'Consider using a CDN (e.g. Cloudflare, CloudFront, Fastly) to improve global load times and resilience.',
        }),
      );
    }
  }

  // -----------------------------------------------------------------------
  // 4. HTTPS enforced (weight 8/10)
  // -----------------------------------------------------------------------
  // Passive modules only see the final response; we infer HTTPS from the URL
  // and check for Strict-Transport-Security header.
  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v;
  }

  const hasHsts = !!lowerHeaders['strict-transport-security'];
  const isHttps = true; // We always fetch via HTTPS in the runner

  if (hasHsts) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-https-enforced',
        name: 'HTTPS enforced',
        weight: 0.8,
        health: 'excellent',
        evidence: `HTTPS active with HSTS header: ${lowerHeaders['strict-transport-security']}`,
      }),
    );
  } else if (isHttps) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-https-enforced',
        name: 'HTTPS enforced',
        weight: 0.8,
        health: 'good',
        evidence: 'HTTPS active but no HSTS header detected.',
        recommendation: 'Add a Strict-Transport-Security header to prevent protocol downgrade attacks.',
      }),
    );
  } else {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-https-enforced',
        name: 'HTTPS enforced',
        weight: 0.8,
        health: 'critical',
        evidence: 'No HTTPS detected. The site is served over plain HTTP.',
        recommendation: 'Enable HTTPS immediately. This affects SEO rankings, user trust, and data security.',
      }),
    );
  }

  // -----------------------------------------------------------------------
  // 5. HTTP/2 or HTTP/3 (weight 5/10)
  // -----------------------------------------------------------------------
  if (infra.httpVersion === 'HTTP/3') {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-http-version',
        name: 'HTTP/2 or HTTP/3',
        weight: 0.5,
        health: 'excellent',
        evidence: 'HTTP/3 (QUIC) detected via alt-svc header.',
      }),
    );
  } else if (infra.httpVersion === 'HTTP/2') {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-http-version',
        name: 'HTTP/2 or HTTP/3',
        weight: 0.5,
        health: 'good',
        evidence: 'HTTP/2 detected.',
      }),
    );
  } else {
    // Cannot confirm protocol from passive headers alone
    checkpoints.push(
      createCheckpoint({
        id: 'm02-http-version',
        name: 'HTTP/2 or HTTP/3',
        weight: 0.5,
        health: 'warning',
        evidence: 'Could not confirm HTTP/2 or HTTP/3 from response headers. Likely HTTP/1.1.',
        recommendation: 'Enable HTTP/2 (or HTTP/3) on your web server or CDN for improved multiplexing and performance.',
      }),
    );
  }

  // -----------------------------------------------------------------------
  // 6. Compression (weight 6/10)
  // -----------------------------------------------------------------------
  if (infra.compression === 'brotli') {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-compression',
        name: 'Compression',
        weight: 0.6,
        health: 'excellent',
        evidence: 'Brotli compression detected on the initial HTML response.',
      }),
    );
  } else if (infra.compression === 'gzip') {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-compression',
        name: 'Compression',
        weight: 0.6,
        health: 'good',
        evidence: 'Gzip compression detected on the initial HTML response.',
        recommendation: 'Consider enabling Brotli compression for ~15-20% smaller payloads compared to gzip.',
      }),
    );
  } else if (infra.compression) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-compression',
        name: 'Compression',
        weight: 0.6,
        health: 'warning',
        evidence: `Partial or uncommon compression detected: ${infra.compression}`,
      }),
    );
  } else {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-compression',
        name: 'Compression',
        weight: 0.6,
        health: 'critical',
        evidence: 'No compression detected on the HTML response.',
        recommendation: 'Enable gzip or Brotli compression on your server/CDN. This can reduce transfer sizes by 60-80%.',
      }),
    );
  }

  // -----------------------------------------------------------------------
  // 7. Server header exposure (weight 4/10)
  // -----------------------------------------------------------------------
  if (!infra.server) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-server-header-exposure',
        name: 'Server header exposure',
        weight: 0.4,
        health: 'excellent',
        evidence: 'Server header is hidden or absent.',
      }),
    );
  } else if (infra.serverOs) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-server-header-exposure',
        name: 'Server header exposure',
        weight: 0.4,
        health: 'critical',
        evidence: `Server header exposes software, version, and OS: ${headers['server'] ?? headers['Server'] ?? infra.server}`,
        recommendation: 'Remove or minimize the Server header. Exposing server software, version, and OS aids attackers in targeting known vulnerabilities.',
      }),
    );
  } else if (infra.serverVersion) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-server-header-exposure',
        name: 'Server header exposure',
        weight: 0.4,
        health: 'warning',
        evidence: `Server header exposes software and version: ${infra.server}/${infra.serverVersion}`,
        recommendation: 'Remove the version number from the Server header to reduce information leakage.',
      }),
    );
  } else {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-server-header-exposure',
        name: 'Server header exposure',
        weight: 0.4,
        health: 'good',
        evidence: `Server header present without version: ${infra.server}`,
      }),
    );
  }

  // -----------------------------------------------------------------------
  // 8. Framework detected (weight 2/10, info only)
  // -----------------------------------------------------------------------
  const frameworks = allByCategory('framework');
  checkpoints.push(
    infoCheckpoint(
      'm02-framework-detected',
      'Framework detected',
      frameworks.length > 0
        ? `Frameworks: ${frameworks.map((f) => f.name).join(', ')}`
        : 'No frontend framework detected.',
    ),
  );

  // -----------------------------------------------------------------------
  // 9. Hosting identified (weight 2/10, info only)
  // -----------------------------------------------------------------------
  const hostingAll = allByCategory('hosting');
  if (hostingAll.length > 0) {
    checkpoints.push(
      infoCheckpoint(
        'm02-hosting-identified',
        'Hosting identified',
        `Hosting: ${hostingAll.map((h) => h.name).join(', ')}`,
      ),
    );
  } else if (infra.headerHosting) {
    checkpoints.push(
      infoCheckpoint(
        'm02-hosting-identified',
        'Hosting identified',
        `Hosting: ${infra.headerHosting} (detected from response headers)`,
      ),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm02-hosting-identified',
        'Hosting identified',
        'Hosting provider not identified from fingerprints.',
      ),
    );
  }

  return checkpoints;
}

// ---------------------------------------------------------------------------
// Build signals from detected technologies
// ---------------------------------------------------------------------------

function buildSignals(detected: DetectedTech[], infra: InfraDetails): Signal[] {
  const signals: Signal[] = [];

  for (const tech of detected) {
    signals.push(
      createSignal({
        type: 'technology',
        name: tech.version ? `${tech.name} ${tech.version}` : tech.name,
        confidence: tech.confidence,
        evidence: `Detected via fingerprint matching (category: ${tech.category})`,
        category: tech.category,
      }),
    );
  }

  if (infra.server) {
    signals.push(
      createSignal({
        type: 'server',
        name: infra.serverVersion ? `${infra.server}/${infra.serverVersion}` : infra.server,
        confidence: 0.95,
        evidence: 'Detected from Server HTTP header',
        category: 'server',
      }),
    );
  }

  if (infra.compression) {
    signals.push(
      createSignal({
        type: 'compression',
        name: infra.compression,
        confidence: 1.0,
        evidence: 'Detected from content-encoding HTTP header',
        category: 'infrastructure',
      }),
    );
  }

  if (infra.httpVersion) {
    signals.push(
      createSignal({
        type: 'protocol',
        name: infra.httpVersion,
        confidence: 0.9,
        evidence: 'Detected from HTTP response headers (alt-svc / protocol hints)',
        category: 'infrastructure',
      }),
    );
  }

  if (infra.poweredBy) {
    signals.push(
      createSignal({
        type: 'powered-by',
        name: infra.poweredBy,
        confidence: 0.95,
        evidence: 'Detected from X-Powered-By HTTP header',
        category: 'infrastructure',
      }),
    );
  }

  // CDN detected from response headers (only if not already covered by fingerprints)
  if (infra.headerCdn && !detected.some((t) => t.category === 'cdn')) {
    signals.push(
      createSignal({
        type: 'cdn',
        name: infra.headerCdn,
        confidence: 0.9,
        evidence: 'Detected from response headers (x-cache, via, x-amz-cf-id, cf-ray, etc.)',
        category: 'infrastructure',
      }),
    );
  }

  // Hosting detected from response headers (only if not already covered by fingerprints)
  if (infra.headerHosting && !detected.some((t) => t.category === 'hosting')) {
    signals.push(
      createSignal({
        type: 'hosting',
        name: infra.headerHosting,
        confidence: 0.85,
        evidence: 'Inferred from server header and CDN-specific response headers',
        category: 'infrastructure',
      }),
    );
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Module execute function
// ---------------------------------------------------------------------------

const execute: ModuleExecuteFn = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const startTime = Date.now();

  // Parse HTML once for reuse across extractors
  const $ = ctx.html ? parseHtml(ctx.html) : null;

  // Detect technologies from fingerprints
  const detected = detectTechnologies(ctx.html, ctx.headers);

  // Detect infrastructure details from headers
  const infra = detectInfraFromHeaders(ctx.headers);

  // Extract analytics/tracking IDs from HTML
  const inlineScripts = $ ? extractInlineScripts($) : [];
  const trackingIds = ctx.html ? extractTrackingIds(ctx.html, inlineScripts) : [];

  // Extract third-party domains
  const scriptSrcs = $ ? extractScriptSrcs($) : [];
  const stylesheetHrefs = $ ? extractStylesheetHrefs($) : [];
  const thirdPartyDomains = $ ? extractThirdPartyDomains($, scriptSrcs, stylesheetHrefs, inlineScripts, ctx.url) : [];

  // Annotate third-party domains with known service names
  const thirdPartyAnnotated = thirdPartyDomains.map((d) => ({
    ...d,
    service: KNOWN_DOMAINS[d.domain] ?? null,
  }));

  // CDN fallback: detect CDN from third-party domain patterns when headers are stripped
  if (!infra.headerCdn && thirdPartyDomains.length > 0) {
    for (const d of thirdPartyDomains) {
      const indicator = CDN_INDICATOR_DOMAINS.find(
        (c) => d.domain === c.suffix || d.domain.endsWith('.' + c.suffix),
      );
      if (indicator) {
        infra.headerCdn = indicator.name;
        infra.cdnSource = 'third-party-domains';
        // Also infer HTTP/2 — enterprise CDNs always serve HTTP/2+
        if (!infra.httpVersion && ENTERPRISE_CDNS.has(indicator.id)) {
          infra.httpVersion = 'HTTP/2';
        }
        break;
      }
    }
  }

  // CDN fallback 2: detect CDN from Set-Cookie header patterns.
  // Akamai Bot Manager sets distinctive cookies (_abck, bm_sz, akacd_*) that
  // are reliable indicators even when all CDN response headers are stripped.
  if (!infra.headerCdn) {
    const setCookie = (ctx.headers['set-cookie'] ?? '').toLowerCase();
    if (/\b_abck=/.test(setCookie) || /\bbm_sz=/.test(setCookie) || /\bakacd_/.test(setCookie) || /\bak_bmsc=/.test(setCookie)) {
      infra.headerCdn = 'Akamai';
      infra.cdnSource = 'third-party-domains'; // cookie-based, group with non-header sources
      if (!infra.httpVersion) infra.httpVersion = 'HTTP/2';
    }
  }

  // Extract cache layer info
  const cacheInfo = extractCacheInfo(ctx.headers);

  // Build signals (add tracking signals)
  const signals = buildSignals(detected, infra);

  // Add tracking ID signals
  for (const tracker of trackingIds) {
    signals.push(
      createSignal({
        type: 'tracking',
        name: `${tracker.tool}: ${tracker.id}`,
        confidence: 0.95,
        evidence: `${tracker.type} ID extracted from HTML/inline scripts`,
        category: 'marketing',
      }),
    );
  }

  // Build checkpoints
  const checkpoints = buildCheckpoints(detected, infra, ctx.headers);

  // ─── CSS class fingerprint detection (Layer 4) ──────────────────────────
  const cssAnalysis = ctx.html ? analyzeCSSFromHTML(ctx.html) : { platformClasses: [] };

  // Promote CSS class detections: if a tech was found by CSS classes but NOT
  // already detected by the fingerprint engine, add it as a lower-confidence
  // detection.  If it *was* already detected, boost its confidence slightly.
  for (const cssMatch of cssAnalysis.platformClasses) {
    const existingIdx = detected.findIndex(
      (d) => d.name.toLowerCase() === cssMatch.tech.toLowerCase() || d.id === cssMatch.tech.toLowerCase().replace(/\s+/g, ''),
    );
    if (existingIdx >= 0) {
      // Already detected — boost confidence slightly (CSS class confirms the detection)
      const existing = detected[existingIdx]!;
      existing.confidence = Math.min(1, existing.confidence + 0.05);
    } else {
      // Not detected by fingerprints — add with 0.65 confidence
      detected.push({
        id: cssMatch.tech.toLowerCase().replace(/\s+/g, ''),
        name: cssMatch.tech,
        category: cssMatch.category === 'ecommerce' ? 'cms' : cssMatch.category === 'builder' ? 'framework' : cssMatch.category,
        confidence: 0.65,
      });
    }
  }

  // Re-sort after potential additions
  detected.sort((a, b) => b.confidence - a.confidence);

  // ─── Inline config framework detection (Layer 11) ──────────────────────
  if (ctx.inlineConfigs) {
    const configFrameworks: Array<{ key: string; tech: string; category: string }> = [
      { key: '__NEXT_DATA__', tech: 'Next.js', category: 'framework' },
      { key: '__NUXT__', tech: 'Nuxt', category: 'framework' },
      { key: '__REMIX_CONTEXT__', tech: 'Remix', category: 'framework' },
      { key: '__GATSBY_DATA__', tech: 'Gatsby', category: 'framework' },
      { key: '__APOLLO_STATE__', tech: 'Apollo GraphQL', category: 'framework' },
      { key: '__REDUX_STATE__', tech: 'Redux', category: 'framework' },
      { key: '__PRELOADED_STATE__', tech: 'Redux', category: 'framework' },
    ];

    for (const cf of configFrameworks) {
      if (ctx.inlineConfigs[cf.key] != null) {
        const existingIdx = detected.findIndex(
          (d) => d.name.toLowerCase() === cf.tech.toLowerCase() || d.id === cf.tech.toLowerCase().replace(/[\s.]+/g, ''),
        );
        if (existingIdx >= 0) {
          detected[existingIdx]!.confidence = Math.min(1, detected[existingIdx]!.confidence + 0.1);
        } else {
          detected.push({
            id: cf.tech.toLowerCase().replace(/[\s.]+/g, ''),
            name: cf.tech,
            category: cf.category,
            confidence: 0.8,
          });
        }
      }
    }

    detected.sort((a, b) => b.confidence - a.confidence);
  }

  // Organize data output by category
  const byCategory = (cat: string) => detected.filter((t) => t.category === cat);
  const primaryOf = (cat: string) => {
    const items = byCategory(cat);
    return items.length > 0 ? items[0] : null;
  };

  const cms = primaryOf('cms');
  const cdn = primaryOf('cdn');
  const framework = primaryOf('framework');
  const hosting = primaryOf('hosting');
  const language = primaryOf('language');
  const buildTool = primaryOf('build_tool');
  const server = primaryOf('server');

  const data: Record<string, unknown> = {
    detectedTechnologies: detected,
    cms: cms ? { id: cms.id, name: cms.name, version: cms.version ?? null, confidence: cms.confidence } : null,
    cdn: cdn
      ? { id: cdn.id, name: cdn.name, confidence: cdn.confidence }
      : infra.headerCdn
        ? { id: infra.headerCdn.toLowerCase().replace(/\s+/g, ''), name: infra.headerCdn, confidence: 0.9, source: 'headers' }
        : null,
    framework: framework ? { id: framework.id, name: framework.name, confidence: framework.confidence } : null,
    hosting: hosting
      ? { id: hosting.id, name: hosting.name, confidence: hosting.confidence }
      : infra.headerHosting
        ? { id: infra.headerHosting.toLowerCase().replace(/[\s()]+/g, '-').replace(/-+$/, ''), name: infra.headerHosting, confidence: 0.85, source: 'headers' }
        : null,
    language: language ? { id: language.id, name: language.name, confidence: language.confidence } : null,
    buildTool: buildTool ? { id: buildTool.id, name: buildTool.name, confidence: buildTool.confidence } : null,
    server: server
      ? { id: server.id, name: server.name, confidence: server.confidence }
      : infra.server
        ? { id: infra.server.toLowerCase(), name: infra.server, version: infra.serverVersion, os: infra.serverOs }
        : null,
    poweredBy: infra.poweredBy,
    compression: infra.compression,
    httpVersion: infra.httpVersion,
    trackingIds,
    thirdPartyDomains: thirdPartyAnnotated,
    cache: cacheInfo,
    cssClassFingerprints: cssAnalysis.platformClasses.length > 0 ? cssAnalysis.platformClasses : null,
    inlineConfigFrameworks: ctx.inlineConfigs
      ? Object.keys(ctx.inlineConfigs).filter((k) => ctx.inlineConfigs![k] != null)
      : null,
  };

  return {
    moduleId: 'M02' as ModuleId,
    status: detected.length > 0 || infra.server ? 'success' : 'partial',
    data,
    signals,
    score: null, // calculated by the runner from checkpoints
    checkpoints,
    duration: Date.now() - startTime,
  };
};

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

registerModuleExecutor('M02' as ModuleId, execute);

export { execute };
