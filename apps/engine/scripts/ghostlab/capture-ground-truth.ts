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
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resolver } from 'node:dns/promises';
import { fetchWithRetry } from '../../src/utils/http.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../test/fixtures/ghostlab');

// Auto-discover sites from fixtures directory
const KNOWN_SITES = readdirSync(FIXTURES_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

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

  // SPF — full record + qualifier analysis
  try {
    const txt = await resolver.resolveTxt(domain);
    const spf = txt.flat().find(r => r.startsWith('v=spf1'));
    facts.spf = !!spf;
    facts.spfRecord = spf ?? null;
    if (spf) {
      facts.spfAllQualifier = spf.match(/[-~?+]all/)?.[0] ?? null;
      facts.spfIncludes = (spf.match(/include:/g) || []).length;
    }
  } catch { facts.spf = false; }

  // DMARC — policy + reporting
  try {
    const dmarc = await resolver.resolveTxt(`_dmarc.${domain}`);
    const dmarcRecord = dmarc.flat().find(r => r.startsWith('v=DMARC1'));
    facts.dmarc = !!dmarcRecord;
    facts.dmarcRecord = dmarcRecord ?? null;
    if (dmarcRecord) {
      facts.dmarcPolicy = dmarcRecord.match(/;\s*p=(\w+)/)?.[1] ?? null;
      facts.dmarcRua = !!dmarcRecord.match(/rua=/);
      facts.dmarcRuf = !!dmarcRecord.match(/ruf=/);
    }
  } catch { facts.dmarc = false; }

  // DKIM — probe common selectors
  const dkimSelectors = ['google', 'selector1', 'selector2', 'default', 'dkim', 'k1', 's1'];
  const dkimFound: string[] = [];
  for (const sel of dkimSelectors) {
    try {
      const records = await resolver.resolveTxt(`${sel}._domainkey.${domain}`);
      const full = records.flat().join('');
      if (full.includes('v=DKIM1') || full.includes('p=')) {
        dkimFound.push(sel);
      }
    } catch { /* expected */ }
  }
  facts.dkim = dkimFound.length > 0;
  facts.dkimSelectors = dkimFound;

  // MX
  try {
    const mx = await resolver.resolveMx(domain);
    facts.hasMx = mx.length > 0;
    facts.mxCount = mx.length;
    if (mx.length > 0) {
      const topMx = mx.sort((a, b) => a.priority - b.priority)[0]!.exchange.toLowerCase();
      facts.emailProvider = topMx.includes('google') ? 'Google Workspace'
        : topMx.includes('outlook') || topMx.includes('microsoft') ? 'Microsoft 365'
        : topMx.includes('zoho') ? 'Zoho'
        : topMx.includes('protonmail') ? 'ProtonMail'
        : topMx.includes('pphosted') || topMx.includes('proofpoint') ? 'Proofpoint'
        : topMx.includes('mimecast') ? 'Mimecast'
        : topMx.includes('barracuda') ? 'Barracuda'
        : topMx.includes('postmarkapp') ? 'Postmark'
        : topMx.includes('sendgrid') ? 'SendGrid'
        : topMx.includes('mailgun') ? 'Mailgun'
        : topMx.includes('amazonaws') || topMx.includes('aws') ? 'AWS SES'
        : null; // null = let module decide, don't assert a specific value
    }
  } catch { facts.hasMx = false; }

  // NS
  try {
    const ns = await resolver.resolveNs(domain);
    facts.nsProvider = ns[0]?.toLowerCase().includes('cloudflare') ? 'Cloudflare'
      : ns[0]?.toLowerCase().includes('awsdns') ? 'AWS Route53'
      : ns[0]?.toLowerCase().includes('google') ? 'Google Cloud DNS'
      : ns[0]?.toLowerCase().includes('azure') ? 'Azure DNS'
      : ns[0] ?? null;
  } catch { facts.nsProvider = null; }

  // CAA
  try {
    const caa = await resolver.resolveCaa(domain);
    facts.hasCaa = caa.length > 0;
  } catch { facts.hasCaa = false; }

  // IPv6
  try {
    const aaaa = await resolver.resolve6(domain);
    facts.hasIpv6 = aaaa.length > 0;
  } catch { facts.hasIpv6 = false; }

  // HTTP Security Headers — full extraction
  let headers: Record<string, string> = {};
  try {
    const result = await fetchWithRetry(`https://www.${domain}`, { timeout: 10_000, retries: 1 });
    headers = result.headers;
  } catch {
    try {
      const result = await fetchWithRetry(`https://${domain}`, { timeout: 10_000, retries: 1 });
      headers = result.headers;
    } catch { /* skip */ }
  }

  const hsts = headers['strict-transport-security'] ?? '';
  facts.hasHsts = !!hsts;
  if (hsts) {
    facts.hstsMaxAge = parseInt(hsts.match(/max-age=(\d+)/)?.[1] ?? '0', 10);
    facts.hstsIncludeSubDomains = hsts.includes('includeSubDomains');
    facts.hstsPreload = hsts.includes('preload');
  }

  const csp = headers['content-security-policy'] ?? '';
  facts.hasCsp = !!csp;
  if (csp) {
    facts.cspHasDefaultSrc = csp.includes('default-src');
    facts.cspHasScriptSrc = csp.includes('script-src');
    facts.cspReportOnly = !!headers['content-security-policy-report-only'];
  }

  facts.hasXfo = !!headers['x-frame-options'];
  facts.xfoValue = headers['x-frame-options'] ?? null;
  facts.hasXcto = !!(headers['x-content-type-options']);
  facts.hasReferrerPolicy = !!headers['referrer-policy'];
  facts.referrerPolicy = headers['referrer-policy'] ?? null;
  facts.hasPermissionsPolicy = !!headers['permissions-policy'];
  facts.serverHeader = headers['server'] ?? null;

  return facts;
}

