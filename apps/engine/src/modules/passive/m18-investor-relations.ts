import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext, ModuleExecuteFn } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { fetchWithRetry } from '../../utils/http.js';
import { normalizeUrl } from '../../utils/url.js';
import { parseHtml, extractLinks } from '../../utils/html.js';
import type { CheerioAPI } from '../../utils/html.js';
import * as cheerio from 'cheerio';

// ─── Probe paths ────────────────────────────────────────────────────────────
const IR_PATHS = ['/investors', '/ir', '/investor-relations', '/sec-filings', '/annual-report'];

// ─── Helpers ────────────────────────────────────────────────────────────────

interface ProbeResult {
  path: string;
  found: boolean;
  html?: string;
  status?: number;
}

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

  // Common patterns for ticker display: "NYSE: AAPL", "NASDAQ: GOOGL", "Stock: MSFT"
  const tickerPatterns = [
    /(?:NYSE|NASDAQ|AMEX|TSX|LSE|ASX)\s*:\s*([A-Z]{1,5})/i,
    /\b(?:ticker|stock)\s*(?:symbol)?\s*:\s*([A-Z]{1,5})\b/i,
    /\$([A-Z]{1,5})\b/,
  ];

  for (const pattern of tickerPatterns) {
    const match = bodyText.match(pattern);
    if (match) {
      // Determine exchange if available
      const exchangeMatch = bodyText.match(/(NYSE|NASDAQ|AMEX|TSX|LSE|ASX)/i);
      return {
        ticker: match[1] ?? null,
        exchange: exchangeMatch?.[1] ? exchangeMatch[1].toUpperCase() : null,
      };
    }
  }

  // Also check meta tags for stock ticker
  const metaTicker = $('meta[name="ticker"]').attr('content')
    ?? $('meta[property="stock:ticker"]').attr('content');
  if (metaTicker) {
    return { ticker: metaTicker, exchange: null };
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
 * Check the main page HTML for nav/footer links to IR-related pages.
 */
function findIrLinksInMainPage($: CheerioAPI): string[] {
  const irLinks: string[] = [];
  const keywords = ['investors', 'investor relations', 'ir', 'stockholders', 'shareholders'];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim().toLowerCase();

    for (const keyword of keywords) {
      if (text === keyword || text.includes(keyword) || href.toLowerCase().includes(`/${keyword.replace(/\s+/g, '-')}`)) {
        irLinks.push(href);
        break;
      }
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

  // 1. Check the main page for IR-related links
  let mainPageIrLinks: string[] = [];
  if (ctx.html) {
    const $main = parseHtml(ctx.html);
    mainPageIrLinks = findIrLinksInMainPage($main);
  }

  // 2. Probe known IR paths
  const probeResults = await Promise.allSettled(
    IR_PATHS.map((path) => probePath(baseUrl, path)),
  );

  const foundPages: ProbeResult[] = [];
  for (const result of probeResults) {
    if (result.status === 'fulfilled' && result.value.found) {
      foundPages.push(result.value);
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

  // Also check the main page for ticker symbol if not found in IR pages
  if (!ticker.ticker && ctx.html) {
    const $main = parseHtml(ctx.html);
    ticker = detectTickerSymbol($main);
  }

  // Store data
  data.ir_page_url = bestIrPage ? `${baseUrl}${bestIrPage.path}` : null;
  data.sec_filings = secFilings;
  data.annual_report = annualReport;
  data.ticker_symbol = ticker.ticker;
  data.stock_exchange = ticker.exchange;
  data.esg_report = esgReport;
  data.ir_portal_depth = irPortalDepth;

  // ─── Build signals ──────────────────────────────────────────────────────

  if (bestIrPage) {
    signals.push(
      createSignal({
        type: 'ir_portal',
        name: 'Investor Relations Portal',
        confidence: 0.95,
        evidence: `IR portal found at ${baseUrl}${bestIrPage.path}`,
        category: 'digital_presence',
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
        category: 'digital_presence',
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
        category: 'digital_presence',
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
        category: 'digital_presence',
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
        evidence: `Dedicated IR portal with filings at ${bestIrPage.path}`,
      }),
    );
  } else if (bestIrPage && irPortalDepth === 'basic') {
    checkpoints.push(
      createCheckpoint({
        id: 'm18-ir-portal',
        name: 'IR portal',
        weight: 0.4,
        health: 'warning',
        evidence: `IR page found at ${bestIrPage.path} with basic info only`,
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
        evidence: `IR page found at ${bestIrPage.path}`,
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
registerModuleExecutor('M18' as ModuleId, execute);
