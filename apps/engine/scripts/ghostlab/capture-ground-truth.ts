/**
 * Ghostlab — Automated Ground Truth Capture
 *
 * Uses Patchright (browser) + DNS + HTTP to automatically extract verified
 * facts for each passive module from benchmark sites. Replaces manual
 * human-verified ground truth with browser-verified ground truth.
 *
 * Usage:
 *   cd apps/engine
 *   npx tsx --env-file=.env scripts/ghostlab/capture-ground-truth.ts --site=brainhi.com
 *   npx tsx --env-file=.env scripts/ghostlab/capture-ground-truth.ts --all
 *
 * This captures WHAT THE SITE ACTUALLY HAS — the module's job is to match it.
 */

import { chromium, type Browser, type Page } from 'patchright';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resolver } from 'node:dns/promises';
import { fetchWithRetry } from '../../src/utils/http.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../test/fixtures/ghostlab');

const KNOWN_SITES = ['senzary.com', 'ryder.com', 'investpr.org', 'mmm-pr.com', 'foundationforpuertorico.org'];

// ── Args ──────────────────────────────────────────────────────────────────────

function parseArgs(): string[] {
  const args = process.argv.slice(2);
  if (args.includes('--all')) return KNOWN_SITES;
  const site = args.find(a => a.startsWith('--site='))?.split('=')[1];
  if (!site) {
    console.error('Usage: npx tsx scripts/ghostlab/capture-ground-truth.ts --site=example.com');
    console.error('       npx tsx scripts/ghostlab/capture-ground-truth.ts --all');
    process.exit(1);
  }
  return [site];
}

// ── M01: DNS & Security ───────────────────────────────────────────────────────

async function verifyM01(domain: string): Promise<Record<string, unknown>> {
  console.log('  M01: DNS & Security...');
  const resolver = new Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']);

  const facts: Record<string, unknown> = {};

  // SPF
  try {
    const txt = await resolver.resolveTxt(domain);
    const spf = txt.flat().find(r => r.startsWith('v=spf1'));
    facts.spf = spf ? true : false;
    facts.spfRecord = spf ?? null;
  } catch { facts.spf = false; }

  // DMARC
  try {
    const dmarc = await resolver.resolveTxt(`_dmarc.${domain}`);
    const dmarcRecord = dmarc.flat().find(r => r.startsWith('v=DMARC1'));
    facts.dmarc = !!dmarcRecord;
    if (dmarcRecord) {
      const policyMatch = dmarcRecord.match(/p=(\w+)/);
      facts.dmarcPolicy = policyMatch?.[1] ?? null;
    }
  } catch { facts.dmarc = false; }

  // MX
  try {
    const mx = await resolver.resolveMx(domain);
    facts.hasMx = mx.length > 0;
    facts.mxCount = mx.length;
  } catch { facts.hasMx = false; }

  // Headers (via HTTP)
  try {
    const result = await fetchWithRetry(`https://www.${domain}`, { timeout: 10_000, retries: 1 });
    const h = result.headers;
    facts.hasHsts = !!h['strict-transport-security'];
    facts.hasCsp = !!h['content-security-policy'];
    facts.hasXfo = !!h['x-frame-options'];
    facts.hasXcto = !!h['x-content-type-options'];
    facts.hasReferrerPolicy = !!h['referrer-policy'];
    facts.hasPermissionsPolicy = !!h['permissions-policy'];
    facts.serverHeader = h['server'] ?? null;
  } catch {
    try {
      const result = await fetchWithRetry(`https://${domain}`, { timeout: 10_000, retries: 1 });
      const h = result.headers;
      facts.hasHsts = !!h['strict-transport-security'];
      facts.hasCsp = !!h['content-security-policy'];
      facts.serverHeader = h['server'] ?? null;
    } catch { /* skip */ }
  }

  return facts;
}

// ── M02: CMS & Infrastructure ─────────────────────────────────────────────────

