import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext, ModuleExecuteFn } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { fetchWithRetry } from '../../utils/http.js';
import { normalizeUrl } from '../../utils/url.js';
import { parseHtml, extractLinks, extractScriptSrcs } from '../../utils/html.js';
import type { CheerioAPI } from '../../utils/html.js';
import { detectPageLanguage, expandProbePaths, getMultilingualKeywords } from '../../utils/i18n-probes.js';
import * as cheerio from 'cheerio';

// ─── Probe paths (English base — expanded at runtime via i18n-probes) ───────
const SUPPORT_PATHS_BASE = [
  '/support', '/help', '/help-center', '/knowledge-base', '/status',
  '/community', '/contact', '/faq', '/docs', '/documentation',
  '/developers', '/api', '/academy', '/training', '/getting-started',
  '/resources/support', '/customer-support',
] as const;

const SUPPORT_LINK_KEYWORDS_BASE = [
  'support', 'help', 'help center', 'knowledge base', 'contact', 'community',
] as const;

// ─── Help center providers ──────────────────────────────────────────────────
const HELP_CENTER_PROVIDERS: { name: string; patterns: RegExp[] }[] = [
  { name: 'Zendesk', patterns: [/zendesk\.com/i, /zdassets\.com/i, /zopim\.com/i] },
  { name: 'Intercom', patterns: [/intercom\.io/i, /intercomcdn\.com/i, /widget\.intercom\.io/i] },
  { name: 'Freshdesk', patterns: [/freshdesk\.com/i, /freshworks\.com/i] },
  { name: 'Help Scout', patterns: [/helpscout\.com/i, /helpscout\.net/i, /beacon-v2\.helpscout/i] },
  { name: 'Notion', patterns: [/notion\.so/i, /notion\.site/i] },
  { name: 'GitBook', patterns: [/gitbook\.io/i, /gitbook\.com/i] },
  { name: 'ReadMe', patterns: [/readme\.io/i, /readme\.com/i] },
  { name: 'Crisp', patterns: [/crisp\.chat/i] },
  { name: 'Drift', patterns: [/drift\.com/i, /driftt\.com/i] },
  { name: 'HubSpot Knowledge Base', patterns: [/knowledge\.hubspot\.com/i, /hs-scripts\.com.*knowledge/i] },
  { name: 'Zoho Desk', patterns: [/zoho\.com.*desk/i, /zohodesk\.com/i] },
  { name: 'Kayako', patterns: [/kayako\.com/i] },
];

// ─── Status page providers ──────────────────────────────────────────────────
const STATUS_PAGE_PROVIDERS: { name: string; patterns: RegExp[] }[] = [
  { name: 'Atlassian Statuspage', patterns: [/statuspage\.io/i, /atlassian.*statuspage/i] },
  { name: 'Instatus', patterns: [/instatus\.com/i] },
  { name: 'Cachet', patterns: [/cachethq\.io/i] },
  { name: 'BetterUptime', patterns: [/betteruptime\.com/i, /betterstack\.com/i] },
  { name: 'UptimeRobot', patterns: [/uptimerobot\.com/i] },
  { name: 'Checkly', patterns: [/checklyhq\.com/i] },
  { name: 'Sorry', patterns: [/sorryapp\.com/i] },
];

// ─── Community providers ────────────────────────────────────────────────────
const COMMUNITY_PROVIDERS: { name: string; patterns: RegExp[] }[] = [
  { name: 'Discourse', patterns: [/discourse\.org/i, /discourse\.com/i] },
  { name: 'Circle', patterns: [/circle\.so/i] },
  { name: 'Tribe', patterns: [/tribe\.so/i, /bettermode\.com/i] },
  { name: 'Slack Community', patterns: [/slack\.com\/.*community/i] },
  { name: 'Discord', patterns: [/discord\.gg/i, /discord\.com\/invite/i] },
  { name: 'GitHub Discussions', patterns: [/github\.com\/.*discussions/i] },
  { name: 'Reddit', patterns: [/reddit\.com\/r\//i] },
  { name: 'Khoros', patterns: [/khoros\.com/i, /lithium\.com/i] },
  { name: 'Vanilla Forums', patterns: [/vanillaforums\.com/i] },
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
      // Reject catch-all redirects to homepage that contain no support content
      const finalUrl = new URL(result.finalUrl);
      if (finalUrl.pathname === '/' && path !== '/') {
        const bodyLower = result.body.toLowerCase();
        const supportSignals = ['support', 'help center', 'knowledge base', 'contact us',
          'faq', 'documentation', 'getting started', 'customer service', 'help desk'];
        const hits = supportSignals.filter(kw => bodyLower.includes(kw)).length;
        if (hits < 1) return { path, found: false, status: result.status };
      }
      return { path, found: true, html: result.body, status: result.status };
    }
    return { path, found: false, status: result.status };
  } catch {
    return { path, found: false };
  }
}

