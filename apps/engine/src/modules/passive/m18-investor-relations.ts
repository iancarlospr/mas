import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext, ModuleExecuteFn } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { fetchWithRetry } from '../../utils/http.js';
import { normalizeUrl } from '../../utils/url.js';
import { parseHtml, extractLinks } from '../../utils/html.js';
import type { CheerioAPI } from '../../utils/html.js';
import { detectPageLanguage, expandProbePaths, buildMultilingualLinkRegex } from '../../utils/i18n-probes.js';
import { discoverPathsFromSitemap } from '../../utils/sitemap.js';
import * as cheerio from 'cheerio';

// ─── Probe paths (English base — expanded at runtime via i18n-probes) ───────
const IR_PATHS_BASE = [
  '/investors', '/investor', '/ir', '/investor-relations', '/sec-filings', '/annual-report',
  '/shareholders', '/governance', '/financials', '/quarterly-results', '/earnings',
  '/about/investors', '/about/investor-relations', '/company/investors', '/company/investor-relations',
  '/investor-events', '/stock-information', '/dividend-history',
  '/proxy', '/corporate-governance', '/esg',
  // Compound paths for global/corporate sites
  '/global/ir', '/global/investors', '/corporate/investors', '/corporate/ir',
  '/about-us/investors', '/about-us/investor-relations',
  '/en/investors', '/en-us/investors', '/us/investors',
  // Sub-pages under IR portals (IBM /investor/sec-filings, etc.)
  '/ir/sec-filings', '/ir/earnings', '/ir/governance', '/ir/annual-report',
  '/investor/sec-filings', '/investor/earnings', '/investor/governance',
  '/investors/sec-filings', '/investors/earnings', '/investors/governance',
] as const;

// Common IR subdomains (probed as https://{sub}.{domain}/)
const IR_SUBDOMAINS = ['investors', 'investor', 'ir', 'corporate', 'corp'] as const;
const IR_SUBDOMAIN_PATHS = ['/', '/home/default.aspx', '/investors'] as const;