// ── M02: CMS & Infrastructure ─────────────────────────────────────────────────

async function verifyM02(page: Page, url: string): Promise<Record<string, unknown>> {
  console.log('  M02: CMS & Infrastructure...');
  const facts: Record<string, unknown> = {};

  const html = await page.content();

  // CMS detection from HTML patterns
  facts.isWordPress = html.includes('wp-content') || html.includes('wp-includes');
  facts.isShopify = html.includes('cdn.shopify.com') || html.includes('shopify.com');
  facts.isDrupal = html.includes('drupal.js') || html.includes('/sites/default/');
  facts.isSquarespace = html.includes('squarespace.com') || html.includes('static.squarespace.com');
  facts.isWebflow = html.includes('webflow.com') || html.includes('wf-cdn');
  facts.isWix = html.includes('wix.com') || html.includes('parastorage.com');
  facts.isHubSpotCMS = html.includes('hubspot.com/hub') || html.includes('hs-sites.com');

  const generatorMatch = html.match(/<meta[^>]*name="generator"[^>]*content="([^"]+)"/i);
  facts.generator = generatorMatch?.[1] ?? null;
  facts.cmsName = facts.generator?.toString().split(' ')[0]
    ?? (facts.isWordPress ? 'WordPress' : facts.isShopify ? 'Shopify'
    : facts.isDrupal ? 'Drupal' : facts.isSquarespace ? 'Squarespace'
    : facts.isWebflow ? 'Webflow' : facts.isWix ? 'Wix'
    : facts.isHubSpotCMS ? 'HubSpot CMS' : null);

  // CDN + server detection from response headers
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
  if (response) {
    const h = await response.allHeaders();
    facts.serverHeader = h['server'] ?? null;
    facts.cdn = h['cf-ray'] ? 'Cloudflare'
      : h['x-amz-cf-id'] ? 'CloudFront'
      : h['x-sucuri-id'] ? 'Sucuri'
      : h['x-fastly-request-id'] ? 'Fastly'
      : h['x-vercel-id'] ? 'Vercel'
      : h['x-netlify-request-id'] ? 'Netlify'
      : h['via']?.includes('varnish') ? 'Varnish'
      : h['via']?.includes('cloudfront') ? 'CloudFront'
      : null;
    facts.compression = h['content-encoding'] ?? null;
    facts.httpVersion = response.request().url().startsWith('https') ? (h['alt-svc']?.includes('h3') ? 'HTTP/3' : 'HTTP/2') : null;
    facts.poweredBy = h['x-powered-by'] ?? null;
  }

  // Tracking IDs from HTML
  const ga4Match = html.match(/G-[A-Z0-9]{6,}/);
  const gtmMatch = html.match(/GTM-[A-Z0-9]+/);
  facts.hasGA4 = !!ga4Match;
  facts.ga4Id = ga4Match?.[0] ?? null;
  facts.hasGTM = !!gtmMatch;
  facts.gtmId = gtmMatch?.[0] ?? null;

  return facts;
}