/**
 * Detect help center provider from HTML.
 */
function detectHelpCenterProvider(
  $: CheerioAPI,
): { name: string; evidence: string } | null {
  const htmlContent = $.html();
  const scriptSrcs = extractScriptSrcs($);
  const links = extractLinks($);

  // Check iframes
  const iframeSrcs: string[] = [];
  $('iframe[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) iframeSrcs.push(src);
  });

  const allUrls = [
    ...scriptSrcs,
    ...iframeSrcs,
    ...links.map((l) => l.href),
  ];

  for (const provider of HELP_CENTER_PROVIDERS) {
    for (const pattern of provider.patterns) {
      for (const url of allUrls) {
        if (pattern.test(url)) {
          return { name: provider.name, evidence: `${provider.name} detected via URL: ${url.slice(0, 120)}` };
        }
      }
      if (pattern.test(htmlContent)) {
        return { name: provider.name, evidence: `${provider.name} reference found in page HTML` };
      }
    }
  }

  return null;
}

/**
 * Detect status page by checking links and probing common status subdomains.
 */
function detectStatusPageFromHtml(
  $: CheerioAPI,
): { provider: string | null; url: string | null; evidence: string } {
  const links = extractLinks($);
  const htmlContent = $.html();

  // Check links for status page URLs
  for (const link of links) {
    const href = link.href.toLowerCase();
    const text = link.text.toLowerCase();

    if (/status/i.test(text) || /status\./i.test(href)) {
      // Check against known providers
      for (const provider of STATUS_PAGE_PROVIDERS) {
        for (const pattern of provider.patterns) {
          if (pattern.test(href)) {
            return { provider: provider.name, url: link.href, evidence: `${provider.name} status page: ${link.href}` };
          }
        }
      }
      // Generic status page link
      return { provider: null, url: link.href, evidence: `Status page link found: ${link.href}` };
    }
  }

  // Check HTML for status page provider references
  for (const provider of STATUS_PAGE_PROVIDERS) {
    for (const pattern of provider.patterns) {
      if (pattern.test(htmlContent)) {
        return { provider: provider.name, url: null, evidence: `${provider.name} reference found in HTML` };
      }
    }
  }

  return { provider: null, url: null, evidence: 'No status page detected' };
}

/**
 * Detect community forum links.
 */
function detectCommunityForum(
  $: CheerioAPI,
): { provider: string | null; url: string | null; evidence: string } {
  const links = extractLinks($);
  const htmlContent = $.html();

  // Check links for community URLs
  for (const link of links) {
    const href = link.href.toLowerCase();
    const text = link.text.toLowerCase();

    if (/community|forum|discuss/i.test(text) || /community|forum|discuss/i.test(href)) {
      // Exclude non-community pages (startup programs, applications, pricing, etc.)
      if (/startup|application|apply|program|pricing|product|affiliate|partner/i.test(href)) continue;
      for (const provider of COMMUNITY_PROVIDERS) {
        for (const pattern of provider.patterns) {
          if (pattern.test(link.href)) {
            return { provider: provider.name, url: link.href, evidence: `${provider.name} community: ${link.href}` };
          }
        }
      }
      return { provider: null, url: link.href, evidence: `Community link found: ${link.href}` };
    }
  }

  // Also check for Discord/Slack invite links anywhere
  for (const link of links) {
    for (const provider of COMMUNITY_PROVIDERS) {
      for (const pattern of provider.patterns) {
        if (pattern.test(link.href)) {
          return { provider: provider.name, url: link.href, evidence: `${provider.name} link found: ${link.href}` };
        }
      }
    }
  }

  return { provider: null, url: null, evidence: 'No community forum detected' };
}

/**
 * Count the number of distinct support channels.
 * Channels include: email, phone, live chat, chatbot, help center, community, social media.
 */
