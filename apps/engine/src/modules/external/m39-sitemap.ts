/**
 * M39 - Sitemap & Indexing
 *
 * Checks robots.txt for sitemap directives, fetches and validates sitemap XML,
 * categorizes URLs by content type (blog, product, landing page, etc.),
 * detects locale structure, and measures content freshness from lastmod dates.
 *
 * Runs in passive phase (HTTP only, no browser, no DataForSEO, $0 cost).
 *
 * Checkpoints:
 *   1. Robots.txt presence + sitemap directive
 *   2. Sitemap validity (well-formed XML with URLs)
 *   3. Indexation coverage (URL count in sitemap)
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { fetchWithRetry } from '../../utils/http.js';

// ── URL categorization patterns ─────────────────────────────────────────────

const CATEGORY_PATTERNS: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'blog', patterns: [/\/blog\//i, /\/posts?\//i, /\/articles?\//i, /\/news\//i] },
  { category: 'product', patterns: [/\/products?\//i, /\/shop\//i, /\/collections?\//i, /\/catalog\//i, /\/items?\//i] },
  { category: 'pricing', patterns: [/\/pricing/i, /\/plans?\//i] },
  { category: 'case-studies', patterns: [/\/case.?stud/i, /\/customers?\//i, /\/success.?stor/i, /\/testimonials?\//i] },
  { category: 'resources', patterns: [/\/resources?\//i, /\/guides?\//i, /\/ebooks?\//i, /\/whitepapers?\//i, /\/webinars?\//i, /\/templates?\//i] },
  { category: 'landing-pages', patterns: [/\/lp\//i, /\/campaign/i, /\/landing/i, /\/offers?\//i] },
  { category: 'docs', patterns: [/\/docs?\//i, /\/documentation\//i, /\/help\//i, /\/support\//i, /\/knowledge/i, /\/faq/i] },
  { category: 'legal', patterns: [/\/legal\//i, /\/privacy/i, /\/terms/i, /\/tos\b/i, /\/gdpr/i, /\/cookie/i] },
  { category: 'careers', patterns: [/\/careers?\//i, /\/jobs?\//i, /\/hiring/i, /\/openings?\//i] },
  { category: 'about', patterns: [/\/about/i, /\/team\//i, /\/company\//i, /\/contact/i] },
];

const LOCALE_PATTERN = /^\/([a-z]{2}(?:-[a-z]{2})?)\//i;

function categorizeUrl(urlPath: string): string {
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some(p => p.test(urlPath))) return category;
  }
  return 'other';
}

function detectLocale(urlPath: string): string | null {
  const match = urlPath.match(LOCALE_PATTERN);
  return match?.[1]?.toLowerCase() ?? null;
}

// ── Sitemap parsing ─────────────────────────────────────────────────────────

interface SitemapEntry {
  loc: string;
  lastmod: string | null;
}

function extractSitemapUrls(robotsTxt: string): string[] {
  const urls: string[] = [];
  for (const line of robotsTxt.split('\n')) {
    const match = line.match(/^sitemap:\s*(.+)/i);
    if (match?.[1]) urls.push(match[1].trim());
  }
  return urls;
}

function parseSitemap(xml: string): {
  entries: SitemapEntry[];
  isSitemapIndex: boolean;
  childSitemaps: string[];
} {
  const isSitemapIndex = /<sitemapindex/i.test(xml);

  if (isSitemapIndex) {
    const childSitemaps: string[] = [];
    const locRegex = /<sitemap[^>]*>[\s\S]*?<loc>\s*(.*?)\s*<\/loc>/gi;
    let match;
    while ((match = locRegex.exec(xml)) !== null) {
      if (match[1]) childSitemaps.push(match[1]);
    }
    return { entries: [], isSitemapIndex: true, childSitemaps };
  }

  // Extract <url> entries with <loc> and optional <lastmod>
  const entries: SitemapEntry[] = [];
  const urlRegex = /<url>([\s\S]*?)<\/url>/gi;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(xml)) !== null && entries.length < 5000) {
    const block = urlMatch[1] ?? '';
    const locMatch = block.match(/<loc>\s*(.*?)\s*<\/loc>/i);
    const lastmodMatch = block.match(/<lastmod>\s*(.*?)\s*<\/lastmod>/i);
    if (locMatch?.[1]) {
      entries.push({
        loc: locMatch[1],
        lastmod: lastmodMatch?.[1] ?? null,
      });
    }
  }

  return { entries, isSitemapIndex: false, childSitemaps: [] };
}

// ── Module executor ─────────────────────────────────────────────────────────

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const baseUrl = new URL(ctx.url);
  const origin = baseUrl.origin;

  try {
    // Step 1: Fetch robots.txt
    let robotsTxt = '';
    let hasRobots = false;
    try {
      const robotsResponse = await fetchWithRetry(`${origin}/robots.txt`, { timeout: 10_000, retries: 1 });
      if (robotsResponse.ok && robotsResponse.body.length < 500_000) {
        robotsTxt = robotsResponse.body;
        hasRobots = true;
      }
    } catch {
      // robots.txt not available
    }

    const sitemapUrls = hasRobots ? extractSitemapUrls(robotsTxt) : [];

    if (sitemapUrls.length === 0) {
      sitemapUrls.push(`${origin}/sitemap.xml`);
      sitemapUrls.push(`${origin}/sitemap_index.xml`);
    }

    const directiveCount = extractSitemapUrls(robotsTxt).length;
    data.hasRobotsTxt = hasRobots;
    data.sitemapDirectives = directiveCount;

    // CP1: Robots.txt
    checkpoints.push(createCheckpoint({
      id: 'm39-robots', name: 'Robots.txt', weight: 0.2,
      health: hasRobots ? 'excellent' : 'warning',
      evidence: hasRobots
        ? `robots.txt found with ${directiveCount} sitemap directive(s)`
        : 'No robots.txt found — search engines may have trouble discovering sitemap',
    }));

    // Step 2: Fetch and parse sitemaps
    let allEntries: SitemapEntry[] = [];
    let validSitemaps = 0;
    let isSitemapIndex = false;
    let childSitemapCount = 0;
    const sitemapResults: Array<{ url: string; valid: boolean; urlCount: number; isIndex: boolean }> = [];

    for (const sitemapUrl of sitemapUrls.slice(0, 3)) {
      try {
        const response = await fetchWithRetry(sitemapUrl, { timeout: 10_000, retries: 1 });
        if (!response.ok || !response.body) {
          sitemapResults.push({ url: sitemapUrl, valid: false, urlCount: 0, isIndex: false });
          continue;
        }

        const isXml = response.body.includes('<?xml') || response.body.includes('<urlset') || response.body.includes('<sitemapindex');
        if (!isXml) {
          sitemapResults.push({ url: sitemapUrl, valid: false, urlCount: 0, isIndex: false });
          continue;
        }

        const parsed = parseSitemap(response.body);
        validSitemaps++;

        if (parsed.isSitemapIndex) {
          isSitemapIndex = true;
          childSitemapCount = parsed.childSitemaps.length;
        } else {
          allEntries = allEntries.concat(parsed.entries);
        }

        sitemapResults.push({
          url: sitemapUrl,
          valid: true,
          urlCount: parsed.entries.length,
          isIndex: parsed.isSitemapIndex,
        });
      } catch {
        sitemapResults.push({ url: sitemapUrl, valid: false, urlCount: 0, isIndex: false });
      }
    }

    const totalUrls = allEntries.length;
    data.sitemaps = sitemapResults;
    data.totalUrls = totalUrls;
    data.isSitemapIndex = isSitemapIndex;
    data.childSitemapCount = childSitemapCount;

    // Step 3: Categorize URLs by content type
    if (allEntries.length > 0) {
      const categoryCounts = new Map<string, { count: number; examples: string[] }>();
      const locales = new Set<string>();

      for (const entry of allEntries) {
        try {
          const urlPath = new URL(entry.loc).pathname;

          // Detect locale
          const locale = detectLocale(urlPath);
          if (locale) locales.add(locale);

          // Categorize
          const category = categorizeUrl(urlPath);
          const existing = categoryCounts.get(category);
          if (existing) {
            existing.count++;
            if (existing.examples.length < 3) existing.examples.push(urlPath);
          } else {
            categoryCounts.set(category, { count: 1, examples: [urlPath] });
          }
        } catch {
          // Invalid URL — skip
        }
      }

      data.urlCategories = [...categoryCounts.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([category, { count, examples }]) => ({
          category,
          count,
          pct: Math.round((count / totalUrls) * 1000) / 10,
          examples,
        }));

      data.locales = [...locales].sort();

      // Step 4: Content freshness from lastmod dates
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
      let mostRecent: Date | null = null;
      let updatedLast30 = 0;
      let updatedLast90 = 0;
      let hasLastmod = 0;

      for (const entry of allEntries) {
        if (!entry.lastmod) continue;
        const date = new Date(entry.lastmod);
        if (isNaN(date.getTime())) continue;
        hasLastmod++;
        if (!mostRecent || date > mostRecent) mostRecent = date;
        if (date.getTime() >= thirtyDaysAgo) updatedLast30++;
        if (date.getTime() >= ninetyDaysAgo) updatedLast90++;
      }

      if (hasLastmod > 0) {
        data.freshness = {
          lastModified: mostRecent?.toISOString().split('T')[0] ?? null,
          updatedLast30Days: updatedLast30,
          updatedLast90Days: updatedLast90,
          urlsWithLastmod: hasLastmod,
        };
      }
    }

    // CP2: Sitemap validity
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (validSitemaps > 0 && (totalUrls > 0 || isSitemapIndex)) {
        health = 'excellent';
        evidence = isSitemapIndex
          ? `Valid sitemap index with ${childSitemapCount} child sitemap(s)`
          : `Valid sitemap with ${totalUrls.toLocaleString()} URL(s)`;
      } else if (validSitemaps > 0) {
        health = 'good';
        evidence = 'Sitemap found but contains no URLs';
      } else {
        health = 'warning';
        evidence = 'No valid sitemap found — search engines cannot efficiently discover pages';
      }

      checkpoints.push(createCheckpoint({
        id: 'm39-sitemap', name: 'Sitemap Health', weight: 0.4, health, evidence,
      }));
    }

    // CP3: Indexation coverage
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (isSitemapIndex && childSitemapCount >= 5) {
        health = 'excellent';
        evidence = `Sitemap index with ${childSitemapCount} child sitemaps — comprehensive indexation strategy`;
      } else if (totalUrls >= 100) {
        health = 'excellent';
        evidence = `${totalUrls.toLocaleString()} URLs in sitemap — strong indexation coverage`;
      } else if (totalUrls >= 10 || (isSitemapIndex && childSitemapCount > 0)) {
        health = 'good';
        evidence = totalUrls > 0
          ? `${totalUrls} URLs in sitemap`
          : `Sitemap index with ${childSitemapCount} child sitemap(s)`;
      } else if (totalUrls > 0) {
        health = 'warning';
        evidence = `Only ${totalUrls} URL(s) in sitemap — may be missing pages`;
      } else if (validSitemaps === 0) {
        health = 'critical';
        evidence = 'No sitemap — pages rely solely on crawl discovery';
      } else {
        health = 'warning';
        evidence = 'Sitemap exists but contains no URL entries';
      }

      checkpoints.push(createCheckpoint({
        id: 'm39-coverage', name: 'Indexation Coverage', weight: 0.4, health, evidence,
      }));
    }

    if (validSitemaps > 0) {
      signals.push(createSignal({
        type: 'sitemap', name: 'Sitemap',
        confidence: 0.9,
        evidence: isSitemapIndex
          ? `Sitemap index with ${childSitemapCount} child sitemaps`
          : `${totalUrls} URLs in sitemap`,
        category: 'seo_content',
      }));
    }

    // Step 5: Check for llms.txt (AI discoverability)
    try {
      const llmsResponse = await fetchWithRetry(`${origin}/llms.txt`, { timeout: 5_000, retries: 0 });
      if (llmsResponse.ok && llmsResponse.body.length > 0 && llmsResponse.body.length < 500_000) {
        const llmsBody = llmsResponse.body;

        // Parse llms.txt structure
        const h1Match = llmsBody.match(/^#\s+(.+)/m);
        const h2Sections = llmsBody.match(/^##\s+.+/gm) ?? [];
        const linkedUrls = llmsBody.match(/\[.*?\]\(https?:\/\/.*?\)/g) ?? [];
        const hasBlockquote = /^>\s+.+/m.test(llmsBody);

        data.llmsTxt = {
          exists: true,
          title: h1Match?.[1]?.trim() ?? null,
          hasDescription: hasBlockquote,
          sections: h2Sections.length,
          linkedUrls: linkedUrls.length,
          sizeBytes: llmsBody.length,
        };

        signals.push(createSignal({
          type: 'llms_txt', name: 'AI Discoverability (llms.txt)',
          confidence: 0.95,
          evidence: `llms.txt found: "${h1Match?.[1]?.trim() ?? 'untitled'}", ${h2Sections.length} sections, ${linkedUrls.length} linked URLs`,
          category: 'seo_content',
        }));
      } else {
        data.llmsTxt = { exists: false };
      }
    } catch {
      data.llmsTxt = { exists: false };
    }
  } catch (error) {
    return { moduleId: 'M39' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M39' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M39' as ModuleId, execute);