// ── M04: Page Metadata ────────────────────────────────────────────────────────

async function verifyM04(page: Page, domain: string): Promise<Record<string, unknown>> {
  console.log('  M04: Page Metadata...');
  const facts: Record<string, unknown> = {};

  facts.title = await page.title();
  facts.titleLength = (facts.title as string)?.length ?? 0;
  facts.metaDescription = await page.$eval('meta[name="description"]', el => el.getAttribute('content')).catch(() => null);
  facts.metaDescriptionLength = (facts.metaDescription as string)?.length ?? 0;
  facts.canonical = await page.$eval('link[rel="canonical"]', el => el.getAttribute('href')).catch(() => null);
  facts.htmlLang = await page.$eval('html', el => el.getAttribute('lang')).catch(() => null);
  facts.viewport = await page.$eval('meta[name="viewport"]', el => el.getAttribute('content')).catch(() => null);
  facts.charset = await page.$eval('meta[charset]', el => el.getAttribute('charset')).catch(() => null);

  // OG tags — detailed
  const ogTags = await page.$$eval('meta[property^="og:"]', els =>
    els.map(el => ({ property: el.getAttribute('property'), content: el.getAttribute('content')?.substring(0, 100) }))
  ).catch(() => []);
  facts.ogTagCount = ogTags.length;
  facts.hasOgTitle = ogTags.some(t => t.property === 'og:title');
  facts.hasOgDescription = ogTags.some(t => t.property === 'og:description');
  facts.hasOgImage = ogTags.some(t => t.property === 'og:image');
  facts.hasOgUrl = ogTags.some(t => t.property === 'og:url');
  facts.hasOgType = ogTags.some(t => t.property === 'og:type');
  facts.hasOgSiteName = ogTags.some(t => t.property === 'og:site_name');

  // Twitter card
  const twitterCard = await page.$eval('meta[name="twitter:card"]', el => el.getAttribute('content')).catch(() => null);
  facts.twitterCard = twitterCard;

  // JSON-LD types
  const jsonLdTypes = await page.$$eval('script[type="application/ld+json"]', els => {
    const types: string[] = [];
    els.forEach(el => {
      try {
        const data = JSON.parse(el.textContent ?? '');
        const extract = (obj: any) => {
          if (obj['@type']) types.push(String(obj['@type']));
          if (Array.isArray(obj['@graph'])) obj['@graph'].forEach(extract);
        };
        if (Array.isArray(data)) data.forEach(extract); else extract(data);
      } catch { /* skip */ }
    });
    return types;
  }).catch(() => []);
  facts.jsonLdCount = jsonLdTypes.length > 0 ? 1 : 0; // at least one block
  facts.jsonLdTypes = jsonLdTypes;

  // Hreflang
  const hreflangCount = await page.$$eval('link[rel="alternate"][hreflang]', els => els.length).catch(() => 0);
  facts.hreflangCount = hreflangCount;

  // Favicon
  const faviconCount = await page.$$eval('link[rel*="icon"]', els => els.length).catch(() => 0);
  facts.faviconCount = faviconCount;

  // robots.txt
  try {
    const robots = await fetchWithRetry(`https://www.${domain}/robots.txt`, { timeout: 5000, retries: 0 });
    facts.hasRobotsTxt = robots.ok && !robots.body.trimStart().startsWith('<');
    if (facts.hasRobotsTxt) {
      facts.robotsHasSitemap = robots.body.toLowerCase().includes('sitemap:');
    }
  } catch { facts.hasRobotsTxt = false; }

  // sitemap
  try {
    const sitemap = await fetchWithRetry(`https://www.${domain}/sitemap.xml`, { timeout: 5000, retries: 0 });
    facts.hasSitemap = sitemap.ok && (sitemap.body.includes('<urlset') || sitemap.body.includes('<sitemapindex'));
  } catch {
    try {
      const sitemap = await fetchWithRetry(`https://${domain}/sitemap.xml`, { timeout: 5000, retries: 0 });
      facts.hasSitemap = sitemap.ok && (sitemap.body.includes('<urlset') || sitemap.body.includes('<sitemapindex'));
    } catch { facts.hasSitemap = false; }
  }

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
      await pressPage.goto(pressPageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
          !href.includes('facebook') && !href.includes('linkedin') && !href.includes('instagram');
      })
      .map(el => ({ href: el.getAttribute('href') ?? '', text: el.textContent?.trim().substring(0, 60) ?? '' }))
      .slice(0, 5);
  });

  facts.careersLinksFound = careersLinks.length;
  facts.careersLinks = careersLinks;
  facts.hasCareersPage = careersLinks.length > 0;

  // Check for external careers subdomain
  const externalCareers = careersLinks.find(l =>
    /^https?:\/\/(careers|jobs)\./i.test(l.href) && l.href.includes(domain.replace(/^www\./, '')),
  );
  facts.externalCareersUrl = externalCareers?.href ?? null;

  // Check for known ATS providers in page HTML
  const atsPatterns = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    const found: string[] = [];
    if (/greenhouse\.io|boards\.greenhouse/i.test(html)) found.push('Greenhouse');
    if (/lever\.co|jobs\.lever/i.test(html)) found.push('Lever');
    if (/workday\.com|myworkdayjobs/i.test(html)) found.push('Workday');
    if (/icims\.com/i.test(html)) found.push('iCIMS');
    if (/smartrecruiters\.com/i.test(html)) found.push('SmartRecruiters');
    if (/ashbyhq\.com/i.test(html)) found.push('Ashby');
    if (/bamboohr\.com/i.test(html)) found.push('BambooHR');
    if (/jobvite\.com/i.test(html)) found.push('Jobvite');
    return found;
  });
  facts.atsProviders = atsPatterns;

  return facts;
}