function countSupportChannels(
  $: CheerioAPI,
  helpCenterDetected: boolean,
  communityDetected: boolean,
): { count: number; channels: string[] } {
  const channels: string[] = [];
  const bodyText = $('body').text().toLowerCase();
  const bodyHtml = ($('body').html() ?? '').toLowerCase();

  // Email support
  const hasEmail = $('a[href^="mailto:"]').filter((_, el) => {
    const href = $(el).attr('href') ?? '';
    return /support|help|contact|info/i.test(href);
  }).length > 0;
  if (hasEmail || /support@|help@|contact@/i.test(bodyText)) {
    channels.push('email');
  }

  // Phone support
  const hasPhone = $('a[href^="tel:"]').length > 0;
  const phoneRegex = /(?:\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  if (hasPhone || phoneRegex.test(bodyText)) {
    channels.push('phone');
  }

  // Live chat (check for chat widgets — both third-party and custom)
  const chatProviders = [
    /intercom/i, /drift/i, /crisp/i, /zendesk.*chat/i, /zopim/i,
    /livechat/i, /tawk\.to/i, /olark/i, /hubspot.*chat/i,
    /freshchat/i, /tidio/i, /chatra/i, /kustomer/i,
  ];
  const customChatPatterns = [
    /chat[-_]?widget/i, /live[-_]?chat/i, /support[-_]?chat/i,
    /chat\s+with\s+(us|a\s+rep|an?\s+agent|support)/i,
    /start\s+a?\s*chat/i, /chat\s+now/i,
    /support[-_]?conversations/i,
  ];
  let chatDetected = false;
  for (const provider of chatProviders) {
    if (provider.test(bodyHtml)) { chatDetected = true; break; }
  }
  if (!chatDetected) {
    for (const pattern of customChatPatterns) {
      if (pattern.test(bodyHtml) || pattern.test(bodyText)) { chatDetected = true; break; }
    }
  }
  if (chatDetected) {
    channels.push('live_chat');
  }

  // Help center / knowledge base
  if (helpCenterDetected) {
    channels.push('help_center');
  }

  // Community
  if (communityDetected) {
    channels.push('community');
  }

  // Contact form
  const hasContactForm = $('form').filter((_, el) => {
    const action = ($(el).attr('action') ?? '').toLowerCase();
    const id = ($(el).attr('id') ?? '').toLowerCase();
    const className = ($(el).attr('class') ?? '').toLowerCase();
    return /contact|support|help|feedback/i.test(action + id + className);
  }).length > 0;
  if (hasContactForm) {
    channels.push('contact_form');
  }

  // Social media support
  const socialLinks = $('a[href]').filter((_, el) => {
    const href = ($(el).attr('href') ?? '').toLowerCase();
    return /twitter\.com|x\.com/i.test(href);
  }).length > 0;
  if (socialLinks) {
    channels.push('social_media');
  }

  return { count: channels.length, channels };
}

/**
 * Detect published business hours on a support/contact page.
 */
function detectBusinessHours($: CheerioAPI): boolean {
  const bodyText = $('body').text().toLowerCase();

  const hoursPatterns = [
    /business hours/i,
    /office hours/i,
    /support hours/i,
    /hours of operation/i,
    /\bmon(?:day)?\s*[-–]\s*fri(?:day)?\b/i,
    /\b\d{1,2}\s*(?:am|pm)\s*[-–]\s*\d{1,2}\s*(?:am|pm)\b/i,
    /24\/7/i,
    /24 hours/i,
    /around the clock/i,
  ];

  for (const pattern of hoursPatterns) {
    if (pattern.test(bodyText)) {
      return true;
    }
  }

  return false;
}

/**
 * Detect the quality level of a help page.
 */
function assessHelpPageQuality($: CheerioAPI, helpCenterProvider: string | null): 'professional' | 'any' | 'single_faq' | 'none' {
  if (helpCenterProvider) return 'professional';

  const bodyText = $('body').text().toLowerCase();
  const links = extractLinks($);

  // Check for structured help content (multiple articles/categories)
  const articleSelectors = [
    'article',
    '.article',
    '.help-article',
    '.kb-article',
    '.faq-item',
    '.question',
    'details',
    '.accordion-item',
  ];

  let articleCount = 0;
  for (const selector of articleSelectors) {
    articleCount += $(selector).length;
  }

  // Check for category/section structure
  const hasCategories = $('h2, h3').length >= 3;

  if (articleCount >= 5 || (hasCategories && links.length >= 10)) {
    return 'any';
  }

  if (/faq|frequently asked/i.test(bodyText) || articleCount >= 1) {
    return 'single_faq';
  }

  return 'none';
}

/**
 * Detect external support subdomains (help.company.com, support.company.com, etc).
 */
function detectSupportSubdomains($: CheerioAPI, domain: string): { subdomain: string; url: string }[] {
  const subdomains: Map<string, string> = new Map();
  const supportPrefixes = /^(help|support|community|docs|developers|api|academy|training|status|knowledge|learn|education|forum|faq)/i;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    try {
      const url = new URL(href, `https://${domain}`);
      if (url.hostname !== domain && url.hostname.endsWith(domain) && supportPrefixes.test(url.hostname)) {
        const prefix = url.hostname.split('.')[0]!;
        if (!subdomains.has(prefix)) {
          subdomains.set(prefix, url.href);
        }
      }
    } catch { /* ignore */ }
  });

  return Array.from(subdomains.entries()).map(([subdomain, url]) => ({ subdomain, url }));
}