const IR_LINK_KEYWORDS_BASE = [
  'investor', 'shareholder', 'stockholder',
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

interface ProbeResult {
  path: string;
  found: boolean;
  html?: string;
  status?: number;
}

// Keywords that indicate genuine IR content (not SPA shell or soft-404)
const IR_CONTENT_SIGNALS = [
  'investor', 'shareholder', 'sec filing', '10-k', '10-q',
  'annual report', 'earnings call', 'stock price', 'ticker',
  'quarterly results', 'financial results', 'board of directors',
  'corporate governance', 'proxy statement', 'dividend',
] as const;

async function probePath(
  baseUrl: string,
  path: string,
): Promise<ProbeResult> {
  try {
    const result = await fetchWithRetry(`${baseUrl}${path}`, {
      timeout: 8000,
      retries: 1,
    });
    if (result.ok) {
      // Reject redirects to locale roots (e.g. IBM /ir → /us-en).
      // A real IR page redirects to /investors or /ir/overview, not a bare locale slug.
      const finalPath = new URL(result.finalUrl).pathname.replace(/\/$/, '');
      const requestedPath = path.replace(/\/$/, '');
      if (requestedPath !== '/' && finalPath !== requestedPath) {
        const isLocaleRoot = /^\/([a-z]{2}(-[a-z]{2,4})?)$/.test(finalPath);
        const isHomepage = finalPath === '' || finalPath === '/';
        if (isLocaleRoot || isHomepage) {
          return { path, found: false, status: result.status };
        }
      }

      // Content validation: verify the page actually contains IR-related content.
      // Prevents SPA catch-all / soft-404 / redirect false positives
      // (angular.dev, vercel.com, dell.com all return 200 for every path).
      const bodyLower = result.body.toLowerCase();

      // Primary check: page <title> explicitly mentions IR (strongest signal).
      // An IR landing page like "Investor Relations - Humana" passes immediately,
      // while SPA shells like "Angular" or "Vercel" do not.
      const titleMatch = result.body.match(/<title[^>]*>(.*?)<\/title>/is);
      const title = (titleMatch?.[1] ?? '').toLowerCase();
      if (/investor|shareholder|(?:^|\s)ir(?:\s|$)/.test(title)) {
        return { path, found: true, html: result.body, status: result.status };
      }

      // Secondary check: body must have 2+ IR keywords
      const irHits = IR_CONTENT_SIGNALS.filter(kw => bodyLower.includes(kw)).length;
      if (irHits < 2) return { path, found: false, status: result.status };
      return { path, found: true, html: result.body, status: result.status };
    }
    return { path, found: false, status: result.status };
  } catch {
    return { path, found: false };
  }
}

/**
 * Detect whether the IR page has SEC filing links.
 */
function detectSecFilings($: CheerioAPI): { found: boolean; evidence: string } {
  const links = extractLinks($);
  const bodyText = $('body').text().toLowerCase();

  // Check for SEC-related links
  for (const link of links) {
    const href = link.href.toLowerCase();
    const text = link.text.toLowerCase();
    if (
      href.includes('sec.gov') ||
      href.includes('edgar') ||
      /10-[kq]/i.test(text) ||
      /annual\s*report/i.test(text) ||
      /sec\s*filing/i.test(text) ||
      /quarterly\s*report/i.test(text)
    ) {
      return { found: true, evidence: `SEC filing link found: "${link.text.trim().slice(0, 80)}"` };
    }
  }

  // Check for SEC-related keywords in body
  const secKeywords = ['10-k', '10-q', 'sec filing', 'annual report', 'quarterly report', 'edgar', '8-k', 'proxy statement'];
  for (const keyword of secKeywords) {
    if (bodyText.includes(keyword)) {
      return { found: true, evidence: `SEC filing reference found: "${keyword}"` };
    }
  }

  return { found: false, evidence: 'No SEC filings detected' };
}

/**
 * Detect an annual report link or mention.
 */
function detectAnnualReport($: CheerioAPI): { found: boolean; evidence: string } {
  const links = extractLinks($);

  for (const link of links) {
    const href = link.href.toLowerCase();
    const text = link.text.toLowerCase();
    if (
      /annual[-\s]?report/i.test(text) ||
      /annual[-\s]?report/i.test(href) ||
      (href.endsWith('.pdf') && /annual/i.test(text))
    ) {
      return { found: true, evidence: `Annual report link: "${link.text.trim().slice(0, 80)}"` };
    }
  }

  return { found: false, evidence: 'No annual report detected' };
}

/**
 * Detect a stock ticker symbol.
 */
function detectTickerSymbol($: CheerioAPI): { ticker: string | null; exchange: string | null } {
  const bodyText = $('body').text();

  // Check meta tags first (most reliable)
  const metaTicker = $('meta[name="ticker"]').attr('content')
    ?? $('meta[property="stock:ticker"]').attr('content');
  if (metaTicker) {
    return { ticker: metaTicker, exchange: null };
  }

  // Common patterns: "NYSE: AAPL", "NASDAQ: GOOGL", "Stock: MSFT"
  const tickerPatterns = [
    /(?:NYSE|NASDAQ|AMEX|TSX|LSE|ASX|TYO|KRX|BSE|NSE|SGX|HKEX)\s*:\s*([A-Z]{1,5})/i,
    /\b(?:ticker|stock)\s*(?:symbol)?\s*:\s*([A-Z]{1,5})\b/i,
  ];

  for (const pattern of tickerPatterns) {
    const match = bodyText.match(pattern);
    if (match?.[1]) {
      const exchangeMatch = bodyText.match(/(NYSE|NASDAQ|AMEX|TSX|LSE|ASX|TYO|KRX|BSE|NSE|SGX|HKEX)/i);
      return {
        ticker: match[1],
        exchange: exchangeMatch?.[1] ? exchangeMatch[1].toUpperCase() : null,
      };
    }
  }

  // $TICKER pattern — only match in IR/financial context to avoid false positives
  const contextualTicker = bodyText.match(/(?:ticker|symbol|stock|trades?\s+(?:as|under))\s+\$([A-Z]{1,5})\b/i);
  if (contextualTicker?.[1]) {
    return { ticker: contextualTicker[1], exchange: null };
  }

  return { ticker: null, exchange: null };
}

/**
 * Detect ESG (Environmental, Social, Governance) report.
 */
function detectEsgReport($: CheerioAPI): { found: boolean; evidence: string } {
  const links = extractLinks($);
  const bodyText = $('body').text().toLowerCase();

  for (const link of links) {
    const href = link.href.toLowerCase();
    const text = link.text.toLowerCase();
    if (
      /esg/i.test(text) ||
      /sustainability\s*report/i.test(text) ||
      /corporate\s*(?:social\s*)?responsibility/i.test(text) ||
      /esg/i.test(href) ||
      /sustainability[-_]?report/i.test(href)
    ) {
      return { found: true, evidence: `ESG/sustainability report link: "${link.text.trim().slice(0, 80)}"` };
    }
  }

  // Check body text for ESG references
  const esgKeywords = ['esg report', 'sustainability report', 'corporate responsibility report', 'impact report', 'csr report'];
  for (const keyword of esgKeywords) {
    if (bodyText.includes(keyword)) {
      return { found: true, evidence: `ESG reference found: "${keyword}"` };
    }
  }

  return { found: false, evidence: 'No ESG/sustainability report detected' };
}

/**
 * Determine whether the IR page has significant financial data (filings portal).
 */
function detectIrPortalDepth($: CheerioAPI): 'filings' | 'basic' | 'none' {
  const bodyText = $('body').text().toLowerCase();
  const links = extractLinks($);

  // Check for comprehensive IR portal indicators
  const filingIndicators = ['sec filing', '10-k', '10-q', 'edgar', 'quarterly results', 'earnings', 'financial results'];
  let filingCount = 0;
  for (const indicator of filingIndicators) {
    if (bodyText.includes(indicator)) filingCount++;
  }

  if (filingCount >= 2) return 'filings';

  // Check for basic IR info
  const basicIndicators = ['investor', 'shareholder', 'stock', 'financial', 'annual report', 'governance'];
  let basicCount = 0;
  for (const indicator of basicIndicators) {
    if (bodyText.includes(indicator)) basicCount++;
  }

  if (basicCount >= 1) return 'basic';

  return 'none';
}

/**
 * Detect corporate governance content (board of directors, governance docs).
 */
function detectGovernance($: CheerioAPI): { found: boolean; evidence: string } {
  const bodyText = $('body').text().toLowerCase();
  const keywords = ['board of directors', 'corporate governance', 'governance guidelines', 'audit committee', 'compensation committee', 'charter'];
  const found: string[] = [];
  for (const kw of keywords) {
    if (bodyText.includes(kw)) found.push(kw);
  }
  if (found.length >= 2) return { found: true, evidence: `Governance content detected: ${found.join(', ')}` };
  if (found.length === 1) return { found: true, evidence: `Governance reference: ${found[0]}` };
  return { found: false, evidence: 'No governance content detected' };
}

/**
 * Detect earnings call / financial events content.
 */
function detectEarningsCalls($: CheerioAPI): { found: boolean; evidence: string } {
  const bodyText = $('body').text().toLowerCase();
  const keywords = ['earnings call', 'earnings release', 'quarterly earnings', 'financial results', 'investor day', 'earnings webcast', 'conference call'];
  for (const kw of keywords) {
    if (bodyText.includes(kw)) return { found: true, evidence: `Earnings events detected: "${kw}"` };
  }
  return { found: false, evidence: 'No earnings call information detected' };
}

/**
 * Detect IR contact email.
 */
function detectIrContact($: CheerioAPI): string | null {
  const bodyText = $('body').text();
  const emailRegex = /(?:investor|ir|shareholder)s?@[\w.-]+\.\w{2,}/gi;
  const match = bodyText.match(emailRegex);
  if (match) return match[0]!.toLowerCase();

  // Fallback: check mailto links
  let found: string | null = null;
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const addr = href.replace('mailto:', '').split('?')[0]?.toLowerCase() ?? '';
    if (/investor|ir\b|shareholder/i.test(addr)) {
      found = addr;
      return false;
    }
  });
  return found;
}