async function verifyM02(page: Page, url: string): Promise<Record<string, unknown>> {
  console.log('  M02: CMS & Infrastructure...');
  const facts: Record<string, unknown> = {};

  const html = await page.content();
  const headers = await page.evaluate(() => {
    // Get response headers from performance API
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return entries[0]?.serverTiming?.map(t => t.name) ?? [];
  });

  // CMS detection from HTML
  facts.isWordPress = html.includes('wp-content') || html.includes('wp-includes');
  facts.hasGeneratorMeta = !!html.match(/<meta[^>]*name="generator"[^>]*content="([^"]+)"/i);
  const generatorMatch = html.match(/<meta[^>]*name="generator"[^>]*content="([^"]+)"/i);
  facts.generator = generatorMatch?.[1] ?? null;

  // CDN detection from response headers
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
  if (response) {
    const respHeaders = await response.allHeaders();
    facts.serverHeader = respHeaders['server'] ?? null;
    facts.hasCfRay = !!respHeaders['cf-ray'];
    facts.cdn = respHeaders['cf-ray'] ? 'Cloudflare'
      : respHeaders['x-amz-cf-id'] ? 'CloudFront'
      : respHeaders['x-sucuri-id'] ? 'Sucuri'
      : respHeaders['via']?.includes('varnish') ? 'Varnish'
      : null;
    facts.compression = respHeaders['content-encoding'] ?? null;
  }

  return facts;
}

// ── M04: Page Metadata ────────────────────────────────────────────────────────

async function verifyM04(page: Page, domain: string): Promise<Record<string, unknown>> {
  console.log('  M04: Page Metadata...');
  const facts: Record<string, unknown> = {};

  facts.title = await page.title();
  facts.metaDescription = await page.$eval('meta[name="description"]', el => el.getAttribute('content')).catch(() => null);
  facts.canonical = await page.$eval('link[rel="canonical"]', el => el.getAttribute('href')).catch(() => null);
  facts.htmlLang = await page.$eval('html', el => el.getAttribute('lang')).catch(() => null);
  facts.viewport = await page.$eval('meta[name="viewport"]', el => el.getAttribute('content')).catch(() => null);
  facts.charset = await page.$eval('meta[charset]', el => el.getAttribute('charset')).catch(() => null);

  // OG tags
  const ogTags = await page.$$eval('meta[property^="og:"]', els =>
    els.map(el => ({ property: el.getAttribute('property'), content: el.getAttribute('content')?.substring(0, 100) }))
  ).catch(() => []);
  facts.ogTagCount = ogTags.length;
  facts.hasOgImage = ogTags.some(t => t.property === 'og:image');

  // JSON-LD
  const jsonLdCount = await page.$$eval('script[type="application/ld+json"]', els => els.length).catch(() => 0);
  facts.jsonLdCount = jsonLdCount;

  // robots.txt
  try {
    const robots = await fetchWithRetry(`https://www.${domain}/robots.txt`, { timeout: 5000, retries: 0 });
    facts.hasRobotsTxt = robots.ok && !robots.body.trimStart().startsWith('<');
  } catch { facts.hasRobotsTxt = false; }

  // sitemap
  try {
    const sitemap = await fetchWithRetry(`https://www.${domain}/sitemap.xml`, { timeout: 5000, retries: 0 });
    facts.hasSitemap = sitemap.ok && sitemap.body.includes('<urlset');
  } catch { facts.hasSitemap = false; }

  return facts;
}

// ── M16: PR & Media ───────────────────────────────────────────────────────────