/**
 * Probe a status page URL to detect the underlying provider.
 */
async function probeStatusPageProvider(statusUrl: string): Promise<string | null> {
  try {
    const result = await fetchWithRetry(statusUrl, { timeout: 8000, retries: 1 });
    if (!result.ok) return null;
    const html = result.body.toLowerCase();

    // Atlassian Statuspage fingerprints
    if (/statuspage\.io/i.test(html) || /data-page-id/i.test(html) || /sp-container/i.test(html) || /atlassian/i.test(html)) {
      return 'Atlassian Statuspage';
    }
    // Instatus
    if (/instatus/i.test(html)) return 'Instatus';
    // BetterUptime / BetterStack
    if (/betteruptime|betterstack/i.test(html)) return 'BetterUptime';
    // Cachet
    if (/cachet/i.test(html)) return 'Cachet';

    return null; // status page exists but provider unknown
  } catch {
    return null;
  }
}

/**
 * Detect developer/API documentation.
 */
function detectDeveloperDocs($: CheerioAPI): { found: boolean; url: string | null; evidence: string } {
  const links = extractLinks($);

  for (const link of links) {
    const text = link.text.toLowerCase();
    const href = link.href.toLowerCase();
    if (/(?:api|developer)\s*(?:doc|reference|guide)/i.test(text) ||
        /\/(?:docs|api|developers)\b/i.test(href) ||
        text === 'api' || text === 'developers' || text === 'documentation') {
      return { found: true, url: link.href, evidence: `Developer docs: "${link.text.trim().replace(/\s+/g, ' ').slice(0, 60)}" (${link.href.slice(0, 80)})` };
    }
  }

  return { found: false, url: null, evidence: 'No developer documentation detected' };
}

/**
 * Detect training, academy, or certification programs.
 */
function detectTrainingAcademy($: CheerioAPI): { found: boolean; url: string | null; type: string | null; evidence: string } {
  const links = extractLinks($);

  for (const link of links) {
    const text = link.text.toLowerCase();
    const href = link.href.toLowerCase();

    if (/academy/i.test(text) || /\/academy/i.test(href)) {
      return { found: true, url: link.href, type: 'academy', evidence: `Academy: "${link.text.trim().replace(/\s+/g, ' ').slice(0, 60)}"` };
    }
    if (/certification/i.test(text) || /\/certification/i.test(href)) {
      return { found: true, url: link.href, type: 'certification', evidence: `Certification program: "${link.text.trim().replace(/\s+/g, ' ').slice(0, 60)}"` };
    }
    if (/training/i.test(text) && /\/training/i.test(href)) {
      return { found: true, url: link.href, type: 'training', evidence: `Training portal: "${link.text.trim().replace(/\s+/g, ' ').slice(0, 60)}"` };
    }
    if (/university|learning\s*(?:center|hub|path)/i.test(text)) {
      return { found: true, url: link.href, type: 'learning', evidence: `Learning center: "${link.text.trim().replace(/\s+/g, ' ').slice(0, 60)}"` };
    }
  }

  return { found: false, url: null, type: null, evidence: 'No training or academy detected' };
}

/**
 * Detect support tier levels (free, premium, enterprise support).
 */
function detectSupportTiers($: CheerioAPI): { found: boolean; tiers: string[]; evidence: string } {
  const bodyText = $('body').text().toLowerCase();
  const tiers: string[] = [];

  const tierPatterns: [RegExp, string][] = [
    [/premium\s*support/i, 'premium'],
    [/enterprise\s*support/i, 'enterprise'],
    [/priority\s*support/i, 'priority'],
    [/basic\s*support/i, 'basic'],
    [/free\s*support/i, 'free'],
    [/dedicated\s*(?:account\s*)?manager/i, 'dedicated_manager'],
    [/technical\s*account\s*manager/i, 'TAM'],
    [/24\/7\s*(?:premium|enterprise|priority)/i, '24/7_premium'],
  ];

  for (const [pattern, tier] of tierPatterns) {
    if (pattern.test(bodyText)) tiers.push(tier);
  }

  if (tiers.length > 0) {
    return { found: true, tiers, evidence: `Support tiers detected: ${tiers.join(', ')}` };
  }

  return { found: false, tiers: [], evidence: 'No support tier structure detected' };
}

