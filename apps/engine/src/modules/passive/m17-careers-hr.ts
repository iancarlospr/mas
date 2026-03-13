import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext, ModuleExecuteFn } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { normalizeUrl } from '../../utils/url.js';
import { parseHtml, extractLinks, extractScriptSrcs } from '../../utils/html.js';
import type { CheerioAPI } from '../../utils/html.js';
import { detectPageLanguage } from '../../utils/i18n-probes.js';
import * as cheerio from 'cheerio';

// ─── ATS providers ──────────────────────────────────────────────────────────
const ATS_PROVIDERS: { name: string; patterns: RegExp[] }[] = [
  { name: 'Greenhouse', patterns: [/greenhouse\.io/i, /boards\.greenhouse\.io/i] },
  { name: 'Lever', patterns: [/lever\.co/i, /jobs\.lever\.co/i] },
  { name: 'Workday', patterns: [/workday\.com/i, /myworkdayjobs\.com/i] },
  { name: 'BambooHR', patterns: [/bamboohr\.com/i] },
  { name: 'Ashby', patterns: [/ashbyhq\.com/i] },
  { name: 'iCIMS', patterns: [/icims\.com/i] },
  { name: 'Recruitee', patterns: [/recruitee\.com/i] },
  { name: 'Jobvite', patterns: [/jobvite\.com/i] },
  { name: 'SmartRecruiters', patterns: [/smartrecruiters\.com/i] },
  { name: 'Breezy HR', patterns: [/breezy\.hr/i] },
  { name: 'Workable', patterns: [/workable\.com/i, /apply\.workable\.com/i] },
  { name: 'JazzHR', patterns: [/jazzy?hr\.com/i, /app\.jazz\.co/i] },
  { name: 'Rippling', patterns: [/rippling\.com/i] },
  { name: 'Personio', patterns: [/personio\.de/i, /personio\.com/i] },
  { name: 'Taleo', patterns: [/taleo\.net/i] },
  { name: 'SuccessFactors', patterns: [/successfactors\.com/i] },
  { name: 'LinkedIn Jobs', patterns: [/linkedin\.com\/jobs/i] },
  { name: 'Indeed', patterns: [/indeed\.com/i] },
  { name: 'Wellfound', patterns: [/wellfound\.com/i, /angel\.co\/company/i] },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

interface ProbeResult {
  path: string;
  found: boolean;
  html?: string;
  status?: number;
}

/**
 * Detect ATS provider from HTML by inspecting iframes, script srcs, and link hrefs.
 */
function detectAtsProvider($: CheerioAPI): { name: string; evidence: string } | null {
  const htmlContent = $.html().toLowerCase();
  const scriptSrcs = extractScriptSrcs($);
  const links = extractLinks($);

  // Check iframes
  const iframeSrcs: string[] = [];
  $('iframe[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) iframeSrcs.push(src);
  });

  // Combine all URLs to check
  const allUrls = [
    ...scriptSrcs,
    ...iframeSrcs,
    ...links.map((l) => l.href),
  ];

  for (const provider of ATS_PROVIDERS) {
    for (const pattern of provider.patterns) {
      // Check URLs
      for (const url of allUrls) {
        if (pattern.test(url)) {
          return { name: provider.name, evidence: `${provider.name} detected via URL: ${url}` };
        }
      }
      // Check raw HTML for embedded references
      if (pattern.test(htmlContent)) {
        return { name: provider.name, evidence: `${provider.name} reference found in page HTML` };
      }
    }
  }

  return null;
}

/**
 * Count open positions listed on a careers page.
 */
function countOpenPositions($: CheerioAPI): number {
  let count = 0;

  // Common job listing selectors
  const selectors = [
    '.job-listing',
    '.job-post',
    '.job-opening',
    '.open-position',
    '.career-listing',
    '.position-listing',
    '[data-job]',
    'li.job',
    '.posting',
    '.opening',
  ];

  for (const selector of selectors) {
    const found = $(selector).length;
    if (found > 0) {
      count = Math.max(count, found);
    }
  }

  // Fallback: count links containing common job-related patterns
  if (count === 0) {
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const text = $(el).text().trim().toLowerCase();
      if (
        /\/jobs?(?:\/|\?|$)/i.test(href) ||
        /\/positions?(?:\/|\?|$)/i.test(href) ||
        /\/openings?(?:\/|\?|$)/i.test(href) ||
        /\/careers\/jobs/i.test(href) ||
        /apply\s*(now)?$/i.test(text)
      ) {
        count++;
      }
    });
  }

  return count;
}

