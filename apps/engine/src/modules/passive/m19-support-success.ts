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
const SUPPORT_PATHS = ['/support', '/help', '/help-center', '/knowledge-base', '/status', '/community', '/contact'];

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

  // Live chat (check for chat widgets)
  const chatProviders = [
    /intercom/i, /drift/i, /crisp/i, /zendesk.*chat/i, /zopim/i,
    /livechat/i, /tawk\.to/i, /olark/i, /hubspot.*chat/i,
    /freshchat/i, /tidio/i, /chatra/i,
  ];
  for (const provider of chatProviders) {
    if (provider.test(bodyHtml)) {
      channels.push('live_chat');
      break;
    }
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
 * Check the main page HTML for support-related links.
 */
function findSupportLinksInMainPage($: CheerioAPI): string[] {
  const supportLinks: string[] = [];
  const keywords = ['support', 'help', 'help center', 'knowledge base', 'contact', 'community'];

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

  // 1. Check the main page for support-related links and embedded widgets
  let mainPageSupportLinks: string[] = [];
  let mainPageHelpCenter: { name: string; evidence: string } | null = null;
  let mainPageCommunity: { provider: string | null; url: string | null; evidence: string } | null = null;
  let mainPageStatusPage: { provider: string | null; url: string | null; evidence: string } | null = null;

  if (ctx.html) {
    const $main = parseHtml(ctx.html);
    mainPageSupportLinks = findSupportLinksInMainPage($main);
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

    // Count support channels
    const channels = countSupportChannels($, helpCenterProvider !== null, communityForum.url !== null || communityForum.provider !== null);
    if (channels.count > supportChannels.count) {
      supportChannels = channels;
    }
  }

  // Also count support channels from main page
  if (ctx.html && supportChannels.count === 0) {
    const $main = parseHtml(ctx.html);
    supportChannels = countSupportChannels(
      $main,
      helpCenterProvider !== null,
      communityForum.url !== null || communityForum.provider !== null,
    );
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

  // ─── Build signals ──────────────────────────────────────────────────────

  if (helpCenterProvider) {
    signals.push(
      createSignal({
        type: 'help_center',
        name: helpCenterProvider.name,
        confidence: 0.9,
        evidence: helpCenterProvider.evidence,
        category: 'digital_presence',
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
        category: 'digital_presence',
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
        category: 'digital_presence',
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
        category: 'digital_presence',
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
        category: 'digital_presence',
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
  const isProfessionalStatusPage = statusPage.provider !== null &&
    ['Atlassian Statuspage', 'Instatus'].includes(statusPage.provider);

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
  const isActiveCommunity = communityForum.provider !== null &&
    ['Discourse', 'Circle'].includes(communityForum.provider);

  if (isActiveCommunity) {
    checkpoints.push(
      createCheckpoint({
        id: 'm19-community-forum',
        name: 'Community forum',
        weight: 0.3,
        health: 'excellent',
        evidence: `Active community detected: ${communityForum.provider}${communityForum.url ? ` (${communityForum.url})` : ''}`,
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

// ─── Register ───────────────────────────────────────────────────────────────
registerModuleExecutor('M19' as ModuleId, execute);