// ── M18: Investor Relations ───────────────────────────────────────────────────

async function verifyM18(page: Page, domain: string): Promise<Record<string, unknown>> {
  console.log('  M18: Investor Relations...');
  const facts: Record<string, unknown> = {};

  const irData = await page.evaluate((domain) => {
    const keywords = /\b(investor|shareholder|ir\b|inversionista|accionista|annual.report|sec.filing)\b/i;
    const irLinks = Array.from(document.querySelectorAll('a[href]'))
      .filter(el => {
        const href = el.getAttribute('href') ?? '';
        const text = el.textContent?.trim() ?? '';
        return (keywords.test(href) || keywords.test(text)) &&
          !href.includes('facebook') && !href.includes('linkedin');
      })
      .map(el => ({ href: el.getAttribute('href') ?? '', text: el.textContent?.trim().substring(0, 60) ?? '' }))
      .slice(0, 5);

    // Ticker symbol
    const text = document.body.innerText;
    const tickerMatch = text.match(/\b(NYSE|NASDAQ|TSX|LSE)\s*:\s*([A-Z]{1,5})\b/);

    // External IR subdomain
    const extIr = Array.from(document.querySelectorAll('a[href]')).find(a => {
      const href = a.getAttribute('href') ?? '';
      return /^https?:\/\/(ir|investors?)\./i.test(href) && href.includes(domain.replace(/^www\./, ''));
    });

    return {
      irLinksFound: irLinks.length,
      irLinks,
      hasIrPage: irLinks.length > 0,
      ticker: tickerMatch ? { exchange: tickerMatch[1], symbol: tickerMatch[2] } : null,
      externalIrDomain: extIr?.getAttribute('href') ?? null,
    };
  }, domain);

  Object.assign(facts, irData);
  return facts;
}

