import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext, ModuleExecuteFn } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { fetchWithRetry } from '../../utils/http.js';
import { normalizeUrl } from '../../utils/url.js';
import { parseHtml, extractLinks, extractScriptSrcs } from '../../utils/html.js';
import type { CheerioAPI } from '../../utils/html.js';
import * as cheerio from 'cheerio';

// ─── Probe paths ────────────────────────────────────────────────────────────
const CAREERS_PATHS = ['/careers', '/jobs', '/join-us', '/about/team', '/team', '/culture'];

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
];

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
        /\/jobs?\//i.test(href) ||
        /\/positions?\//i.test(href) ||
        /\/openings?\//i.test(href) ||
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
 * Check the main page HTML for nav/footer links to careers-related pages.
 */
function findCareersLinksInMainPage($: CheerioAPI): string[] {
  const careersLinks: string[] = [];
  const keywords = ['careers', 'jobs', 'join us', 'join our team', 'we\'re hiring', 'work with us'];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim().toLowerCase();

    for (const keyword of keywords) {
      if (text.includes(keyword) || href.toLowerCase().includes(`/${keyword.replace(/\s+/g, '-')}`)) {
        careersLinks.push(href);
        break;
      }
    }
  });

  return [...new Set(careersLinks)];
}

// ─── Module execute function ────────────────────────────────────────────────

const execute: ModuleExecuteFn = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const baseUrl = normalizeUrl(ctx.url);

  // 1. Check the main page for careers-related links
  let mainPageCareersLinks: string[] = [];
  if (ctx.html) {
    const $main = parseHtml(ctx.html);
    mainPageCareersLinks = findCareersLinksInMainPage($main);
  }

  // 2. Probe known careers paths
  const probeResults = await Promise.allSettled(
    CAREERS_PATHS.map((path) => probePath(baseUrl, path)),
  );

  const foundPages: ProbeResult[] = [];
  for (const result of probeResults) {
    if (result.status === 'fulfilled' && result.value.found) {
      foundPages.push(result.value);
    }
  }

  data.probed_paths = CAREERS_PATHS;
  data.found_pages = foundPages.map((p) => p.path);
  data.main_page_careers_links = mainPageCareersLinks;

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

  // Store data
  data.careers_page_url = bestCareersPage ? `${baseUrl}${bestCareersPage.path}` : null;
  data.ats_provider = atsDetected?.name ?? null;
  data.ats_evidence = atsDetected?.evidence ?? null;
  data.open_positions_count = totalOpenPositions;
  data.has_team_page = hasTeamPage;
  data.has_culture_page = hasCulturePage;
  data.most_recent_posting = mostRecentPosting?.toISOString() ?? null;

  // ─── Build signals ──────────────────────────────────────────────────────

  if (bestCareersPage) {
    signals.push(
      createSignal({
        type: 'careers_page',
        name: 'Careers Page',
        confidence: 0.95,
        evidence: `Careers page found at ${baseUrl}${bestCareersPage.path}`,
        category: 'digital_presence',
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
        category: 'digital_presence',
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
        category: 'digital_presence',
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
        category: 'digital_presence',
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
        category: 'digital_presence',
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
registerModuleExecutor('M17' as ModuleId, execute);