/**
 * Extract support email addresses.
 */
function extractSupportEmails($: CheerioAPI): string[] {
  const emails: Set<string> = new Set();

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const addr = href.replace('mailto:', '').split('?')[0]?.toLowerCase() ?? '';
    if (/support|help|contact|info|soporte|ayuda/i.test(addr)) {
      emails.add(addr);
    }
  });

  // Also scan body text for support emails
  const bodyText = $('body').text();
  const emailRegex = /(?:support|help|contact|info|soporte|ayuda)@[\w.-]+\.\w{2,}/gi;
  const matches = bodyText.match(emailRegex);
  if (matches) {
    for (const m of matches) emails.add(m.toLowerCase());
  }

  return [...emails];
}

/**
 * Detect chatbot specifically (vs live agent chat).
 */
function detectChatbot($: CheerioAPI): { found: boolean; evidence: string } {
  const html = ($('body').html() ?? '').toLowerCase();
  const chatbotIndicators = [
    /chatbot/i, /virtual\s*assistant/i, /ai\s*assistant/i,
    /bot\.js/i, /conversational\s*ai/i, /ada\.cx/i,
    /drift.*playbook/i, /intercom.*bot/i,
  ];

  for (const pattern of chatbotIndicators) {
    if (pattern.test(html)) {
      return { found: true, evidence: 'AI chatbot or virtual assistant detected' };
    }
  }

  return { found: false, evidence: 'No chatbot detected' };
}

/**
 * Detect SLA or response time guarantees.
 */
function detectSla($: CheerioAPI): { found: boolean; evidence: string } {
  const bodyText = $('body').text().toLowerCase();
  const slaPatterns = [
    /service\s*level\s*agreement/i,
    /response\s*time/i,
    /sla\b/i,
    /guaranteed\s*(?:response|uptime|availability)/i,
    /\d+%\s*uptime/i,
    /(?:within|under)\s*\d+\s*(?:hour|minute|business\s*day)/i,
  ];

  for (const pattern of slaPatterns) {
    if (pattern.test(bodyText)) {
      return { found: true, evidence: 'SLA or response time guarantee detected' };
    }
  }

  return { found: false, evidence: 'No SLA information detected' };
}

/**
 * Check the main page HTML for support-related links.
 * Uses multilingual keywords based on the page's detected language.
 */
function findSupportLinksInMainPage($: CheerioAPI, lang: string): string[] {
  const supportLinks: string[] = [];
  const keywords = getMultilingualKeywords(SUPPORT_LINK_KEYWORDS_BASE, lang, 'support');

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim().toLowerCase();

    for (const keyword of keywords) {
      if (text === keyword || text.includes(keyword) || href.toLowerCase().includes(`/${keyword.replace(/\s+/g, '-')}`)) {
        supportLinks.push(href);
        break;
      }
    }
  });

  return [...new Set(supportLinks)];
}

// ─── Module execute function ────────────────────────────────────────────────