async function verifyM16(page: Page, browser: Browser, domain: string, baseUrl: string): Promise<Record<string, unknown>> {
  console.log('  M16: PR & Media...');
  const facts: Record<string, unknown> = {};

  // Find press/news page from navigation
  const pressLinks = await page.$$eval('a[href]', (els, domain) => {
    const keywords = /\b(news|press|newsroom|media|prensa|noticias|medios|centro.de.prensa|enterate)\b/i;
    return els
      .filter(el => {
        const href = el.getAttribute('href') ?? '';
        const text = el.textContent?.trim() ?? '';
        return (keywords.test(href) || keywords.test(text)) &&
          !href.includes('facebook') && !href.includes('twitter') && !href.includes('linkedin') &&
          !href.includes('instagram') && !href.includes('youtube');
      })
      .map(el => ({
        href: el.getAttribute('href') ?? '',
        text: el.textContent?.trim().substring(0, 80) ?? '',
      }));
  }, domain);

  facts.pressLinksFound = pressLinks.length;
  facts.pressLinks = pressLinks.slice(0, 5);

  // Navigate to the first press page and count articles
  let pressPageUrl: string | null = null;
  for (const link of pressLinks) {
    try {
      const href = link.href.startsWith('http') ? link.href : new URL(link.href, baseUrl).href;
      // Skip external domains that aren't press subdomains
      const linkHost = new URL(href).hostname;
      if (!linkHost.includes(domain.replace(/^www\./, '')) && !linkHost.match(/^(newsroom|press|news|media)\./)) continue;
      pressPageUrl = href;
      break;
    } catch { continue; }
  }

  if (pressPageUrl) {
    facts.pressPageUrl = pressPageUrl;

    // Open press page in new context to avoid polluting main page state
    const ctx = await browser.newContext();
    const pressPage = await ctx.newPage();

    try {
      await pressPage.goto(pressPageUrl, { waitUntil: 'networkidle', timeout: 20000 });
      await pressPage.waitForTimeout(2000); // let JS render

      // Count visible articles
      const articleCount = await pressPage.evaluate(() => {
        // Count by various strategies and return the best one
        const strategies: { name: string; count: number }[] = [];

        // Strategy 1: <article> elements
        strategies.push({ name: 'article', count: document.querySelectorAll('article').length });

        // Strategy 2: links that look like individual articles (same domain, slug-like paths)
        const baseHost = window.location.hostname;
        const articleLinks = new Set<string>();
        document.querySelectorAll('a[href]').forEach(a => {
          const href = a.getAttribute('href') ?? '';
          try {
            const u = new URL(href, window.location.origin);
            if (u.hostname === baseHost || u.hostname.endsWith(baseHost.replace(/^www\./, ''))) {
              const path = u.pathname;
              // Skip pagination, category, tag, and navigation links
              if (path.match(/\/(page|category|tag|author|feed|wp-|search)\//)) return;
              if (path === '/' || path === window.location.pathname) return;
              // Must be a content path (has slug-like segments)
              const segments = path.split('/').filter(Boolean);
              if (segments.length >= 2) {
                const lastSeg = segments[segments.length - 1]!;
                if (lastSeg.length > 8 && lastSeg.includes('-')) {
                  articleLinks.add(u.pathname);
                }
              }
            }
          } catch { /* skip */ }
        });
        strategies.push({ name: 'articleLinks', count: articleLinks.size });

        // Strategy 3: elements with dates nearby (press release pattern)
        const datePattern = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}\b/g;
        const bodyText = document.body.innerText;
        const dateMatches = bodyText.match(datePattern);
        strategies.push({ name: 'dates', count: dateMatches ? new Set(dateMatches).size : 0 });

        // Return the max, but cap article links at a reasonable count
        return {
          strategies,
          best: Math.max(...strategies.map(s => s.count)),
        };
      });

      facts.visibleArticleCount = articleCount.best;
      facts.countStrategies = articleCount.strategies;

      // Check for pagination
      const pagination = await pressPage.evaluate(() => {
        const html = document.body.innerHTML;
        const hasLoadMore = !!(
          document.querySelector('[class*="load-more"], [class*="loadmore"]') ||
          Array.from(document.querySelectorAll('button, a')).some(el => /load\s*more|ver\s*más|show\s*more/i.test(el.textContent ?? ''))
        );
        const pageLinks = html.match(/[?&](?:pg|page|paged)=(\d+)/g) ?? [];
        const wpPages = html.match(/\/page\/(\d+)/g) ?? [];
        const maxPage = Math.max(
          0,
          ...pageLinks.map(p => parseInt(p.replace(/.*=/, ''), 10)),
          ...wpPages.map(p => parseInt(p.replace(/\/page\//, ''), 10)),
        );
        return { hasLoadMore, hasPagination: maxPage >= 2, maxPage, pageLinksCount: pageLinks.length, wpPagesCount: wpPages.length };
      });

      facts.pagination = pagination;

      // If paginated, crawl all pages and count unique articles
      if (pagination.hasPagination && pagination.maxPage >= 2) {
        const allArticleUrls = new Set<string>();

        // Page 1 articles
        const p1Articles = await pressPage.$$eval('a[href]', (els) => {
          return els.map(el => el.getAttribute('href') ?? '').filter(h => h.includes('/') && h.length > 10);
        });
        p1Articles.forEach(a => allArticleUrls.add(a));

        // Crawl remaining pages
        for (let p = 2; p <= Math.min(pagination.maxPage + 2, 50); p++) {
          try {
            const url = new URL(pressPageUrl!);
            // Detect query param style from page 1 links
            const qsMatch = await pressPage.evaluate(() => document.body.innerHTML.match(/[?&](pg|page|paged)=\d+/)?.[1]);
            const perPageMatch = await pressPage.evaluate(() => document.body.innerHTML.match(/[?&](per-page|per_page|pagesize)=(\d+)/));
            const param = qsMatch ?? 'page';
            url.searchParams.set(param, String(p));
            if (perPageMatch) url.searchParams.set(perPageMatch[1], perPageMatch[2]);

            await pressPage.goto(url.href, { waitUntil: 'networkidle', timeout: 10000 });
            const pageArticles = await pressPage.$$eval('a[href]', (els) => {
              return els.map(el => el.getAttribute('href') ?? '').filter(h => h.includes('/') && h.length > 10);
            });

            const prevSize = allArticleUrls.size;
            pageArticles.forEach(a => allArticleUrls.add(a));
            if (allArticleUrls.size === prevSize) break;
          } catch { break; }
        }

        facts.paginatedArticleCount = allArticleUrls.size;
      }

      // Check for external newsroom subdomain
      const externalNewsroom = await pressPage.evaluate((domain) => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        for (const a of links) {
          const href = a.getAttribute('href') ?? '';
          if (/^https?:\/\/(newsroom|press|news|media)\./i.test(href) && href.includes(domain)) {
            return href;
          }
        }
        return null;
      }, domain.replace(/^www\./, ''));

      facts.externalNewsroom = externalNewsroom;

      // Check for RSS feed
      const rss = await pressPage.$eval('link[type="application/rss+xml"]', el => el.getAttribute('href')).catch(() => null);
      facts.rssFeed = rss;

      // Check for media contact
      const mediaContact = await pressPage.evaluate(() => {
        const text = document.body.innerText;
        const emailMatch = text.match(/(?:press|media|pr|communications|comms|digital)@[a-z0-9.-]+\.[a-z]{2,}/i);
        return emailMatch?.[0] ?? null;
      });
      facts.mediaContactEmail = mediaContact;

      // Check for media logos / "as seen in"
      const hasMediaLogos = await pressPage.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('as seen in') || text.includes('featured in') || text.includes('seen on') ||
          text.includes('como se ha visto') || text.includes('mencionado en');
      });
      facts.hasMediaLogos = hasMediaLogos;

    } catch (err) {
      facts.pressPageError = (err as Error).message;
    } finally {
      await ctx.close();
    }
  } else {
    facts.pressPageUrl = null;
    facts.visibleArticleCount = 0;
  }

  // WordPress: check WP API for category-specific counts
  const isWP = await page.evaluate(() =>
    document.documentElement.innerHTML.includes('wp-content') || document.documentElement.innerHTML.includes('wp-includes')
  );

  if (isWP) {
    facts.isWordPress = true;
    try {
      const origin = new URL(baseUrl).origin;
      const catsResult = await fetchWithRetry(`${origin}/wp-json/wp/v2/categories?per_page=50`, { timeout: 8000, retries: 0 });
      if (catsResult.ok) {
        const categories = JSON.parse(catsResult.body) as Array<{ id: number; slug: string; count: number; name: string }>;
        const pressCategory = categories.find(c =>
          /^(media|press|news|newsroom|prensa|noticias|medios|comunicados|latest)$/i.test(c.slug)
        );
        if (pressCategory) {
          facts.wpPressCategoryId = pressCategory.id;
          facts.wpPressCategorySlug = pressCategory.slug;
          facts.wpPressCategoryCount = pressCategory.count;

          // Verify via X-WP-Total
          const wpResult = await fetchWithRetry(
            `${origin}/wp-json/wp/v2/posts?per_page=1&categories=${pressCategory.id}`,
            { timeout: 8000, retries: 0 },
          );
          if (wpResult.ok) {
            const wpTotal = parseInt(wpResult.headers['x-wp-total'] ?? '0', 10);
            facts.wpVerifiedCount = wpTotal;
          }
        }
      }
    } catch { /* WP API not available */ }
  }

  return facts;
}

// ── M17: Careers & HR ─────────────────────────────────────────────────────────

async function verifyM17(page: Page, browser: Browser, domain: string): Promise<Record<string, unknown>> {
  console.log('  M17: Careers & HR...');
  const facts: Record<string, unknown> = {};

  const careersLinks = await page.$$eval('a[href]', (els) => {
    const keywords = /\b(careers?|jobs?|hiring|join.us|empleo|carrera|trabaja|unete|empleos)\b/i;
    return els
      .filter(el => {
        const href = el.getAttribute('href') ?? '';
        const text = el.textContent?.trim() ?? '';
        return (keywords.test(href) || keywords.test(text)) &&
          !href.includes('facebook') && !href.includes('linkedin');
      })
      .map(el => ({ href: el.getAttribute('href') ?? '', text: el.textContent?.trim().substring(0, 60) ?? '' }))
      .slice(0, 5);
  });

  facts.careersLinksFound = careersLinks.length;
  facts.careersLinks = careersLinks;
  facts.hasCareersPage = careersLinks.length > 0;

  return facts;
}

// ── M18: Investor Relations ───────────────────────────────────────────────────

async function verifyM18(page: Page, domain: string): Promise<Record<string, unknown>> {
  console.log('  M18: Investor Relations...');
  const facts: Record<string, unknown> = {};

  const irLinks = await page.$$eval('a[href]', (els) => {
    const keywords = /\b(investor|shareholder|ir\b|inversionista|accionista)\b/i;
    return els
      .filter(el => {
        const href = el.getAttribute('href') ?? '';
        const text = el.textContent?.trim() ?? '';
        return keywords.test(href) || keywords.test(text);
      })
      .map(el => ({ href: el.getAttribute('href') ?? '', text: el.textContent?.trim().substring(0, 60) ?? '' }))
      .slice(0, 5);
  });

  facts.irLinksFound = irLinks.length;
  facts.hasIrPage = irLinks.length > 0;

  // Check for ticker symbol in page text
  const ticker = await page.evaluate(() => {
    const text = document.body.innerText;
    const match = text.match(/\b(NYSE|NASDAQ|TSX|LSE)\s*:\s*([A-Z]{1,5})\b/);
    return match ? { exchange: match[1], symbol: match[2] } : null;
  });
  facts.ticker = ticker;

  return facts;
}

// ── M19: Support & Success ────────────────────────────────────────────────────

async function verifyM19(page: Page, domain: string): Promise<Record<string, unknown>> {
  console.log('  M19: Support & Success...');
  const facts: Record<string, unknown> = {};

  const supportLinks = await page.$$eval('a[href]', (els) => {
    const keywords = /\b(support|help|faq|contact|soporte|ayuda|contacto|preguntas)\b/i;
    return els
      .filter(el => {
        const href = el.getAttribute('href') ?? '';
        const text = el.textContent?.trim() ?? '';
        return keywords.test(href) || keywords.test(text);
      })
      .map(el => ({ href: el.getAttribute('href') ?? '', text: el.textContent?.trim().substring(0, 60) ?? '' }))
      .slice(0, 5);
  });

  facts.supportLinksFound = supportLinks.length;
  facts.hasSupportPage = supportLinks.length > 0;

  // Check for phone number (tel: links)
  const phoneLinks = await page.$$eval('a[href^="tel:"]', els => els.length);
  facts.hasPhone = phoneLinks > 0;

  // Check for email
  const emailLinks = await page.$$eval('a[href^="mailto:"]', els =>
    els.map(el => el.getAttribute('href')?.replace('mailto:', '') ?? '').slice(0, 3)
  );
  facts.emails = emailLinks;

  return facts;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function captureGroundTruth(domain: string, browser: Browser): Promise<void> {
  const siteDir = resolve(FIXTURES_DIR, domain);
  mkdirSync(siteDir, { recursive: true });

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`GROUND TRUTH CAPTURE: ${domain}`);
  console.log(`${'═'.repeat(60)}`);

  // Determine base URL
  let baseUrl = `https://www.${domain}`;
  let mainPage: Page | null = null;

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6917.92 Safari/537.36',
  });

  try {
    mainPage = await ctx.newPage();

    // Try www first, fall back to bare domain
    try {
      await mainPage.goto(baseUrl, { waitUntil: 'networkidle', timeout: 20000 });
    } catch {
      baseUrl = `https://${domain}`;
      await mainPage.goto(baseUrl, { waitUntil: 'networkidle', timeout: 20000 });
    }

    // Wait for JS rendering
    await mainPage.waitForTimeout(2000);

    const finalUrl = mainPage.url();
    console.log(`  URL: ${finalUrl}`);

    // Capture facts for each module
    const groundTruth: Record<string, unknown> = {
      site: domain,
      capturedAt: new Date().toISOString(),
      capturedBy: 'capture-ground-truth.ts (browser-verified)',
      baseUrl: finalUrl,
      modules: {},
    };

    const modules = groundTruth.modules as Record<string, Record<string, unknown>>;

    // M01: DNS & Security (no browser needed)
    modules.M01 = await verifyM01(domain);

    // M02: CMS & Infrastructure
    modules.M02 = await verifyM02(mainPage, finalUrl);

    // M04: Page Metadata
    modules.M04 = await verifyM04(mainPage, domain);

    // M16: PR & Media (uses separate browser context)
    modules.M16 = await verifyM16(mainPage, browser, domain, baseUrl);

    // M17: Careers & HR
    modules.M17 = await verifyM17(mainPage, browser, domain);

    // M18: Investor Relations
    modules.M18 = await verifyM18(mainPage, domain);

    // M19: Support & Success
    modules.M19 = await verifyM19(mainPage, domain);

    // Write ground truth
    const outPath = resolve(siteDir, 'browser-ground-truth.json');
    writeFileSync(outPath, JSON.stringify(groundTruth, null, 2));
    console.log(`\n  ✓ Saved: ${outPath}`);

    // Print summary
    console.log('\n  Summary:');
    for (const [modId, facts] of Object.entries(modules)) {
      const factCount = Object.keys(facts as Record<string, unknown>).length;
      console.log(`    ${modId}: ${factCount} verified facts`);
    }

  } finally {
    await ctx.close();
  }
}

async function main() {
  const sites = parseArgs();

  const browser = await chromium.launch({
    headless: true,
    args: ['--headless=new', '--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  try {
    for (const site of sites) {
      await captureGroundTruth(site, browser);
    }
    console.log('\n✓ All ground truth captured');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