/**
 * Find the most recent job posting date.
 */
function findMostRecentPostingDate($: CheerioAPI): Date | null {
  let mostRecent: Date | null = null;

  const selectors = [
    'time[datetime]',
    '.date',
    '.posted-date',
    '.post-date',
    '.job-date',
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const elem = $(el);
      const datetime = elem.attr('datetime');
      const text = datetime ?? elem.text().trim();
      const date = parseDateFromText(text);
      if (date && (!mostRecent || date > mostRecent)) {
        mostRecent = date;
      }
    });
  }

  return mostRecent;
}

function parseDateFromText(text: string): Date | null {
  const patterns = [
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const date = new Date(match[0]);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  return null;
}

/**
 * Detect team/culture page indicators.
 */
function detectTeamCultureContent($: CheerioAPI, path: string): { hasTeam: boolean; hasCulture: boolean } {
  const bodyText = $('body').text().toLowerCase();
  const hasTeamPath = /\/team/i.test(path) || /\/about\/team/i.test(path);
  const hasCulturePath = /\/culture/i.test(path);

  const hasTeamContent = hasTeamPath ||
    $('h1, h2, h3').filter((_, el) => /\b(our team|meet the team|leadership|our people)\b/i.test($(el).text())).length > 0;

  const hasCultureContent = hasCulturePath ||
    $('h1, h2, h3').filter((_, el) => /\b(our culture|company culture|values|our values|life at)\b/i.test($(el).text())).length > 0;

  return { hasTeam: hasTeamContent, hasCulture: hasCultureContent };
}

/**
 * Detect external careers subdomains (careers.company.com, jobs.company.com).
 */
function detectExternalCareersLinks($: CheerioAPI, domain: string): string[] {
  const externalLinks = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    try {
      const url = new URL(href, `https://${domain}`);
      if (url.hostname !== domain && url.hostname.endsWith(domain)) {
        if (/careers|jobs|talent|hiring/i.test(url.hostname)) {
          externalLinks.add(url.href);
        }
      }
      // Also catch ATS board links
      if (/greenhouse\.io|lever\.co|workday\.com|ashbyhq\.com|smartrecruiters\.com|workable\.com/i.test(url.hostname)) {
        externalLinks.add(url.href);
      }
    } catch { /* ignore malformed URLs */ }
  });
  return [...externalLinks];
}

/**
 * Detect employer branding signals: benefits, remote work, DEI, reviews.
 */