/**
 * Detect external IR subdomain (ir.company.com, investors.company.com).
 */
function detectExternalIrDomain($: CheerioAPI, domain: string): string | null {
  let externalIr: string | null = null;
  const baseDomain = domain.replace(/^www\./, '');

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = ($(el).text() ?? '').toLowerCase();
    try {
      const url = new URL(href, `https://${domain}`);
      // Skip same-host links
      if (url.hostname === domain || url.hostname === `www.${baseDomain}`) return;

      // Match IR subdomains: ir.company.com, investors.company.com, corp.company.com
      if (url.hostname.endsWith(baseDomain) &&
        /^(ir|investors?|shareholder|corp|corporate)\./.test(url.hostname)) {
        externalIr = url.href;
        return false;
      }

      // Match IR links by path on any subdomain of the same domain
      if (url.hostname.endsWith(baseDomain) &&
        /\/(investors?|investor-relations|ir)\b/i.test(url.pathname)) {
        externalIr = url.href;
        return false;
      }

      // Match external IR links by link text (for different-domain parent companies)
      if (/investor|shareholder|ir\b|annual\s*report|sec\s*filing/i.test(text) &&
        !url.hostname.endsWith(baseDomain)) {
        externalIr = url.href;
        return false;
      }
    } catch { /* ignore */ }
  });
  return externalIr;
}

/**
 * Detect proxy statement / DEF 14A.
 */
function detectProxyStatement($: CheerioAPI): { found: boolean; evidence: string } {
  const links = extractLinks($);
  const bodyText = $('body').text().toLowerCase();

  for (const link of links) {
    const text = link.text.toLowerCase();
    const href = link.href.toLowerCase();
    if (/proxy\s*statement/i.test(text) || /def\s*14a/i.test(text) || /proxy/i.test(href) && /statement|filing/i.test(href)) {
      return { found: true, evidence: `Proxy statement link: "${link.text.trim().slice(0, 80)}"` };
    }
  }

  if (/proxy\s*statement/i.test(bodyText) || /def\s*14a/i.test(bodyText)) {
    return { found: true, evidence: 'Proxy statement reference found in page text' };
  }

  return { found: false, evidence: 'No proxy statement detected' };
}

/**
 * Detect investor presentations / slides.
 */
function detectInvestorPresentations($: CheerioAPI): { found: boolean; urls: string[]; evidence: string } {
  const links = extractLinks($);
  const urls: string[] = [];

  for (const link of links) {
    const text = link.text.toLowerCase();
    const href = link.href.toLowerCase();
    if (/investor\s*(?:day|presentation|deck|slides)/i.test(text) ||
        /(?:presentation|slides|deck).*\.pdf/i.test(href) ||
        /earnings\s*(?:presentation|slides)/i.test(text) ||
        /quarterly\s*(?:presentation|slides)/i.test(text) ||
        /(?:investor|corporate)\s*overview/i.test(text)) {
      urls.push(link.href);
    }
  }

  if (urls.length > 0) {
    return { found: true, urls, evidence: `${urls.length} investor presentation(s) found` };
  }

  return { found: false, urls: [], evidence: 'No investor presentations detected' };
}

/**
 * Detect dividend information.
 */
function detectDividendInfo($: CheerioAPI): { found: boolean; evidence: string } {
  const bodyText = $('body').text().toLowerCase();
  const links = extractLinks($);

  for (const link of links) {
    const text = link.text.toLowerCase();
    if (/dividend/i.test(text)) {
      return { found: true, evidence: `Dividend link found: "${link.text.trim().slice(0, 80)}"` };
    }
  }

  const divKeywords = ['dividend history', 'dividend yield', 'dividend policy', 'dividend payment', 'quarterly dividend', 'annual dividend', 'dividend per share'];
  for (const kw of divKeywords) {
    if (bodyText.includes(kw)) {
      return { found: true, evidence: `Dividend reference: "${kw}"` };
    }
  }

  return { found: false, evidence: 'No dividend information detected' };
}

/**
 * Detect investor email alert signup form.
 */
function detectEmailAlertSignup($: CheerioAPI): boolean {
  const bodyText = $('body').text().toLowerCase();
  const hasAlertForm = $('form').filter((_, el) => {
    const action = ($(el).attr('action') ?? '').toLowerCase();
    const id = ($(el).attr('id') ?? '').toLowerCase();
    const cls = ($(el).attr('class') ?? '').toLowerCase();
    return /alert|subscribe|notify|email/i.test(action + id + cls);
  }).length > 0;

  if (hasAlertForm) return true;

  // Text-based detection
  const alertPhrases = ['email alert', 'email notification', 'subscribe to', 'investor alert', 'sign up for', 'ir email', 'press release alert'];
  for (const phrase of alertPhrases) {
    if (bodyText.includes(phrase)) return true;
  }

  return false;
}

/**
 * Count board of directors members.
 */
