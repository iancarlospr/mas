import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext, ModuleExecuteFn } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { fetchWithRetry } from '../../utils/http.js';
import { normalizeUrl } from '../../utils/url.js';
import { parseHtml, extractLinks } from '../../utils/html.js';
import type { CheerioAPI } from '../../utils/html.js';
import { detectPageLanguage } from '../../utils/i18n-probes.js';
import * as cheerio from 'cheerio';

// ─── Helpers ────────────────────────────────────────────────────────────────

interface ProbeResult {
  path: string;
  found: boolean;
  html?: string;
  status?: number;
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

// ─── Module execute function ────────────────────────────────────────────────

const execute: ModuleExecuteFn = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const baseUrl = normalizeUrl(ctx.url);

  // Detect page language
  const lang = ctx.html ? detectPageLanguage(ctx.html) : 'en';
  data.detected_language = lang;

  // Use pre-rendered sitemap pages from runner
  const foundPages: ProbeResult[] = [];

  for (const page of ctx.sitemapPages?.ir ?? []) {
    foundPages.push({ path: page.path, found: true, html: page.html, status: 200 });
  }

  data.found_pages = foundPages.map((p) => p.path);

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