function detectEmployerBranding($: CheerioAPI): {
  benefits: boolean;
  remoteWork: boolean;
  dei: boolean;
  reviewLinks: string[];
} {
  const bodyText = $('body').text().toLowerCase();
  const result = {
    benefits: false,
    remoteWork: false,
    dei: false,
    reviewLinks: [] as string[],
  };

  // Benefits keywords
  if (/\b(benefits|perks|compensation|health insurance|401k|equity|stock options|pto|paid time off|wellness)\b/i.test(bodyText)) {
    result.benefits = true;
  }

  // Remote work
  if (/\b(remote|hybrid|work from home|distributed|flexible work|remote-first)\b/i.test(bodyText)) {
    result.remoteWork = true;
  }

  // DEI
  if (/\b(diversity|equity|inclusion|dei|belonging|equal opportunity|underrepresented)\b/i.test(bodyText)) {
    result.dei = true;
  }

  // Review site links (Glassdoor, Indeed, LinkedIn)
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (/glassdoor\.com|indeed\.com\/cmp|linkedin\.com\/company/i.test(href)) {
      result.reviewLinks.push(href);
    }
  });
  result.reviewLinks = [...new Set(result.reviewLinks)];

  return result;
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

  for (const page of ctx.sitemapPages?.careers ?? []) {
    foundPages.push({ path: page.path, found: true, html: page.html, status: 200 });
  }

  data.found_pages = foundPages.map((p) => p.path);

  // 3. Analyze found pages
  let bestCareersPage: ProbeResult | null = null;
  let atsDetected: { name: string; evidence: string } | null = null;
  let totalOpenPositions = 0;
  let hasTeamPage = false;
  let hasCulturePage = false;
  let mostRecentPosting: Date | null = null;

  for (const page of foundPages) {
    if (!page.html) continue;

    const $ = parseHtml(page.html);

    // Use the first /careers or /jobs page as primary
    if (!bestCareersPage && (page.path === '/careers' || page.path === '/jobs')) {
      bestCareersPage = page;
    } else if (!bestCareersPage) {
      bestCareersPage = page;
    }

    // Detect ATS provider
    if (!atsDetected) {
      atsDetected = detectAtsProvider($);
    }

    // Count open positions
    const positions = countOpenPositions($);
    totalOpenPositions = Math.max(totalOpenPositions, positions);

    // Detect team/culture content
    const teamCulture = detectTeamCultureContent($, page.path);
    if (teamCulture.hasTeam) hasTeamPage = true;
    if (teamCulture.hasCulture) hasCulturePage = true;

    // Find most recent posting date
    const postingDate = findMostRecentPostingDate($);
    if (postingDate && (!mostRecentPosting || postingDate > mostRecentPosting)) {
      mostRecentPosting = postingDate;
    }
  }

  // 4. Detect external careers links and employer branding across all pages
  let externalCareersLinks: string[] = [];
  let branding = { benefits: false, remoteWork: false, dei: false, reviewLinks: [] as string[] };
  const domain = new URL(baseUrl).hostname.replace(/^www\./, '');

  for (const page of foundPages) {
    if (!page.html) continue;
    const $ = parseHtml(page.html);
    externalCareersLinks.push(...detectExternalCareersLinks($, domain));
    const pageBranding = detectEmployerBranding($);
    if (pageBranding.benefits) branding.benefits = true;
    if (pageBranding.remoteWork) branding.remoteWork = true;
    if (pageBranding.dei) branding.dei = true;
    branding.reviewLinks.push(...pageBranding.reviewLinks);
  }
  // Also check main page
  if (ctx.html) {
    const $m = parseHtml(ctx.html);
    externalCareersLinks.push(...detectExternalCareersLinks($m, domain));
    const mainBranding = detectEmployerBranding($m);
    if (mainBranding.benefits) branding.benefits = true;
    if (mainBranding.remoteWork) branding.remoteWork = true;
    if (mainBranding.dei) branding.dei = true;
    branding.reviewLinks.push(...mainBranding.reviewLinks);
  }
  externalCareersLinks = [...new Set(externalCareersLinks)];
  branding.reviewLinks = [...new Set(branding.reviewLinks)];

  // If external ATS links found but no ATS detected, infer from the URL
  if (!atsDetected && externalCareersLinks.length > 0) {
    for (const link of externalCareersLinks) {
      for (const provider of ATS_PROVIDERS) {
        for (const pattern of provider.patterns) {
          if (pattern.test(link)) {
            atsDetected = { name: provider.name, evidence: `${provider.name} detected via external link: ${link}` };
            break;
          }
        }
        if (atsDetected) break;
      }
      if (atsDetected) break;
    }
  }

  // Fallback: infer ATS from M01 SPF record (DRY — reuses DNS data)
  if (!atsDetected && ctx.previousResults) {
    const m01 = ctx.previousResults.get('M01' as ModuleId);
    const spf = (m01?.data as Record<string, unknown>)?.spf as string | undefined;
    if (spf) {
      const SPF_ATS_HINTS: Array<{ pattern: RegExp; name: string }> = [
        { pattern: /greenhouse/i, name: 'Greenhouse' },
        { pattern: /lever/i, name: 'Lever' },
        { pattern: /ashbyhq/i, name: 'Ashby' },
        { pattern: /smartrecruiters/i, name: 'SmartRecruiters' },
      ];
      for (const { pattern, name } of SPF_ATS_HINTS) {
        if (pattern.test(spf)) {
          atsDetected = { name, evidence: `${name} detected via SPF include in DNS record` };
          break;
        }
      }
    }
  }

  // Store data
  // Use fully-qualified URL for external/subdomain career pages
  const careersPageUrl = bestCareersPage
    ? (bestCareersPage.path.includes('.') && !bestCareersPage.path.startsWith('/'))
      ? `https://${bestCareersPage.path}`   // subdomain probe path like "careers.samsung.com/"
      : `${baseUrl}${bestCareersPage.path}` // standard path probe
    : null;
  data.careers_page_url = careersPageUrl;
  data.ats_provider = atsDetected?.name ?? null;
  data.ats_evidence = atsDetected?.evidence ?? null;
  data.open_positions_count = totalOpenPositions;
  data.has_team_page = hasTeamPage;
  data.has_culture_page = hasCulturePage;
  data.most_recent_posting = mostRecentPosting?.toISOString() ?? null;
  data.external_careers_links = externalCareersLinks;
  data.benefits_mentioned = branding.benefits;
  data.remote_work_mentioned = branding.remoteWork;
  data.dei_mentioned = branding.dei;
  data.review_site_links = branding.reviewLinks;

  // ─── Build signals ──────────────────────────────────────────────────────

  if (bestCareersPage) {
    signals.push(
      createSignal({
        type: 'careers_page',
        name: 'Careers Page',
        confidence: 0.95,
        evidence: `Careers page found at ${baseUrl}${bestCareersPage.path}`,
        category: 'brand_presence',
      }),
    );
  }

  if (atsDetected) {
    signals.push(
      createSignal({
        type: 'ats_provider',
        name: atsDetected.name,
        confidence: 0.9,
        evidence: atsDetected.evidence,
        category: 'brand_presence',
      }),
    );
  }

  if (totalOpenPositions > 0) {
    signals.push(
      createSignal({
        type: 'open_positions',
        name: 'Open Positions',
        confidence: 0.7,
        evidence: `Approximately ${totalOpenPositions} open position(s) detected`,
        category: 'brand_presence',
      }),
    );
  }

  if (hasTeamPage) {
    signals.push(
      createSignal({
        type: 'team_page',
        name: 'Team Page',
        confidence: 0.85,
        evidence: 'Team page or section detected',
        category: 'brand_presence',
      }),
    );
  }

  if (hasCulturePage) {
    signals.push(
      createSignal({
        type: 'culture_page',
        name: 'Culture Page',
        confidence: 0.85,
        evidence: 'Culture page or section detected',
        category: 'brand_presence',
      }),
    );
  }

  // ─── Build checkpoints ──────────────────────────────────────────────────

  // CP1: Careers page (weight 4/10 = 0.4)
  if (bestCareersPage && totalOpenPositions > 0) {
    checkpoints.push(
      createCheckpoint({
        id: 'm17-careers-page',
        name: 'Careers page',
        weight: 0.4,
        health: 'excellent',
        evidence: `Dedicated careers page with ${totalOpenPositions} open position(s) at ${bestCareersPage.path}`,
      }),
    );
  } else if (bestCareersPage) {
    const bodyText = bestCareersPage.html ? parseHtml(bestCareersPage.html)('body').text().toLowerCase() : '';
    const hasAnyListings = bodyText.includes('apply') || bodyText.includes('position') || bodyText.includes('opening');
    if (hasAnyListings) {
      checkpoints.push(
        createCheckpoint({
          id: 'm17-careers-page',
          name: 'Careers page',
          weight: 0.4,
          health: 'good',
          evidence: `Careers page found at ${bestCareersPage.path}`,
        }),
      );
    } else {
      checkpoints.push(
        createCheckpoint({
          id: 'm17-careers-page',
          name: 'Careers page',
          weight: 0.4,
          health: 'warning',
          evidence: `Careers page found at ${bestCareersPage.path} but no active listings detected`,
          recommendation: 'Add open positions or a clear hiring message to the careers page',
        }),
      );
    }
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm17-careers-page',
        'Careers page',
        'No dedicated careers page found',
      ),
    );
  }

  // CP2: ATS provider (weight 3/10 = 0.3)
  const professionalAts = ['Greenhouse', 'Lever', 'Ashby', 'Workday', 'SmartRecruiters'];
  if (atsDetected && professionalAts.includes(atsDetected.name)) {
    checkpoints.push(
      createCheckpoint({
        id: 'm17-ats-provider',
        name: 'ATS provider',
        weight: 0.3,
        health: 'excellent',
        evidence: `Professional ATS detected: ${atsDetected.name}`,
      }),
    );
  } else if (atsDetected) {
    checkpoints.push(
      createCheckpoint({
        id: 'm17-ats-provider',
        name: 'ATS provider',
        weight: 0.3,
        health: 'good',
        evidence: `ATS detected: ${atsDetected.name}`,
      }),
    );
  } else if (bestCareersPage && totalOpenPositions > 0) {
    checkpoints.push(
      createCheckpoint({
        id: 'm17-ats-provider',
        name: 'ATS provider',
        weight: 0.3,
        health: 'warning',
        evidence: 'Job listings appear to be manually managed (no ATS detected)',
        recommendation: 'Consider using a professional ATS for better candidate management',
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm17-ats-provider',
        'ATS provider',
        'No ATS provider detected',
      ),
    );
  }

  // CP3: Open positions (weight 2/10 = 0.2, informational)
  checkpoints.push(
    infoCheckpoint(
      'm17-open-positions',
      'Open positions',
      totalOpenPositions > 0
        ? `${totalOpenPositions} open position(s) detected`
        : 'No open positions detected',
    ),
  );

  // CP4: Team/culture page (weight 3/10 = 0.3)
  if (hasTeamPage && hasCulturePage) {
    checkpoints.push(
      createCheckpoint({
        id: 'm17-team-culture',
        name: 'Team/culture page',
        weight: 0.3,
        health: 'excellent',
        evidence: 'Both team and culture pages/sections detected',
      }),
    );
  } else if (hasTeamPage || hasCulturePage) {
    checkpoints.push(
      createCheckpoint({
        id: 'm17-team-culture',
        name: 'Team/culture page',
        weight: 0.3,
        health: 'good',
        evidence: `${hasTeamPage ? 'Team' : 'Culture'} page detected`,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm17-team-culture',
        'Team/culture page',
        'No team or culture page detected',
      ),
    );
  }

  // CP5: Hiring velocity (weight 2/10 = 0.2)
  if (mostRecentPosting) {
    const daysAgo = (Date.now() - mostRecentPosting.getTime()) / (1000 * 60 * 60 * 24);
    const dateStr = mostRecentPosting.toISOString().slice(0, 10);

    if (daysAgo <= 30) {
      checkpoints.push(
        createCheckpoint({
          id: 'm17-hiring-velocity',
          name: 'Hiring velocity',
          weight: 0.2,
          health: 'excellent',
          evidence: `Recent job postings (last: ${dateStr})`,
        }),
      );
    } else if (daysAgo <= 90) {
      checkpoints.push(
        createCheckpoint({
          id: 'm17-hiring-velocity',
          name: 'Hiring velocity',
          weight: 0.2,
          health: 'good',
          evidence: `Job postings within 90 days (last: ${dateStr})`,
        }),
      );
    } else if (daysAgo <= 180) {
      checkpoints.push(
        createCheckpoint({
          id: 'm17-hiring-velocity',
          name: 'Hiring velocity',
          weight: 0.2,
          health: 'warning',
          evidence: `Job postings are stale (>6 months, last: ${dateStr})`,
          recommendation: 'Update job listings or remove stale postings',
        }),
      );
    } else {
      checkpoints.push(
        infoCheckpoint(
          'm17-hiring-velocity',
          'Hiring velocity',
          `Very old job postings (last: ${dateStr})`,
        ),
      );
    }
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm17-hiring-velocity',
        'Hiring velocity',
        'No dateable job postings found',
      ),
    );
  }

  return {
    moduleId: 'M17' as ModuleId,
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
registerModuleExecutor('M17' as ModuleId, execute);