function detectBoardMembers($: CheerioAPI): { count: number; names: string[] } {
  const names: string[] = [];

  // Common false-positive phrases that look like names but aren't
  const blocklist = /^(upcoming|past|recent|current|new|next|last|open|more|read|view|see|about|our|the|all|back|home|learn|get|sign|log)\b/i;

  // Only look for board members near governance-related content
  const governanceSection = $('[class*="board"], [class*="director"], [class*="governance"], [id*="board"], [id*="director"]');

  const selector = governanceSection.length > 0
    ? governanceSection.find('h3, h4, li, .name, [class*="name"]')
    : $('h3, h4').filter((_, el) => {
        // Only match headings near "board" or "director" text context
        const parent = $(el).parent().text().toLowerCase();
        return /board of directors|our directors|our board/i.test(parent);
      });

  selector.each((_, el) => {
    const text = $(el).text().trim();
    // Must be 2-4 words, capitalized, look like a person's name, not a blocklisted phrase
    if (/^[A-Z][a-z]+(?:\s+[A-Z]\.?\s+)?(?:\s+[A-Z][a-z]+){1,3}$/.test(text) &&
        text.length < 50 && text.length > 5 && !blocklist.test(text)) {
      names.push(text);
    }
  });

  return { count: names.length, names: names.slice(0, 20) };
}

/**
 * Detect transfer agent information.
 */
function detectTransferAgent($: CheerioAPI): string | null {
  const bodyText = $('body').text();
  const taPattern = /transfer\s*agent[:\s]*([A-Z][A-Za-z\s&.]+?)(?:\.|,|\n|<)/i;
  const match = bodyText.match(taPattern);
  if (match?.[1]) return match[1].trim();

  // Common transfer agents
  const knownAgents = ['Computershare', 'American Stock Transfer', 'Broadridge', 'Continental Stock Transfer', 'EQ Shareowner Services'];
  for (const agent of knownAgents) {
    if (bodyText.includes(agent)) return agent;
  }

  return null;
}

/**
 * Detect CUSIP or ISIN number.
 */