// ── M19: Support & Success ────────────────────────────────────────────────────

async function verifyM19(page: Page, domain: string): Promise<Record<string, unknown>> {
  console.log('  M19: Support & Success...');
  const facts: Record<string, unknown> = {};

  const supportData = await page.evaluate((domain) => {
    const keywords = /\b(support|help|faq|contact|soporte|ayuda|contacto|preguntas|knowledge.base|docs|documentation)\b/i;
    const supportLinks = Array.from(document.querySelectorAll('a[href]'))
      .filter(el => {
        const href = el.getAttribute('href') ?? '';
        const text = el.textContent?.trim() ?? '';
        return (keywords.test(href) || keywords.test(text)) &&
          !href.includes('facebook') && !href.includes('linkedin');
      })
      .map(el => ({ href: el.getAttribute('href') ?? '', text: el.textContent?.trim().substring(0, 60) ?? '' }))
      .slice(0, 8);

    // Phone
    const phoneLinks = document.querySelectorAll('a[href^="tel:"]');
    const phones = Array.from(phoneLinks).map(el => el.getAttribute('href')?.replace('tel:', '') ?? '').slice(0, 3);

    // Email
    const emailLinks = document.querySelectorAll('a[href^="mailto:"]');
    const emails = Array.from(emailLinks).map(el => el.getAttribute('href')?.replace('mailto:', '') ?? '').slice(0, 3);

    // Live chat
    const hasChat = !!(
      document.querySelector('[class*="chat"], [id*="chat"], [class*="intercom"], [class*="drift"], [class*="crisp"], [class*="zendesk"]') ||
      document.querySelector('iframe[src*="intercom"], iframe[src*="drift"], iframe[src*="crisp"], iframe[src*="zendesk"], iframe[src*="hubspot"]')
    );

    // Status page
    const statusLink = Array.from(document.querySelectorAll('a[href]')).find(a => {
      const href = a.getAttribute('href') ?? '';
      return /status\.|statuspage\.|instatus\.|betteruptime/i.test(href);
    });

    // Developer docs
    const docsLink = Array.from(document.querySelectorAll('a[href]')).find(a => {
      const href = a.getAttribute('href') ?? '';
      const text = a.textContent ?? '';
      return /\b(docs|documentation|api|developer)\b/i.test(href) || /\b(documentation|api reference|developer)\b/i.test(text);
    });

    // Support subdomains
    const supportSubdomains = Array.from(document.querySelectorAll('a[href]'))
      .filter(a => {
        const href = a.getAttribute('href') ?? '';
        return /^https?:\/\/(support|help|docs|kb|knowledge|community)\./i.test(href) && href.includes(domain.replace(/^www\./, ''));
      })
      .map(a => a.getAttribute('href')!)
      .slice(0, 3);

    return {
      supportLinksFound: supportLinks.length,
      supportLinks,
      hasSupportPage: supportLinks.length > 0,
      phones,
      hasPhone: phones.length > 0,
      emails,
      hasEmail: emails.length > 0,
      hasChat,
      statusPageUrl: statusLink?.getAttribute('href') ?? null,
      hasDeveloperDocs: !!docsLink,
      supportSubdomains,
      channelCount: (phones.length > 0 ? 1 : 0) + (emails.length > 0 ? 1 : 0) + (hasChat ? 1 : 0) + (supportLinks.length > 0 ? 1 : 0),
    };
  }, domain);

  Object.assign(facts, supportData);
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
      await mainPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch {
      baseUrl = `https://${domain}`;
      await mainPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
      try {
        await captureGroundTruth(site, browser);
      } catch (err) {
        console.error(`\n  ✗ FAILED for ${site}: ${(err as Error).message}`);
      }
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