const execute: ModuleExecuteFn = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const baseUrl = normalizeUrl(ctx.url);

  // Detect page language for multilingual probe expansion
  const lang = ctx.html ? detectPageLanguage(ctx.html) : 'en';
  const SUPPORT_PATHS = expandProbePaths(SUPPORT_PATHS_BASE, lang, 'support');
  data.detected_language = lang;

  // 1. Check the main page for support-related links and embedded widgets
  let mainPageSupportLinks: string[] = [];
  let mainPageHelpCenter: { name: string; evidence: string } | null = null;
  let mainPageCommunity: { provider: string | null; url: string | null; evidence: string } | null = null;
  let mainPageStatusPage: { provider: string | null; url: string | null; evidence: string } | null = null;

  if (ctx.html) {
    const $main = parseHtml(ctx.html);
    mainPageSupportLinks = findSupportLinksInMainPage($main, lang);
    mainPageHelpCenter = detectHelpCenterProvider($main);
    mainPageCommunity = detectCommunityForum($main);
    mainPageStatusPage = detectStatusPageFromHtml($main);
  }

  // 2. Probe known support paths
  const probeResults = await Promise.allSettled(
    SUPPORT_PATHS.map((path) => probePath(baseUrl, path)),
  );

  const foundPages: ProbeResult[] = [];
  for (const result of probeResults) {
    if (result.status === 'fulfilled' && result.value.found) {
      foundPages.push(result.value);
    }
  }

  data.probed_paths = SUPPORT_PATHS;
  data.found_pages = foundPages.map((p) => p.path);
  data.main_page_support_links = mainPageSupportLinks;

  // 3. Analyze found pages
  let helpCenterProvider: { name: string; evidence: string } | null = mainPageHelpCenter;
  let statusPage: { provider: string | null; url: string | null; evidence: string } = mainPageStatusPage ?? { provider: null, url: null, evidence: 'No status page detected' };
  let communityForum: { provider: string | null; url: string | null; evidence: string } = mainPageCommunity ?? { provider: null, url: null, evidence: 'No community forum detected' };
  let businessHoursDetected = false;
  let helpPageQuality: 'professional' | 'any' | 'single_faq' | 'none' = 'none';
  let supportChannels = { count: 0, channels: [] as string[] };
  let bestSupportPage: ProbeResult | null = null;
  let developerDocs = { found: false, url: null as string | null, evidence: 'No developer documentation detected' };
  let trainingAcademy = { found: false, url: null as string | null, type: null as string | null, evidence: 'No training or academy detected' };
  let supportTiers = { found: false, tiers: [] as string[], evidence: 'No support tier structure detected' };
  let supportEmails: string[] = [];
  let chatbot = { found: false, evidence: 'No chatbot detected' };
  let sla = { found: false, evidence: 'No SLA information detected' };
  let supportSubdomains: { subdomain: string; url: string }[] = [];
  const domain = new URL(baseUrl).hostname.replace(/^www\./, '');

  // Detect support subdomains from main page
  if (ctx.html) {
    const $main = parseHtml(ctx.html);
    supportSubdomains = detectSupportSubdomains($main, domain);
  }

  for (const page of foundPages) {
    if (!page.html) continue;

    const $ = parseHtml(page.html);

    if (!bestSupportPage && (page.path === '/support' || page.path === '/help' || page.path === '/help-center')) {
      bestSupportPage = page;
    } else if (!bestSupportPage) {
      bestSupportPage = page;
    }

    // Detect help center provider
    if (!helpCenterProvider) {
      helpCenterProvider = detectHelpCenterProvider($);
    }

    // Detect status page
    if (!statusPage.url && !statusPage.provider) {
      statusPage = detectStatusPageFromHtml($);
    }

    // Detect community
    if (!communityForum.url && !communityForum.provider) {
      communityForum = detectCommunityForum($);
    }

    // Detect business hours
    if (!businessHoursDetected) {
      businessHoursDetected = detectBusinessHours($);
    }

    // Assess help page quality
    const quality = assessHelpPageQuality($, helpCenterProvider?.name ?? null);
    const qualityRank = { professional: 3, any: 2, single_faq: 1, none: 0 };
    if (qualityRank[quality] > qualityRank[helpPageQuality]) {
      helpPageQuality = quality;
    }

    // Count support channels — consider help center present if provider detected
    // OR if we found quality help pages (even without a known provider)
    const helpCenterActive = helpCenterProvider !== null || helpPageQuality === 'professional' || helpPageQuality === 'any';
    const communityActive = communityForum.url !== null || communityForum.provider !== null;
    const channels = countSupportChannels($, helpCenterActive, communityActive);
    if (channels.count > supportChannels.count) {
      supportChannels = channels;
    }

    // New detectors
    if (!developerDocs.found) developerDocs = detectDeveloperDocs($);
    if (!trainingAcademy.found) trainingAcademy = detectTrainingAcademy($);
    if (!supportTiers.found) supportTiers = detectSupportTiers($);
    const pageEmails = extractSupportEmails($);
    for (const e of pageEmails) { if (!supportEmails.includes(e)) supportEmails.push(e); }
    if (!chatbot.found) chatbot = detectChatbot($);
    if (!sla.found) sla = detectSla($);

    // Also detect support subdomains from found pages
    const pageSubs = detectSupportSubdomains($, domain);
    for (const sub of pageSubs) {
      if (!supportSubdomains.some((s) => s.subdomain === sub.subdomain)) {
        supportSubdomains.push(sub);
      }
    }
  }

  // Also check main page for new detectors
  if (ctx.html) {
    const $main = parseHtml(ctx.html);
    if (!developerDocs.found) developerDocs = detectDeveloperDocs($main);
    if (!trainingAcademy.found) trainingAcademy = detectTrainingAcademy($main);
    if (!supportTiers.found) supportTiers = detectSupportTiers($main);
    const mainEmails = extractSupportEmails($main);
    for (const e of mainEmails) { if (!supportEmails.includes(e)) supportEmails.push(e); }
    if (!chatbot.found) chatbot = detectChatbot($main);
    if (supportChannels.count === 0) {
      const helpActive = helpCenterProvider !== null || helpPageQuality === 'professional' || helpPageQuality === 'any';
      const commActive = communityForum.url !== null || communityForum.provider !== null;
      supportChannels = countSupportChannels($main, helpActive, commActive);
    }
  }

  // Probe status page URL to detect provider if URL found but provider unknown
  if (statusPage.url && !statusPage.provider) {
    const resolvedUrl = statusPage.url.startsWith('//') ? `https:${statusPage.url}` : statusPage.url;
    const detectedProvider = await probeStatusPageProvider(resolvedUrl);
    if (detectedProvider) {
      statusPage.provider = detectedProvider;
      statusPage.evidence = `${detectedProvider} status page: ${statusPage.url}`;
    }
  }

  // Store data
  data.support_page_url = bestSupportPage ? `${baseUrl}${bestSupportPage.path}` : null;
  data.help_center_provider = helpCenterProvider?.name ?? null;
  data.help_center_evidence = helpCenterProvider?.evidence ?? null;
  data.help_page_quality = helpPageQuality;
  data.status_page = statusPage;
  data.community_forum = communityForum;
  data.business_hours = businessHoursDetected;
  data.support_channels = supportChannels;
  data.developer_docs = developerDocs;
  data.training_academy = trainingAcademy;
  data.support_tiers = supportTiers;
  data.support_emails = supportEmails;
  data.chatbot = chatbot;
  data.sla = sla;
  data.support_subdomains = supportSubdomains;

  // ─── Build signals ──────────────────────────────────────────────────────

  if (helpCenterProvider) {
    signals.push(
      createSignal({
        type: 'help_center',
        name: helpCenterProvider.name,
        confidence: 0.9,
        evidence: helpCenterProvider.evidence,
        category: 'brand_presence',
      }),
    );
  }

  if (statusPage.url || statusPage.provider) {
    signals.push(
      createSignal({
        type: 'status_page',
        name: statusPage.provider ?? 'Status Page',
        confidence: 0.9,
        evidence: statusPage.evidence,
        category: 'brand_presence',
      }),
    );
  }

  if (communityForum.url || communityForum.provider) {
    signals.push(
      createSignal({
        type: 'community_forum',
        name: communityForum.provider ?? 'Community Forum',
        confidence: 0.8,
        evidence: communityForum.evidence,
        category: 'brand_presence',
      }),
    );
  }

  if (supportChannels.channels.length > 0) {
    signals.push(
      createSignal({
        type: 'support_channels',
        name: 'Support Channels',
        confidence: 0.8,
        evidence: `${supportChannels.count} support channel(s): ${supportChannels.channels.join(', ')}`,
        category: 'brand_presence',
      }),
    );
  }

  if (businessHoursDetected) {
    signals.push(
      createSignal({
        type: 'business_hours',
        name: 'Business Hours Published',
        confidence: 0.7,
        evidence: 'Business/support hours detected on page',
        category: 'brand_presence',
      }),
    );
  }

  if (developerDocs.found) {
    signals.push(
      createSignal({
        type: 'developer_docs',
        name: 'Developer Documentation',
        confidence: 0.85,
        evidence: developerDocs.evidence,
        category: 'brand_presence',
      }),
    );
  }

  if (trainingAcademy.found) {
    signals.push(
      createSignal({
        type: 'training_academy',
        name: trainingAcademy.type === 'academy' ? 'Academy' : 'Training Portal',
        confidence: 0.85,
        evidence: trainingAcademy.evidence,
        category: 'brand_presence',
      }),
    );
  }

  if (chatbot.found) {
    signals.push(
      createSignal({
        type: 'chatbot',
        name: 'AI Chatbot',
        confidence: 0.75,
        evidence: chatbot.evidence,
        category: 'brand_presence',
      }),
    );
  }

  if (supportSubdomains.length > 0) {
    signals.push(
      createSignal({
        type: 'support_subdomains',
        name: 'Support Subdomains',
        confidence: 0.9,
        evidence: `${supportSubdomains.length} support subdomain(s): ${supportSubdomains.map((s) => s.subdomain).join(', ')}`,
        category: 'brand_presence',
      }),
    );
  }

  // ─── Build checkpoints ──────────────────────────────────────────────────

  // CP1: Help center (weight 5/10 = 0.5)
  if (helpPageQuality === 'professional') {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-help-center',
        name: 'Help center',
        weight: 0.5,
        health: 'excellent',
        evidence: `Professional help center detected (${helpCenterProvider?.name ?? 'provider'})`,
      }),
    );
  } else if (helpPageQuality === 'any') {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-help-center',
        name: 'Help center',
        weight: 0.5,
        health: 'good',
        evidence: 'Help/support page with structured content found',
      }),
    );
  } else if (helpPageQuality === 'single_faq') {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-help-center',
        name: 'Help center',
        weight: 0.5,
        health: 'warning',
        evidence: 'Only a basic FAQ page detected',
        recommendation: 'Build a comprehensive help center with categorized articles and search',
      }),
    );
  } else {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-help-center',
        name: 'Help center',
        weight: 0.5,
        health: 'critical',
        evidence: 'No support documentation found',
        recommendation: 'Create a help center or knowledge base for customers (Zendesk, Intercom, or similar)',
      }),
    );
  }

  // CP2: Support channels (weight 5/10 = 0.5)
  if (supportChannels.count >= 3) {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-support-channels',
        name: 'Support channels',
        weight: 0.5,
        health: 'excellent',
        evidence: `${supportChannels.count} support channels: ${supportChannels.channels.join(', ')}`,
      }),
    );
  } else if (supportChannels.count === 2) {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-support-channels',
        name: 'Support channels',
        weight: 0.5,
        health: 'good',
        evidence: `2 support channels: ${supportChannels.channels.join(', ')}`,
      }),
    );
  } else if (supportChannels.count === 1) {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-support-channels',
        name: 'Support channels',
        weight: 0.5,
        health: 'warning',
        evidence: `Only 1 support channel: ${supportChannels.channels.join(', ')}`,
        recommendation: 'Add additional support channels (email, phone, live chat) for better customer experience',
      }),
    );
  } else {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-support-channels',
        name: 'Support channels',
        weight: 0.5,
        health: 'critical',
        evidence: 'No support contact information found',
        recommendation: 'Add visible support contact options (email, phone, or live chat) to the website',
      }),
    );
  }

  // CP3: System status page (weight 4/10 = 0.4)
  const isProfessionalStatusPage = statusPage.provider !== null;

  if (isProfessionalStatusPage) {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-status-page',
        name: 'System status page',
        weight: 0.4,
        health: 'excellent',
        evidence: `Professional status page: ${statusPage.provider}${statusPage.url ? ` (${statusPage.url})` : ''}`,
      }),
    );
  } else if (statusPage.url || statusPage.provider) {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-status-page',
        name: 'System status page',
        weight: 0.4,
        health: 'good',
        evidence: statusPage.evidence,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm19-status-page',
        'System status page',
        'No system status page detected',
      ),
    );
  }

  // CP4: Business hours (weight 3/10 = 0.3)
  if (businessHoursDetected) {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-business-hours',
        name: 'Business hours',
        weight: 0.3,
        health: 'excellent',
        evidence: 'Business/support hours published on page',
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm19-business-hours',
        'Business hours',
        'No business hours detected',
      ),
    );
  }

  // CP5: Community forum (weight 3/10 = 0.3)
  // Also treat a dedicated community subdomain as active
  const hasCommunitySubdomain = supportSubdomains.some((s) => s.subdomain === 'community' || s.subdomain === 'forum');
  const isActiveCommunity = communityForum.provider !== null ||
    hasCommunitySubdomain;

  if (isActiveCommunity) {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-community-forum',
        name: 'Community forum',
        weight: 0.3,
        health: 'excellent',
        evidence: communityForum.provider
          ? `Active community: ${communityForum.provider}${communityForum.url ? ` (${communityForum.url})` : ''}`
          : `Dedicated community subdomain: ${communityForum.url ?? 'detected'}`,
      }),
    );
  } else if (communityForum.url || communityForum.provider) {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-community-forum',
        name: 'Community forum',
        weight: 0.3,
        health: 'good',
        evidence: communityForum.evidence,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm19-community-forum',
        'Community forum',
        'No community forum or discussion channel detected',
      ),
    );
  }

  // CP6: Developer documentation (weight 2/10 = 0.2)
  if (developerDocs.found) {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-developer-docs',
        name: 'Developer docs',
        weight: 0.2,
        health: 'excellent',
        evidence: developerDocs.evidence,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm19-developer-docs',
        'Developer docs',
        'No developer or API documentation detected',
      ),
    );
  }

  // CP7: Training / Academy (weight 2/10 = 0.2)
  if (trainingAcademy.found) {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-training-academy',
        name: 'Training/academy',
        weight: 0.2,
        health: 'excellent',
        evidence: trainingAcademy.evidence,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm19-training-academy',
        'Training/academy',
        'No training portal or academy detected',
      ),
    );
  }

  return {
    moduleId: 'M19' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null, // calculated by runner from checkpoints
    checkpoints,
    duration: 0, // set by runner
  };
};

export { execute };

// ─── Register ───────────────────────────────────────────────────────────────
registerModuleExecutor('M19' as ModuleId, execute);