function detectStockIdentifiers($: CheerioAPI): { cusip: string | null; isin: string | null } {
  const bodyText = $('body').text();

  // CUSIP: 9 characters (6 alpha + 2 alphanumeric + 1 check digit)
  const cusipMatch = bodyText.match(/CUSIP[:\s#]*([A-Z0-9]{9})/i);
  // ISIN: 2 letter country + 9 alphanumeric + 1 check digit
  const isinMatch = bodyText.match(/ISIN[:\s#]*([A-Z]{2}[A-Z0-9]{10})/i);

  return {
    cusip: cusipMatch?.[1] ?? null,
    isin: isinMatch?.[1] ?? null,
  };
}

/**
 * Detect upcoming investor events.
 */
function detectUpcomingEvents($: CheerioAPI): { found: boolean; evidence: string } {
  const bodyText = $('body').text().toLowerCase();
  const links = extractLinks($);

  for (const link of links) {
    const text = link.text.toLowerCase();
    if (/event|calendar|upcoming/i.test(text) && /investor|earning|conference/i.test(text)) {
      return { found: true, evidence: `Investor events link: "${link.text.trim().slice(0, 80)}"` };
    }
  }

  const eventKeywords = ['upcoming event', 'investor event', 'events calendar', 'next earnings', 'conference schedule', 'investor conference'];
  for (const kw of eventKeywords) {
    if (bodyText.includes(kw)) {
      return { found: true, evidence: `Investor events reference: "${kw}"` };
    }
  }

  return { found: false, evidence: 'No upcoming investor events detected' };
}

/**
 * Check the main page HTML for nav/footer links to IR-related pages.
 * Uses multilingual keywords based on the page's detected language.
 */
function findIrLinksInMainPage($: CheerioAPI, lang: string): string[] {
  const irLinks: string[] = [];
  const textRegex = buildMultilingualLinkRegex(IR_LINK_KEYWORDS_BASE, lang, 'ir');

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim().toLowerCase();
    const hrefLower = href.toLowerCase();

    // Skip editorial/article links (news sites like nytimes.com have articles
    // with "investor" in headlines — these are NOT IR portal links).
    // Date-patterned URLs: /2024/01/15/..., /business/..., /technology/...
    if (/\/\d{4}\/\d{1,2}\//.test(hrefLower)) return;
    if (/\/(business|technology|politics|opinion|world|arts|science|sports|style|health)\//i.test(hrefLower)) return;

    // Text-based matching (multilingual keywords)
    if (textRegex.test(text)) {
      irLinks.push(href);
      return;
    }

    // href-based matching (specific IR paths/subdomains)
    if (/\/(investors?|investor-relations|ir|inversionistas|investisseurs|investoren|investidores)\b/i.test(hrefLower) ||
        /\/sec-filings|\/annual-report|\/earnings/i.test(hrefLower) ||
        /^(https?:)?\/\/ir\./i.test(hrefLower)) {
      irLinks.push(href);
    }
  });

  return [...new Set(irLinks)];
}

// ─── Module execute function ────────────────────────────────────────────────

const execute: ModuleExecuteFn = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const baseUrl = normalizeUrl(ctx.url);

  // Detect page language for multilingual probe expansion
  const lang = ctx.html ? detectPageLanguage(ctx.html) : 'en';
  const IR_PATHS_STATIC = expandProbePaths(IR_PATHS_BASE, lang, 'ir');
  data.detected_language = lang;

  // 0. Discover IR paths from sitemap.xml / robots.txt
  //    The site literally tells us where its IR pages are — much smarter than
  //    brute-forcing dozens of paths.
  const IR_KEYWORDS = ['investor', 'ir', 'shareholder', 'sec-filing', 'annual-report', 'earnings', 'governance'];
  const sitemapDiscovery = await discoverPathsFromSitemap(baseUrl, IR_KEYWORDS, { timeout: 6000, maxMatchedPaths: 10 });
  data.sitemap_discovery = {
    found: sitemapDiscovery.sitemapFound,
    matched: sitemapDiscovery.matchedPaths,
    robotsHints: sitemapDiscovery.robotsHints,
  };

  // Merge sitemap-discovered paths with static paths (deduplicated)
  const staticPathSet = new Set(IR_PATHS_STATIC);
  const sitemapPaths = [
    ...sitemapDiscovery.matchedPaths,
    ...sitemapDiscovery.robotsHints,
  ].filter(p => !staticPathSet.has(p));
  const IR_PATHS = [...IR_PATHS_STATIC, ...sitemapPaths];

  // 1. Check the main page for IR-related links
  let mainPageIrLinks: string[] = [];
  if (ctx.html) {
    const $main = parseHtml(ctx.html);
    mainPageIrLinks = findIrLinksInMainPage($main, lang);
  }

  // 2. Probe known IR paths + sitemap-discovered paths
  const probeResults = await Promise.allSettled(
    IR_PATHS.map((path) => probePath(baseUrl, path)),
  );

  const foundPages: ProbeResult[] = [];
  for (const result of probeResults) {
    if (result.status === 'fulfilled' && result.value.found) {
      foundPages.push(result.value);
    }
  }

  // 2b. Follow discovered IR links from the main page that weren't covered by fixed path probes
  if (mainPageIrLinks.length > 0) {
    const probedPathSet = new Set(IR_PATHS.map(p => `${baseUrl}${p}`.toLowerCase()));
    const discoveredUrls: string[] = [];

    for (const link of mainPageIrLinks) {
      try {
        const resolved = new URL(link, baseUrl).href;
        // Skip if already probed via fixed paths
        if (probedPathSet.has(resolved.toLowerCase())) continue;
        // Skip non-http links
        if (!resolved.startsWith('http')) continue;
        discoveredUrls.push(resolved);
      } catch { /* ignore malformed URLs */ }
    }

    // Fetch up to 5 discovered IR links (avoid excessive requests)
    const discoveredProbes = await Promise.allSettled(
      discoveredUrls.slice(0, 5).map(async (url) => {
        try {
          const result = await fetchWithRetry(url, { timeout: 8000, retries: 1 });
          if (result.ok) {
            return { path: new URL(url).pathname, found: true as const, html: result.body, status: result.status, url };
          }
          return { path: new URL(url).pathname, found: false as const, status: result.status, url };
        } catch {
          return { path: new URL(url).pathname, found: false as const, url };
        }
      })
    );

    for (const result of discoveredProbes) {
      if (result.status === 'fulfilled' && result.value.found) {
        foundPages.push(result.value);
      }
    }
  }

  // 2c. Probe common IR subdomains (investors.company.com, ir.company.com, etc.)
  if (foundPages.length === 0) {
    const registrableDomain = new URL(baseUrl).hostname.replace(/^www\./, '');
    const subdomainProbes = await Promise.allSettled(
      IR_SUBDOMAINS.flatMap(sub =>
        IR_SUBDOMAIN_PATHS.map(async (path) => {
          const subUrl = `https://${sub}.${registrableDomain}${path}`;
          try {
            const result = await fetchWithRetry(subUrl, { timeout: 10000, retries: 1 });
            if (result.ok && result.body) {
              // For IR-specific subdomains (investors.*, ir.*), the hostname itself
              // is strong evidence — these are dedicated IR portals, not generic pages.
              // Many are Q4/GCS-hosted SPAs where the static HTML shell may lack
              // enough keywords to pass strict content validation.
              const isIrSubdomain = /^(investors?|ir|shareholder)\b/.test(sub);
              if (isIrSubdomain) {
                // Lightweight check: just verify we didn't get redirected to
                // the main domain (wildcard DNS guard)
                const finalHost = new URL(result.finalUrl).hostname.replace(/^www\./, '');
                if (finalHost === registrableDomain) {
                  return { path: `${sub}.${registrableDomain}${path}`, found: false as const, status: result.status };
                }
                // Also check title for generic "not found" / "error" pages
                const titleMatch = result.body.match(/<title[^>]*>(.*?)<\/title>/is);
                const title = (titleMatch?.[1] ?? '').toLowerCase();
                if (/not found|404|error|page not|unavailable/i.test(title)) {
                  return { path: `${sub}.${registrableDomain}${path}`, found: false as const, status: result.status };
                }
                return { path: `${sub}.${registrableDomain}${path}`, found: true as const, html: result.body, status: result.status };
              }
              // For generic subdomains (corporate.*, corp.*), require content validation
              const bodyLower = result.body.toLowerCase();
              const irHits = IR_CONTENT_SIGNALS.filter(kw => bodyLower.includes(kw)).length;
              if (irHits >= 2) {
                return { path: `${sub}.${registrableDomain}${path}`, found: true as const, html: result.body, status: result.status };
              }
            }
            return { path: `${sub}.${registrableDomain}${path}`, found: false as const, status: result.status };
          } catch {
            return { path: `${sub}.${registrableDomain}${path}`, found: false as const };
          }
        })
      )
    );

    for (const result of subdomainProbes) {
      if (result.status === 'fulfilled' && result.value.found) {
        foundPages.push(result.value);
        break; // One successful subdomain is enough
      }
    }
  }

  // 2d. SPA catch-all dedup: if many "found" pages have identical bodies, it's
  // an SPA rendering every route with the same shell (vercel.com, angular.dev).
  // Hash first 2000 chars of body to detect duplicates; if >3 share a hash, discard all.
  if (foundPages.length > 3) {
    const bodyHashes = new Map<string, number>();
    for (const page of foundPages) {
      if (!page.html) continue;
      const snippet = page.html.slice(0, 2000);
      const count = bodyHashes.get(snippet) ?? 0;
      bodyHashes.set(snippet, count + 1);
    }
    const maxDupes = Math.max(...bodyHashes.values(), 0);
    if (maxDupes > 3) {
      // Most pages returned the same HTML shell — SPA catch-all confirmed
      const spaSnippets = new Set<string>();
      for (const [snippet, count] of bodyHashes) {
        if (count > 3) spaSnippets.add(snippet);
      }
      // Remove pages that match SPA bodies
      for (let i = foundPages.length - 1; i >= 0; i--) {
        const snippet = foundPages[i]!.html?.slice(0, 2000) ?? '';
        if (spaSnippets.has(snippet)) {
          foundPages.splice(i, 1);
        }
      }
    }
  }

  // 2e. Probe third-party IR hosting platforms (Nasdaq GlobeNewswire / Q4 Inc).
  // Companies like Humana host IR on {company}.gcs-web.com rather than their own domain.
  // These are known IR-only platforms — the domain itself is strong evidence.
  if (foundPages.length === 0) {
    const IR_EXTERNAL_PLATFORMS = ['gcs-web.com', 'q4web.com', 'q4inc.com'] as const;
    const hostname = new URL(baseUrl).hostname.replace(/^www\./, '');
    // Extract company name from domain (e.g. "humana" from "humana.com")
    const companySlug = hostname.split('.')[0] ?? '';

    if (companySlug) {
      const platformProbes = await Promise.allSettled(
        IR_EXTERNAL_PLATFORMS.map(async (platform) => {
          const extUrl = `https://${companySlug}.${platform}/`;
          try {
            const result = await fetchWithRetry(extUrl, { timeout: 20000, retries: 1 });
            if (result.ok && result.body) {
              // Known IR platforms: trust the domain. These are GCS/Q4 hosted
              // IR portals — often React SPAs where static HTML is a shell.
              // Just verify we got a real page (not a 404 body or empty shell).
              const titleMatch = result.body.match(/<title[^>]*>(.*?)<\/title>/is);
              const title = (titleMatch?.[1] ?? '').toLowerCase();
              if (/not found|404|error|unavailable|coming soon/.test(title)) {
                return { path: `${companySlug}.${platform}/`, found: false as const };
              }
              // Accept if the page has ANY content (not a blank/error page).
              // GCS/Q4 portals are React SPAs — the static HTML shell can be small
              // but any response > 100 chars with a 200 status on a known IR platform is valid.
              if (result.body.length > 100) {
                return { path: `${companySlug}.${platform}/`, found: true as const, html: result.body, status: result.status };
              }
            }
            return { path: `${companySlug}.${platform}/`, found: false as const };
          } catch {
            return { path: `${companySlug}.${platform}/`, found: false as const };
          }
        })
      );

      for (const result of platformProbes) {
        if (result.status === 'fulfilled' && result.value.found) {
          foundPages.push(result.value);
          break; // One external platform is enough
        }
      }
    }
  }

  data.probed_paths = IR_PATHS;
  data.found_pages = foundPages.map((p) => p.path);
  data.main_page_ir_links = mainPageIrLinks;

  // 3. Analyze found pages
  let bestIrPage: ProbeResult | null = null;
  let secFilings = { found: false, evidence: 'No SEC filings detected' };
  let annualReport = { found: false, evidence: 'No annual report detected' };
  let ticker = { ticker: null as string | null, exchange: null as string | null };
  let esgReport = { found: false, evidence: 'No ESG/sustainability report detected' };
  let irPortalDepth: 'filings' | 'basic' | 'none' = 'none';

  for (const page of foundPages) {
    if (!page.html) continue;

    const $ = parseHtml(page.html);

    if (!bestIrPage) {
      bestIrPage = page;
    }

    // Detect SEC filings
    if (!secFilings.found) {
      secFilings = detectSecFilings($);
    }

    // Detect annual report
    if (!annualReport.found) {
      annualReport = detectAnnualReport($);
    }

    // Detect ticker symbol
    if (!ticker.ticker) {
      ticker = detectTickerSymbol($);
    }

    // Detect ESG report
    if (!esgReport.found) {
      esgReport = detectEsgReport($);
    }

    // Determine IR portal depth
    const depth = detectIrPortalDepth($);
    if (depth === 'filings') irPortalDepth = 'filings';
    else if (depth === 'basic' && irPortalDepth === 'none') irPortalDepth = 'basic';
  }

  // Run new detectors across found pages
  let governance = { found: false, evidence: 'No governance content detected' };
  let earningsCalls = { found: false, evidence: 'No earnings call information detected' };
  let irContactEmail: string | null = null;
  let externalIrDomain: string | null = null;
  let proxyStatement = { found: false, evidence: 'No proxy statement detected' };
  let investorPresentations = { found: false, urls: [] as string[], evidence: 'No investor presentations detected' };
  let dividendInfo = { found: false, evidence: 'No dividend information detected' };
  let emailAlertSignup = false;
  let boardMembers = { count: 0, names: [] as string[] };
  let transferAgent: string | null = null;
  let stockIdentifiers = { cusip: null as string | null, isin: null as string | null };
  let upcomingEvents = { found: false, evidence: 'No upcoming investor events detected' };
  const domain = new URL(baseUrl).hostname.replace(/^www\./, '');

  for (const page of foundPages) {
    if (!page.html) continue;
    const $ = parseHtml(page.html);
    if (!governance.found) governance = detectGovernance($);
    if (!earningsCalls.found) earningsCalls = detectEarningsCalls($);
    if (!irContactEmail) irContactEmail = detectIrContact($);
    if (!externalIrDomain) externalIrDomain = detectExternalIrDomain($, domain);
    if (!proxyStatement.found) proxyStatement = detectProxyStatement($);
    if (!investorPresentations.found) investorPresentations = detectInvestorPresentations($);
    if (!dividendInfo.found) dividendInfo = detectDividendInfo($);
    if (!emailAlertSignup) emailAlertSignup = detectEmailAlertSignup($);
    if (boardMembers.count === 0) boardMembers = detectBoardMembers($);
    if (!transferAgent) transferAgent = detectTransferAgent($);
    if (!stockIdentifiers.cusip && !stockIdentifiers.isin) stockIdentifiers = detectStockIdentifiers($);
    if (!upcomingEvents.found) upcomingEvents = detectUpcomingEvents($);
  }

  // Also check the main page for ticker symbol and external IR domain
  if (ctx.html) {
    const $main = parseHtml(ctx.html);
    if (!ticker.ticker) ticker = detectTickerSymbol($main);
    if (!externalIrDomain) externalIrDomain = detectExternalIrDomain($main, domain);
  }

  // 4. Follow external IR domain if detected but no IR pages found yet
  if (externalIrDomain && foundPages.length === 0) {
    try {
      const extResult = await fetchWithRetry(externalIrDomain, {
        timeout: 10000,
        retries: 1,
      });
      if (extResult.ok && extResult.body) {
        const extPath = new URL(externalIrDomain).pathname || '/';
        foundPages.push({ path: extPath, found: true, html: extResult.body, status: extResult.status });

        // Re-run detectors on the external IR page
        const $ext = parseHtml(extResult.body);
        if (!bestIrPage) bestIrPage = foundPages[foundPages.length - 1]!;
        if (!secFilings.found) secFilings = detectSecFilings($ext);
        if (!annualReport.found) annualReport = detectAnnualReport($ext);
        if (!ticker.ticker) ticker = detectTickerSymbol($ext);
        if (!esgReport.found) esgReport = detectEsgReport($ext);
        const depth = detectIrPortalDepth($ext);
        if (depth === 'filings') irPortalDepth = 'filings';
        else if (depth === 'basic' && irPortalDepth === 'none') irPortalDepth = 'basic';
        if (!governance.found) governance = detectGovernance($ext);
        if (!earningsCalls.found) earningsCalls = detectEarningsCalls($ext);
        if (!irContactEmail) irContactEmail = detectIrContact($ext);
        if (!proxyStatement.found) proxyStatement = detectProxyStatement($ext);
        if (!investorPresentations.found) investorPresentations = detectInvestorPresentations($ext);
        if (!dividendInfo.found) dividendInfo = detectDividendInfo($ext);
        if (!emailAlertSignup) emailAlertSignup = detectEmailAlertSignup($ext);
        if (boardMembers.count === 0) boardMembers = detectBoardMembers($ext);
        if (!transferAgent) transferAgent = detectTransferAgent($ext);
        if (!stockIdentifiers.cusip && !stockIdentifiers.isin) stockIdentifiers = detectStockIdentifiers($ext);
        if (!upcomingEvents.found) upcomingEvents = detectUpcomingEvents($ext);
      }
    } catch { /* external domain unreachable — ignore */ }
  }

  // Store data
  // Use fully-qualified URL for external IR or subdomain pages
  const irPageUrl = bestIrPage
    ? (bestIrPage.path.includes('.') && !bestIrPage.path.startsWith('/'))
      ? `https://${bestIrPage.path}`   // subdomain probe path like "investors.etsy.com/"
      : `${baseUrl}${bestIrPage.path}` // standard path probe
    : null;
  data.ir_page_url = irPageUrl;
  data.sec_filings = secFilings;
  data.annual_report = annualReport;
  data.ticker_symbol = ticker.ticker;
  data.stock_exchange = ticker.exchange;
  data.esg_report = esgReport;
  data.ir_portal_depth = irPortalDepth;
  data.governance = governance;
  data.earnings_calls = earningsCalls;
  data.ir_contact_email = irContactEmail;
  data.external_ir_domain = externalIrDomain;
  data.proxy_statement = proxyStatement;
  data.investor_presentations = investorPresentations;
  data.dividend_info = dividendInfo;
  data.email_alert_signup = emailAlertSignup;
  data.board_members = boardMembers;
  data.transfer_agent = transferAgent;
  data.stock_identifiers = stockIdentifiers;
  data.upcoming_events = upcomingEvents;

  // ─── Build signals ──────────────────────────────────────────────────────

  if (bestIrPage) {
    signals.push(
      createSignal({
        type: 'ir_portal',
        name: 'Investor Relations Portal',
        confidence: 0.95,
        evidence: `IR portal found at ${irPageUrl}`,
        category: 'brand_presence',
      }),
    );
  }

  if (secFilings.found) {
    signals.push(
      createSignal({
        type: 'sec_filings',
        name: 'SEC Filings',
        confidence: 0.9,
        evidence: secFilings.evidence,
        category: 'brand_presence',
      }),
    );
  }

  if (ticker.ticker) {
    signals.push(
      createSignal({
        type: 'ticker_symbol',
        name: `Ticker: ${ticker.ticker}`,
        confidence: 0.85,
        evidence: `Stock ticker ${ticker.ticker}${ticker.exchange ? ` on ${ticker.exchange}` : ''} detected`,
        category: 'brand_presence',
      }),
    );
  }

  if (esgReport.found) {
    signals.push(
      createSignal({
        type: 'esg_report',
        name: 'ESG Report',
        confidence: 0.8,
        evidence: esgReport.evidence,
        category: 'brand_presence',
      }),
    );
  }

  if (governance.found) {
    signals.push(
      createSignal({
        type: 'corporate_governance',
        name: 'Corporate Governance',
        confidence: 0.85,
        evidence: governance.evidence,
        category: 'brand_presence',
      }),
    );
  }

  if (investorPresentations.found) {
    signals.push(
      createSignal({
        type: 'investor_presentations',
        name: 'Investor Presentations',
        confidence: 0.85,
        evidence: investorPresentations.evidence,
        category: 'brand_presence',
      }),
    );
  }

  if (dividendInfo.found) {
    signals.push(
      createSignal({
        type: 'dividend_info',
        name: 'Dividend Information',
        confidence: 0.8,
        evidence: dividendInfo.evidence,
        category: 'brand_presence',
      }),
    );
  }

  if (upcomingEvents.found) {
    signals.push(
      createSignal({
        type: 'investor_events',
        name: 'Investor Events',
        confidence: 0.8,
        evidence: upcomingEvents.evidence,
        category: 'brand_presence',
      }),
    );
  }

  // ─── Build checkpoints ──────────────────────────────────────────────────

  // CP1: IR portal (weight 4/10 = 0.4)
  if (bestIrPage && irPortalDepth === 'filings') {
    checkpoints.push(
      createCheckpoint({
        id: 'm18-ir-portal',
        name: 'IR portal',
        weight: 0.4,
        health: 'excellent',
        evidence: `Dedicated IR portal with filings at ${irPageUrl}`,
      }),
    );
  } else if (bestIrPage && irPortalDepth === 'basic') {
    checkpoints.push(
      createCheckpoint({
        id: 'm18-ir-portal',
        name: 'IR portal',
        weight: 0.4,
        health: 'warning',
        evidence: `IR page found at ${irPageUrl} with basic info only`,
        recommendation: 'Add SEC filings, financial data, and earnings information to the IR portal',
      }),
    );
  } else if (bestIrPage) {
    checkpoints.push(
      createCheckpoint({
        id: 'm18-ir-portal',
        name: 'IR portal',
        weight: 0.4,
        health: 'good',
        evidence: `IR page found at ${irPageUrl}`,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm18-ir-portal',
        'IR portal',
        'No investor relations page found (may be a private company)',
      ),
    );
  }

  // CP2: Financial data (weight 3/10 = 0.3)
  if (secFilings.found) {
    checkpoints.push(
      createCheckpoint({
        id: 'm18-financial-data',
        name: 'Financial data',
        weight: 0.3,
        health: 'excellent',
        evidence: secFilings.evidence,
      }),
    );
  } else if (annualReport.found) {
    checkpoints.push(
      createCheckpoint({
        id: 'm18-financial-data',
        name: 'Financial data',
        weight: 0.3,
        health: 'good',
        evidence: annualReport.evidence,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm18-financial-data',
        'Financial data',
        'No SEC filings or annual reports detected',
      ),
    );
  }

  // CP3: Ticker symbol (weight 2/10 = 0.2, informational)
  checkpoints.push(
    infoCheckpoint(
      'm18-ticker-symbol',
      'Ticker symbol',
      ticker.ticker
        ? `Stock ticker: ${ticker.ticker}${ticker.exchange ? ` (${ticker.exchange})` : ''}`
        : 'No stock ticker detected (may be a private company)',
    ),
  );

  // CP4: ESG report (weight 2/10 = 0.2)
  if (esgReport.found) {
    checkpoints.push(
      createCheckpoint({
        id: 'm18-esg-report',
        name: 'ESG report',
        weight: 0.2,
        health: 'excellent',
        evidence: esgReport.evidence,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm18-esg-report',
        'ESG report',
        'No ESG or sustainability report detected',
      ),
    );
  }

  // CP5: Governance depth (weight 3/10 = 0.3)
  if (governance.found && proxyStatement.found) {
    checkpoints.push(
      createCheckpoint({
        id: 'm18-governance',
        name: 'Governance',
        weight: 0.3,
        health: 'excellent',
        evidence: `${governance.evidence}; proxy statement available`,
      }),
    );
  } else if (governance.found) {
    checkpoints.push(
      createCheckpoint({
        id: 'm18-governance',
        name: 'Governance',
        weight: 0.3,
        health: 'good',
        evidence: governance.evidence,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm18-governance',
        'Governance',
        'No corporate governance content detected',
      ),
    );
  }

  // CP6: Investor communications (weight 2/10 = 0.2)
  const commsScore = [earningsCalls.found, investorPresentations.found, emailAlertSignup, upcomingEvents.found].filter(Boolean).length;
  if (commsScore >= 3) {
    checkpoints.push(
      createCheckpoint({
        id: 'm18-ir-comms',
        name: 'IR communications',
        weight: 0.2,
        health: 'excellent',
        evidence: `Rich IR communications: earnings calls, presentations, events, email alerts`,
      }),
    );
  } else if (commsScore >= 1) {
    checkpoints.push(
      createCheckpoint({
        id: 'm18-ir-comms',
        name: 'IR communications',
        weight: 0.2,
        health: 'good',
        evidence: `IR communications detected: ${[earningsCalls.found && 'earnings calls', investorPresentations.found && 'presentations', emailAlertSignup && 'email alerts', upcomingEvents.found && 'events'].filter(Boolean).join(', ')}`,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm18-ir-comms',
        'IR communications',
        'No earnings calls, presentations, or investor events detected',
      ),
    );
  }

  return {
    moduleId: 'M18' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null, // calculated by runner from checkpoints
    checkpoints,
    duration: 0, // set by runner
  };
};

// ─── Register ───────────────────────────────────────────────────────────────
export { execute };
registerModuleExecutor('M18' as ModuleId, execute);
