/**
 * M06 - Paid Media Infrastructure
 *
 * Detects advertising pixels, conversion events, click ID preservation,
 * attribution cookies, UTM handling, and ad script performance impact.
 *
 * Checkpoints:
 *   1. Ad pixel presence
 *   2. Enhanced conversions
 *   3. Conversion event coverage
 *   4. Click ID capture
 *   5. Attribution cookies
 *   6. UTM parameter handling
 *   7. CAPI / server-side pixels
 *   8. Pixel consent compliance
 *   9. Ad script performance impact
 *  10. Pixel fire verification
 *  11. Attribution window coverage
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import type { CapturedRequest, CapturedResponse } from '../../utils/network.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdPixel {
  name: string;
  id: string | null;
  events: string[];
  hasEnhancedConversions: boolean;
  serverSide: boolean;
  confidence: number;
  networkFires: number;          // actual pixel fire count from network
  loadMethod: 'direct' | 'gtm' | 'unknown';
}

interface NetworkPixelData {
  pixelName: string;
  id: string | null;
  events: string[];
  fires: number;
}

// ---------------------------------------------------------------------------
// Network request pixel ID/event extractors
// ---------------------------------------------------------------------------

function extractMetaFromNetwork(reqs: CapturedRequest[]): NetworkPixelData {
  let id: string | null = null;
  const events = new Set<string>();
  let fires = 0;

  for (const req of reqs) {
    // facebook.com/tr?id=XXXX&ev=PageView
    if (/facebook\.com\/tr|connect\.facebook\.net.*fbevents/i.test(req.url)) {
      fires++;
      try {
        const u = new URL(req.url);
        const pid = u.searchParams.get('id');
        if (pid && /^\d+$/.test(pid)) id = pid;
        const ev = u.searchParams.get('ev');
        if (ev) events.add(ev);
      } catch { /* */ }
      // Also check POST data for events
      if (req.postData) {
        try {
          const params = new URLSearchParams(req.postData);
          const ev = params.get('ev');
          if (ev) events.add(ev);
          const pid = params.get('id');
          if (pid && /^\d+$/.test(pid)) id = pid;
        } catch { /* */ }
      }
    }
  }
  return { pixelName: 'Meta Pixel', id, events: [...events], fires };
}

function extractTikTokFromNetwork(reqs: CapturedRequest[]): NetworkPixelData {
  let id: string | null = null;
  const events = new Set<string>();
  let fires = 0;

  for (const req of reqs) {
    if (/analytics\.tiktok\.com|tiktok\.com\/i18n\/pixel/i.test(req.url)) {
      fires++;
      try {
        const u = new URL(req.url);
        const sdkid = u.searchParams.get('sdkid');
        if (sdkid) id = sdkid;
        const ev = u.searchParams.get('event');
        if (ev) events.add(ev);
      } catch { /* */ }
      if (req.postData) {
        try {
          const body = JSON.parse(req.postData) as Record<string, unknown>;
          const ev = body['event'] || body['event_name'];
          if (typeof ev === 'string') events.add(ev);
          const pid = body['pixel_code'];
          if (typeof pid === 'string') id = pid;
        } catch { /* not JSON */ }
      }
    }
  }
  return { pixelName: 'TikTok Pixel', id, events: [...events], fires };
}

function extractLinkedInFromNetwork(reqs: CapturedRequest[]): NetworkPixelData {
  let id: string | null = null;
  const events = new Set<string>();
  let fires = 0;

  for (const req of reqs) {
    if (/px\.ads\.linkedin\.com|snap\.licdn\.com|linkedin\.com\/px/i.test(req.url)) {
      fires++;
      try {
        const u = new URL(req.url);
        const pid = u.searchParams.get('pid');
        if (pid && !id) id = pid; // take first pid only
        const conversionId = u.searchParams.get('conversionId');
        if (conversionId) events.add(`conversion:${conversionId}`);
        // fmt=js/gif/g are response format indicators, not events
        // Track the request type instead
        if (u.pathname.includes('/collect')) events.add('pageview');
        if (u.pathname.includes('/conversion')) events.add('conversion');
      } catch { /* */ }
    }
  }
  return { pixelName: 'LinkedIn Insight', id, events: [...events], fires };
}

function extractTwitterFromNetwork(reqs: CapturedRequest[]): NetworkPixelData {
  let id: string | null = null;
  const events = new Set<string>();
  let fires = 0;

  for (const req of reqs) {
    if (/ads-twitter\.com|analytics\.twitter\.com|t\.co\/i\/adsct/i.test(req.url)) {
      fires++;
      try {
        const u = new URL(req.url);
        const txnId = u.searchParams.get('txn_id');
        if (txnId) id = txnId;
        const ev = u.searchParams.get('events') || u.searchParams.get('event');
        // Filter out JSON junk and empty strings from event values
        if (ev && !ev.startsWith('{') && ev.length > 0) events.add(ev);
        // p_id on Twitter is the platform name (e.g. "Twitter"), NOT a pixel ID — skip
        // The real pixel ID comes from txn_id
        // Detect page load event from path
        if (u.pathname.includes('/i/adsct') || u.pathname.includes('/i/jot')) events.add('pageview');
      } catch { /* */ }
    }
  }
  return { pixelName: 'Twitter/X Pixel', id, events: [...events], fires };
}

function extractUETFromNetwork(reqs: CapturedRequest[]): NetworkPixelData {
  let id: string | null = null;
  const events = new Set<string>();
  let fires = 0;

  for (const req of reqs) {
    if (/bat\.bing\.com|bing\.com\/bat/i.test(req.url)) {
      fires++;
      try {
        const u = new URL(req.url);
        const ti = u.searchParams.get('ti');
        if (ti) id = ti;
        const evt = u.searchParams.get('evt');
        if (evt) events.add(evt);
        const ea = u.searchParams.get('ea');
        if (ea) events.add(ea);
        // Path-based: /action/0?ti=XXXXX
        const pathMatch = u.pathname.match(/\/action\/(\d+)/);
        if (pathMatch) events.add(`action:${pathMatch[1]}`);
      } catch { /* */ }
    }
  }
  return { pixelName: 'Microsoft Ads (UET)', id, events: [...events], fires };
}

function extractGoogleAdsFromNetwork(reqs: CapturedRequest[]): NetworkPixelData {
  let id: string | null = null;
  const events = new Set<string>();
  let fires = 0;

  for (const req of reqs) {
    if (/googleadservices\.com\/pagead|googleads\.g\.doubleclick\.net\/pagead/i.test(req.url)) {
      fires++;
      try {
        const u = new URL(req.url);
        // /pagead/conversion/XXXXXX/ or ?awid=AW-XXXXXX
        const pathMatch = u.pathname.match(/\/conversion\/(\d+)/);
        if (pathMatch) {
          id = `AW-${pathMatch[1]}`;
          events.add('conversion');
        }
        const label = u.searchParams.get('label');
        if (label) events.add(`conversion:${label}`);
        const awid = u.searchParams.get('awid');
        if (awid) id = awid;
      } catch { /* */ }
    }
    // Also check doubleclick.net for remarketing/display
    if (/doubleclick\.net\/activity/i.test(req.url)) {
      fires++;
      events.add('remarketing');
    }
  }
  return { pixelName: 'Google Ads', id, events: [...events], fires };
}

function extractPinterestFromNetwork(reqs: CapturedRequest[]): NetworkPixelData {
  let id: string | null = null;
  const events = new Set<string>();
  let fires = 0;

  for (const req of reqs) {
    if (/ct\.pinterest\.com|pinterest\.com\/ct/i.test(req.url)) {
      fires++;
      try {
        const u = new URL(req.url);
        const tid = u.searchParams.get('tid');
        if (tid) id = tid;
        const event = u.searchParams.get('event');
        if (event) events.add(event);
      } catch { /* */ }
    }
  }
  return { pixelName: 'Pinterest Tag', id, events: [...events], fires };
}

function extractSnapchatFromNetwork(reqs: CapturedRequest[]): NetworkPixelData {
  let id: string | null = null;
  const events = new Set<string>();
  let fires = 0;

  for (const req of reqs) {
    if (/tr\.snapchat\.com|sc-static\.net.*scevent/i.test(req.url)) {
      fires++;
      try {
        const u = new URL(req.url);
        const pid = u.searchParams.get('id');
        if (pid) id = pid;
        const ev = u.searchParams.get('ev');
        if (ev) events.add(ev);
      } catch { /* */ }
    }
  }
  return { pixelName: 'Snapchat Pixel', id, events: [...events], fires };
}

function extractRedditFromNetwork(reqs: CapturedRequest[]): NetworkPixelData {
  let id: string | null = null;
  const events = new Set<string>();
  let fires = 0;

  for (const req of reqs) {
    if (/alb\.reddit\.com\/snoo|rdt\.li/i.test(req.url)) {
      fires++;
      try {
        const u = new URL(req.url);
        const aid = u.searchParams.get('a');
        if (aid) id = aid;
        const ev = u.searchParams.get('event');
        if (ev) events.add(ev);
      } catch { /* */ }
    }
  }
  return { pixelName: 'Reddit Pixel', id, events: [...events], fires };
}

function extractAmazonAdsFromNetwork(reqs: CapturedRequest[]): NetworkPixelData {
  let id: string | null = null;
  const events = new Set<string>();
  let fires = 0;

  for (const req of reqs) {
    if (/amazon-adsystem\.com|paa-reporting.*\.amazon/i.test(req.url)) {
      fires++;
      try {
        const u = new URL(req.url);
        const tag = u.searchParams.get('tag');
        if (tag) id = tag;
      } catch { /* */ }
      events.add('impression');
    }
  }
  return { pixelName: 'Amazon Ads', id, events: [...events], fires };
}

// ---------------------------------------------------------------------------
// Ad script byte calculation using real response sizes
// ---------------------------------------------------------------------------

function calculateRealAdBytes(
  adRequests: CapturedRequest[],
  allResponses: CapturedResponse[],
): { totalBytes: number; scriptCount: number; byPlatform: Record<string, number> } {
  let totalBytes = 0;
  let scriptCount = 0;
  const byPlatform: Record<string, number> = {};

  // Build a response lookup by URL
  const responseMap = new Map<string, CapturedResponse>();
  for (const resp of allResponses) {
    responseMap.set(resp.url, resp);
  }

  for (const req of adRequests) {
    if (req.resourceType === 'script') {
      scriptCount++;
      const resp = responseMap.get(req.url);
      const cl = resp?.headers['content-length'];
      const size = cl ? parseInt(cl, 10) : 0;
      totalBytes += size > 0 ? size : 15_000; // conservative 15KB fallback instead of 50KB
      // Categorize by platform
      const domain = req.domain || 'unknown';
      byPlatform[domain] = (byPlatform[domain] ?? 0) + (size > 0 ? size : 15_000);
    }
  }

  return { totalBytes, scriptCount, byPlatform };
}

// ---------------------------------------------------------------------------
// Additional niche pixel detection from network
// ---------------------------------------------------------------------------

function detectNichePixelsFromNetwork(allReqs: CapturedRequest[]): AdPixel[] {
  const niche: AdPixel[] = [];

  // Impact Radius
  let irFires = 0;
  for (const req of allReqs) {
    if (/impactradius|impact\.com\/ad/i.test(req.url)) irFires++;
  }
  if (irFires > 0) {
    niche.push({ name: 'Impact Radius', id: null, events: ['tracking'], hasEnhancedConversions: false, serverSide: false, confidence: 0.8, networkFires: irFires, loadMethod: 'unknown' });
  }

  // TVSquared
  let tvFires = 0;
  for (const req of allReqs) {
    if (/tvsquared\.com|tvpixel/i.test(req.url)) tvFires++;
  }
  if (tvFires > 0) {
    niche.push({ name: 'TVSquared', id: null, events: ['tracking'], hasEnhancedConversions: false, serverSide: false, confidence: 0.8, networkFires: tvFires, loadMethod: 'unknown' });
  }

  // Spotify Ad Analytics
  let spotifyFires = 0;
  for (const req of allReqs) {
    if (/byspotify\.com|spotify.*ads|spotify.*pixel/i.test(req.url)) spotifyFires++;
  }
  if (spotifyFires > 0) {
    niche.push({ name: 'Spotify Ad Analytics', id: null, events: ['tracking'], hasEnhancedConversions: false, serverSide: false, confidence: 0.75, networkFires: spotifyFires, loadMethod: 'unknown' });
  }

  // Veritonic
  let veritonicFires = 0;
  for (const req of allReqs) {
    if (/veritonic(metrics)?\.com/i.test(req.url)) veritonicFires++;
  }
  if (veritonicFires > 0) {
    niche.push({ name: 'Veritonic', id: null, events: ['tracking'], hasEnhancedConversions: false, serverSide: false, confidence: 0.75, networkFires: veritonicFires, loadMethod: 'unknown' });
  }

  // AdSwizz (podcast ads)
  let adswizzFires = 0;
  for (const req of allReqs) {
    if (/adswizz\.com/i.test(req.url)) adswizzFires++;
  }
  if (adswizzFires > 0) {
    niche.push({ name: 'AdsWizz', id: null, events: ['tracking'], hasEnhancedConversions: false, serverSide: false, confidence: 0.75, networkFires: adswizzFires, loadMethod: 'unknown' });
  }

  // Taboola
  let taboolaFires = 0;
  for (const req of allReqs) {
    if (/taboola\.com\/.*pixel|trc\.taboola\.com/i.test(req.url)) taboolaFires++;
  }
  if (taboolaFires > 0) {
    niche.push({ name: 'Taboola', id: null, events: ['tracking'], hasEnhancedConversions: false, serverSide: false, confidence: 0.8, networkFires: taboolaFires, loadMethod: 'unknown' });
  }

  // Outbrain
  let outbrainFires = 0;
  for (const req of allReqs) {
    if (/outbrain\.com.*pixel|tr\.outbrain\.com/i.test(req.url)) outbrainFires++;
  }
  if (outbrainFires > 0) {
    niche.push({ name: 'Outbrain', id: null, events: ['tracking'], hasEnhancedConversions: false, serverSide: false, confidence: 0.8, networkFires: outbrainFires, loadMethod: 'unknown' });
  }

  // Criteo
  let criteoFires = 0;
  for (const req of allReqs) {
    if (/criteo\.(com|net).*event|dis\.criteo\.com/i.test(req.url)) criteoFires++;
  }
  if (criteoFires > 0) {
    niche.push({ name: 'Criteo', id: null, events: ['tracking'], hasEnhancedConversions: false, serverSide: false, confidence: 0.8, networkFires: criteoFires, loadMethod: 'unknown' });
  }

  // Tapad (cross-device)
  let tapadFires = 0;
  for (const req of allReqs) {
    if (/tapad\.com/i.test(req.url)) tapadFires++;
  }
  if (tapadFires > 0) {
    niche.push({ name: 'Tapad', id: null, events: ['sync'], hasEnhancedConversions: false, serverSide: false, confidence: 0.7, networkFires: tapadFires, loadMethod: 'unknown' });
  }

  // Podscribe (podcast attribution)
  let podscribeFires = 0;
  for (const req of allReqs) {
    if (/pdst\.fm|podscribe/i.test(req.url)) podscribeFires++;
  }
  if (podscribeFires > 0) {
    niche.push({ name: 'Podscribe', id: null, events: ['tracking'], hasEnhancedConversions: false, serverSide: false, confidence: 0.75, networkFires: podscribeFires, loadMethod: 'unknown' });
  }

  // CHEQ (ad verification / fraud detection)
  let cheqFires = 0;
  for (const req of allReqs) {
    if (/cheq(zone|tag)?\.com|adn\.cloud/i.test(req.url)) cheqFires++;
  }
  if (cheqFires > 0) {
    niche.push({ name: 'CHEQ', id: null, events: ['verification'], hasEnhancedConversions: false, serverSide: false, confidence: 0.8, networkFires: cheqFires, loadMethod: 'unknown' });
  }

  return niche;
}

// ---------------------------------------------------------------------------
// Module implementation
// ---------------------------------------------------------------------------

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  const nc = ctx.networkCollector;

  if (!page) {
    return {
      moduleId: 'M06' as ModuleId,
      status: 'error',
      data: {},
      signals: [],
      score: null,
      checkpoints: [],
      duration: 0,
      error: 'Browser page not available for M06',
    };
  }

  // ─── Step 1: Detect ad pixels via window globals ─────────────────────────
  const pixels = await page.evaluate((): AdPixel[] => {
    const found: AdPixel[] = [];
    const w = window as unknown as Record<string, unknown>;

    // --- Meta/Facebook Pixel ---
    const fbq = w['fbq'] as ((...args: unknown[]) => void) & { _i?: unknown[]; getState?: () => Record<string, unknown>; queue?: unknown[][] } | undefined;
    if (typeof fbq === 'function' || w['_fbq']) {
      const pixelIds: string[] = [];
      const events: string[] = [];

      // Method 1: fbq._i array (standard SDK)
      if (Array.isArray(fbq?._i)) {
        for (const entry of fbq._i) {
          if (Array.isArray(entry) && typeof entry[0] === 'string' && /^\d+$/.test(entry[0])) {
            pixelIds.push(entry[0]);
          }
        }
      }

      // Method 2: fbq.queue for events
      if (Array.isArray(fbq?.queue)) {
        for (const call of fbq.queue) {
          if (Array.isArray(call)) {
            if (call[0] === 'track' && typeof call[1] === 'string') events.push(call[1]);
            if (call[0] === 'trackCustom' && typeof call[1] === 'string') events.push(call[1]);
            if (call[0] === 'init' && typeof call[1] === 'string' && /^\d+$/.test(call[1])) pixelIds.push(call[1]);
          }
        }
      }

      // Method 3: _fbq.callMethod or _fbq.loaded for pixel IDs
      const _fbq = w['_fbq'] as Record<string, unknown> | undefined;
      if (_fbq && typeof _fbq === 'object') {
        const loaded = _fbq['loaded'] as Record<string, unknown>[] | undefined;
        if (Array.isArray(loaded)) {
          for (const entry of loaded) {
            const pid = entry?.['id'];
            if (typeof pid === 'string' && /^\d+$/.test(pid)) pixelIds.push(pid);
          }
        }
      }

      // Method 4: Scan script tags for pixel ID in inline fbq('init', 'XXXXX')
      const scripts = document.querySelectorAll('script:not([src])');
      scripts.forEach(s => {
        const text = s.textContent || '';
        const initMatch = text.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/);
        if (initMatch && initMatch[1]) pixelIds.push(initMatch[1]);
        // Also extract tracked events from inline scripts
        const trackMatches = text.matchAll(/fbq\s*\(\s*['"]track(?:Custom)?['"]\s*,\s*['"]([^'"]+)['"]/g);
        for (const m of trackMatches) {
          if (m[1]) events.push(m[1]);
        }
      });

      const hasAdvancedMatching = !!(fbq?.getState?.()?.['pixelInitialized']) ||
        !!document.querySelector('script[src*="fbevents"][data-advanced-matching]');

      found.push({
        name: 'Meta Pixel',
        id: [...new Set(pixelIds)][0] ?? null,
        events: [...new Set(events)],
        hasEnhancedConversions: hasAdvancedMatching,
        serverSide: false,
        confidence: 0.95,
        networkFires: 0,
        loadMethod: 'unknown',
      });
    }

    // --- Google Ads ---
    {
      const gtag = w['gtag'] as ((...args: unknown[]) => void) | undefined;
      const awIds: string[] = [];
      const conversionLabels: string[] = [];
      const dl = (w['dataLayer'] as Array<Record<string, unknown> | unknown[]>) || [];

      for (const entry of dl) {
        if (Array.isArray(entry)) {
          const arr = entry as unknown[];
          if (arr[0] === 'config' && typeof arr[1] === 'string' && (arr[1] as string).startsWith('AW-')) {
            awIds.push(arr[1] as string);
          }
          if (arr[0] === 'event' && arr[1] === 'conversion' && typeof arr[2] === 'object') {
            const label = (arr[2] as Record<string, unknown>)?.['send_to'] as string;
            if (label) conversionLabels.push(label);
          }
        }
      }

      // Check google_tag_manager for AW- IDs
      const gtmObj = w['google_tag_manager'] as Record<string, unknown> | undefined;
      if (gtmObj) {
        for (const key of Object.keys(gtmObj)) {
          if (key.startsWith('AW-')) awIds.push(key);
        }
      }

      // Check google_tag_data for AW config
      const gtd = w['google_tag_data'] as Record<string, unknown> | undefined;
      if (gtd) {
        const ics = gtd['ics'] as Record<string, unknown> | undefined;
        if (ics) {
          for (const key of Object.keys(ics)) {
            if (key.startsWith('AW-')) awIds.push(key);
          }
        }
      }

      // Inline script scan for AW- IDs
      document.querySelectorAll('script:not([src])').forEach(s => {
        const text = s.textContent || '';
        const matches = text.matchAll(/['"]?(AW-\d+(?:\/[A-Za-z0-9_-]+)?)['"]/g);
        for (const m of matches) {
          if (m[1]) awIds.push(m[1]);
        }
      });

      const hasEnhanced = dl.some(e => {
        if (!e || typeof e !== 'object') return false;
        if ('user_data' in e) return true;
        if (Array.isArray(e)) {
          const arr = e as unknown[];
          return arr[2] && typeof arr[2] === 'object' && 'user_data' in (arr[2] as Record<string, unknown>);
        }
        return false;
      });

      if (awIds.length > 0) {
        found.push({
          name: 'Google Ads',
          id: [...new Set(awIds)][0] ?? null,
          events: conversionLabels.length > 0 ? ['conversion'] : [],
          hasEnhancedConversions: hasEnhanced,
          serverSide: false,
          confidence: 0.95,
          networkFires: 0,
          loadMethod: typeof gtag === 'function' ? 'direct' : 'gtm',
        });
      }
    }

    // --- TikTok Pixel ---
    {
      const ttq = w['ttq'] as Record<string, unknown> | undefined;
      if (ttq && (typeof ttq['track'] === 'function' || typeof ttq['page'] === 'function')) {
        let pixelId: string | null = null;

        // Method 1: ttq._i (array of pixel IDs)
        if (Array.isArray(ttq['_i'])) {
          pixelId = (ttq['_i'] as string[])[0] ?? null;
        }
        // Method 2: ttq._o (object with pixel IDs as keys)
        if (!pixelId && typeof ttq['_o'] === 'object' && ttq['_o']) {
          const keys = Object.keys(ttq['_o'] as Record<string, unknown>);
          if (keys[0]) pixelId = keys[0];
        }
        // Method 3: Inline script scan
        if (!pixelId) {
          document.querySelectorAll('script:not([src])').forEach(s => {
            const text = s.textContent || '';
            const m = text.match(/ttq\.load\s*\(\s*['"]([A-Z0-9]+)['"]/);
            if (m?.[1]) pixelId = m[1];
          });
        }

        found.push({
          name: 'TikTok Pixel',
          id: pixelId,
          events: [],
          hasEnhancedConversions: false,
          serverSide: false,
          confidence: 0.9,
          networkFires: 0,
          loadMethod: 'unknown',
        });
      }
    }

    // --- LinkedIn Insight Tag ---
    {
      const partnerId = w['_linkedin_partner_id'];
      const lintrk = w['lintrk'];
      if (partnerId || lintrk) {
        let pid: string | null = null;
        if (typeof partnerId === 'string') pid = partnerId;
        else if (typeof partnerId === 'number') pid = String(partnerId);

        // Inline script fallback
        if (!pid) {
          document.querySelectorAll('script:not([src])').forEach(s => {
            const text = s.textContent || '';
            const m = text.match(/_linkedin_partner_id\s*=\s*['"]?(\d+)/);
            if (m?.[1]) pid = m[1];
          });
        }

        found.push({
          name: 'LinkedIn Insight',
          id: pid,
          events: [],
          hasEnhancedConversions: false,
          serverSide: false,
          confidence: 0.9,
          networkFires: 0,
          loadMethod: 'unknown',
        });
      }
    }

    // --- Twitter/X Pixel ---
    {
      const twq = w['twq'] as Record<string, unknown> | undefined;
      if (typeof twq === 'function' || (twq && typeof twq['exe'] === 'function')) {
        let pixelId: string | null = null;

        // Method 1: twq.queue or twq._q for init calls
        const queue = (twq as Record<string, unknown>)['queue'] as unknown[][] | undefined;
        if (Array.isArray(queue)) {
          for (const call of queue) {
            if (Array.isArray(call) && call[0] === 'init' && typeof call[1] === 'string') {
              pixelId = call[1];
              break;
            }
          }
        }

        // Method 2: Inline script scan
        if (!pixelId) {
          document.querySelectorAll('script:not([src])').forEach(s => {
            const text = s.textContent || '';
            const m = text.match(/twq\s*\(\s*['"]init['"]\s*,\s*['"]([a-z0-9]+)['"]/i);
            if (m?.[1]) pixelId = m[1];
          });
        }

        found.push({
          name: 'Twitter/X Pixel',
          id: pixelId,
          events: [],
          hasEnhancedConversions: false,
          serverSide: false,
          confidence: 0.85,
          networkFires: 0,
          loadMethod: 'unknown',
        });
      }
    }

    // --- Pinterest Tag ---
    {
      const pintrk = w['pintrk'] as Record<string, unknown> | undefined;
      if (typeof pintrk === 'function') {
        let pixelId: string | null = null;
        document.querySelectorAll('script:not([src])').forEach(s => {
          const text = s.textContent || '';
          const m = text.match(/pintrk\s*\(\s*['"]load['"]\s*,\s*['"](\d+)['"]/);
          if (m?.[1]) pixelId = m[1];
        });

        found.push({
          name: 'Pinterest Tag',
          id: pixelId,
          events: [],
          hasEnhancedConversions: false,
          serverSide: false,
          confidence: 0.85,
          networkFires: 0,
          loadMethod: 'unknown',
        });
      }
    }

    // --- Snapchat Pixel ---
    {
      const snaptr = w['snaptr'] as Record<string, unknown> | undefined;
      if (typeof snaptr === 'function') {
        let pixelId: string | null = null;
        document.querySelectorAll('script:not([src])').forEach(s => {
          const text = s.textContent || '';
          const m = text.match(/snaptr\s*\(\s*['"]init['"]\s*,\s*['"]([a-f0-9-]+)['"]/i);
          if (m?.[1]) pixelId = m[1];
        });

        found.push({
          name: 'Snapchat Pixel',
          id: pixelId,
          events: [],
          hasEnhancedConversions: false,
          serverSide: false,
          confidence: 0.85,
          networkFires: 0,
          loadMethod: 'unknown',
        });
      }
    }

    // --- Microsoft/Bing UET ---
    {
      const uetq = w['uetq'] as unknown[] | undefined;
      const UET = w['UET'];
      if (uetq || UET) {
        let pixelId: string | null = null;

        // Method 1: UET config object
        if (UET && typeof UET === 'object') {
          const cfg = (UET as Record<string, unknown>)['tagsettings'] as Record<string, unknown> | undefined;
          if (cfg && typeof cfg['ti'] === 'string') pixelId = cfg['ti'];
        }

        // Method 2: Inline script scan
        if (!pixelId) {
          document.querySelectorAll('script:not([src])').forEach(s => {
            const text = s.textContent || '';
            const m = text.match(/uetq.*push\s*\(\s*['"]?config['"]?\s*,\s*\{\s*['"]?ti['"]?\s*:\s*['"](\d+)['"]/);
            if (m?.[1]) pixelId = m[1];
            // Also try: new UET({ti: "XXXX"})
            const m2 = text.match(/UET\s*\(\s*\{[^}]*ti\s*:\s*['"](\d+)['"]/);
            if (m2?.[1]) pixelId = m2[1];
          });
        }

        found.push({
          name: 'Microsoft Ads (UET)',
          id: pixelId,
          events: [],
          hasEnhancedConversions: false,
          serverSide: false,
          confidence: 0.9,
          networkFires: 0,
          loadMethod: 'unknown',
        });
      }
    }

    // --- Reddit Pixel ---
    {
      const rdt = w['rdt'] as Record<string, unknown> | undefined;
      if (typeof rdt === 'function') {
        let pixelId: string | null = null;
        document.querySelectorAll('script:not([src])').forEach(s => {
          const text = s.textContent || '';
          const m = text.match(/rdt\s*\(\s*['"]init['"]\s*,\s*['"]([a-z0-9]+)['"]/i);
          if (m?.[1]) pixelId = m[1];
        });

        found.push({
          name: 'Reddit Pixel',
          id: pixelId,
          events: [],
          hasEnhancedConversions: false,
          serverSide: false,
          confidence: 0.85,
          networkFires: 0,
          loadMethod: 'unknown',
        });
      }
    }

    // --- Criteo ---
    if (w['criteo_q'] || w['Criteo']) {
      found.push({
        name: 'Criteo',
        id: null,
        events: [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.85,
        networkFires: 0,
        loadMethod: 'unknown',
      });
    }

    // --- Taboola ---
    if (w['_tfa'] || w['TRC']) {
      found.push({
        name: 'Taboola',
        id: null,
        events: [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.8,
        networkFires: 0,
        loadMethod: 'unknown',
      });
    }

    // --- Outbrain ---
    if (w['obApi'] || w['OBR$']) {
      found.push({
        name: 'Outbrain',
        id: null,
        events: [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.8,
        networkFires: 0,
        loadMethod: 'unknown',
      });
    }

    return found;
  });

  // ─── Step 2: Enrich from network requests ────────────────────────────────
  const allRequests = nc?.getAllRequests() ?? [];
  const allResponses = nc?.getAllResponses() ?? [];
  const adRequests = nc?.getAdvertisingRequests() ?? [];
  data.adRequestCount = adRequests.length;

  // Network-based pixel enrichment: extract IDs + events from actual requests
  const networkExtractors: Array<{ name: string; extract: (r: CapturedRequest[]) => NetworkPixelData }> = [
    { name: 'Meta Pixel', extract: extractMetaFromNetwork },
    { name: 'TikTok Pixel', extract: extractTikTokFromNetwork },
    { name: 'LinkedIn Insight', extract: extractLinkedInFromNetwork },
    { name: 'Twitter/X Pixel', extract: extractTwitterFromNetwork },
    { name: 'Microsoft Ads (UET)', extract: extractUETFromNetwork },
    { name: 'Google Ads', extract: extractGoogleAdsFromNetwork },
    { name: 'Pinterest Tag', extract: extractPinterestFromNetwork },
    { name: 'Snapchat Pixel', extract: extractSnapchatFromNetwork },
    { name: 'Reddit Pixel', extract: extractRedditFromNetwork },
  ];

  for (const { name, extract } of networkExtractors) {
    const netData = extract(allRequests);
    const existing = pixels.find(p => p.name === name);

    if (existing) {
      // Enrich existing pixel with network data
      if (!existing.id && netData.id) existing.id = netData.id;
      if (netData.events.length > 0) {
        existing.events = [...new Set([...existing.events, ...netData.events])];
      }
      existing.networkFires = netData.fires;
    } else if (netData.fires > 0) {
      // Pixel not detected via globals but fires in network — add it
      pixels.push({
        name: netData.pixelName,
        id: netData.id,
        events: netData.events,
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.8,
        networkFires: netData.fires,
        loadMethod: 'gtm',
      });
    }
  }

  // Cookie-based fallback detection: if window globals and network both missed pixels,
  // check for tracking cookies that prove the pixel was loaded at some point.
  let cookieFallbackCount = 0;
  try {
    const rawCookies = await page.context().cookies();

    // Google Ads: _gcl_au or _gcl_aw cookies
    const hasGclAu = rawCookies.some(c => c.name === '_gcl_au');
    const hasGclAw = rawCookies.some(c => c.name === '_gcl_aw');
    if ((hasGclAu || hasGclAw) && !pixels.find(p => p.name === 'Google Ads')) {
      cookieFallbackCount++;
      const gadsNet = extractGoogleAdsFromNetwork(allRequests);
      pixels.push({
        name: 'Google Ads',
        id: gadsNet.id,
        events: gadsNet.events.length > 0 ? gadsNet.events : ['conversion_linker'],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.85,
        networkFires: gadsNet.fires,
        loadMethod: 'gtm',
      });
    }

    // Meta Pixel: _fbp or _fbc cookies
    const hasFbp = rawCookies.some(c => c.name === '_fbp');
    const hasFbc = rawCookies.some(c => c.name === '_fbc');
    if ((hasFbp || hasFbc) && !pixels.find(p => p.name === 'Meta Pixel')) {
      cookieFallbackCount++;
      const metaNet = extractMetaFromNetwork(allRequests);
      pixels.push({
        name: 'Meta Pixel',
        id: metaNet.id,
        events: metaNet.events.length > 0 ? metaNet.events : ['PageView'],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.8,
        networkFires: metaNet.fires,
        loadMethod: 'gtm',
      });
    }

    // LinkedIn Insight: li_fat_id or _li_ss cookies
    const hasLiFat = rawCookies.some(c => c.name === 'li_fat_id');
    const hasLiSs = rawCookies.some(c => c.name === '_li_ss');
    if ((hasLiFat || hasLiSs) && !pixels.find(p => p.name === 'LinkedIn Insight')) {
      cookieFallbackCount++;
      const liNet = extractLinkedInFromNetwork(allRequests);
      pixels.push({
        name: 'LinkedIn Insight',
        id: liNet.id,
        events: liNet.events.length > 0 ? liNet.events : [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.8,
        networkFires: liNet.fires,
        loadMethod: 'gtm',
      });
    }

    // Microsoft Ads (UET): _uetsid or _uetvid cookies
    const hasUetSid = rawCookies.some(c => c.name === '_uetsid');
    const hasUetVid = rawCookies.some(c => c.name === '_uetvid');
    if ((hasUetSid || hasUetVid) && !pixels.find(p => p.name === 'Microsoft Ads (UET)')) {
      cookieFallbackCount++;
      const uetNet = extractUETFromNetwork(allRequests);
      pixels.push({
        name: 'Microsoft Ads (UET)',
        id: uetNet.id,
        events: uetNet.events.length > 0 ? uetNet.events : [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.8,
        networkFires: uetNet.fires,
        loadMethod: 'gtm',
      });
    }
  } catch { /* cookie access can fail in restricted contexts */ }
  data.cookieFallbackCount = cookieFallbackCount;

  // Amazon Ads: network-based detection
  const amazonNet = extractAmazonAdsFromNetwork(allRequests);
  if (amazonNet.fires > 0 && !pixels.find(p => p.name === 'Amazon Ads')) {
    pixels.push({
      name: 'Amazon Ads',
      id: amazonNet.id,
      events: amazonNet.events,
      hasEnhancedConversions: false,
      serverSide: false,
      confidence: 0.8,
      networkFires: amazonNet.fires,
      loadMethod: 'gtm',
    });
  }

  // Detect niche/audio/podcast pixels from network
  const nichePixels = detectNichePixelsFromNetwork(allRequests);
  for (const np of nichePixels) {
    if (!pixels.find(p => p.name === np.name)) {
      pixels.push(np);
    }
  }

  data.pixels = pixels;

  // ─── Step 3: Detect CAPI / server-side (DRY with M05) ─────────────────
  let capiDetected = false;

  // Check 1: Direct network evidence (graph.facebook.com CAPI calls)
  for (const req of allRequests) {
    if (/graph\.facebook\.com.*events|facebook\.com\/tr.*server/i.test(req.url)) {
      capiDetected = true;
      const metaPixel = pixels.find(p => p.name === 'Meta Pixel');
      if (metaPixel) metaPixel.serverSide = true;
    }
  }

  // Check 2: DRY — read M05 sGTM detection
  const m05Result = ctx.previousResults.get('M05' as ModuleId);
  const m05Data = m05Result?.data as Record<string, unknown> | undefined;
  const m05ServerSide = m05Data?.serverSideTracking === true;
  if (m05ServerSide && !capiDetected) {
    capiDetected = true; // sGTM detected in M05 means server-side infrastructure exists
  }
  data.capiDetected = capiDetected;
  data.capiSource = capiDetected ? (m05ServerSide ? 'sGTM (via M05)' : 'CAPI network') : null;

  // ─── Step 4: Real ad script byte calculation ──────────────────────────
  const { totalBytes: adScriptBytes, scriptCount: adScriptCount, byPlatform: adBytesByPlatform } =
    calculateRealAdBytes(adRequests, allResponses);
  data.adScriptBytes = adScriptBytes;
  data.adScriptCount = adScriptCount;
  data.adBytesByPlatform = adBytesByPlatform;

  // ─── Step 5: Click IDs and UTMs ──────────────────────────────────────
  const pageUrl = page.url();
  const urlParams = new URL(pageUrl).searchParams;

  const clickIds: Record<string, string | null> = {};
  const clickIdParams = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'li_fat_id', 'msclkid', 'twclid', 'ScCid', 'rdt_cid', 'epik', 'dclid', 'irclickid'];
  for (const param of clickIdParams) {
    const val = urlParams.get(param);
    if (val) clickIds[param] = val;
  }
  data.clickIds = clickIds;
  const clickIdCount = Object.keys(clickIds).length;

  const utmParams: Record<string, string | null> = {};
  for (const param of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id']) {
    const val = urlParams.get(param);
    if (val) utmParams[param] = val;
  }
  data.utmParams = utmParams;

  // ─── Step 6: Attribution cookies ─────────────────────────────────────
  let attributionCookies: Array<{ name: string; domain: string; platform: string }> = [];
  try {
    const rawCookies = await page.context().cookies();
    const attrPatterns: Array<{ pattern: RegExp; platform: string }> = [
      // Meta
      { pattern: /^_fbp$/, platform: 'Meta' },
      { pattern: /^_fbc$/, platform: 'Meta' },
      // Google
      { pattern: /^_gcl_aw$/, platform: 'Google Ads' },
      { pattern: /^_gcl_au$/, platform: 'Google Ads' },
      { pattern: /^_gcl_dc$/, platform: 'Google Display' },
      { pattern: /^_gcl_gb$/, platform: 'Google Ads' },
      { pattern: /^FPAU$/, platform: 'Google Ads' },
      { pattern: /^IDE$/, platform: 'DoubleClick' },
      { pattern: /^DSID$/, platform: 'DoubleClick' },
      { pattern: /^ar_debug$/, platform: 'DoubleClick' },
      // TikTok
      { pattern: /^_ttp$/, platform: 'TikTok' },
      // Microsoft
      { pattern: /^_uetsid$/, platform: 'Microsoft Ads' },
      { pattern: /^_uetvid$/, platform: 'Microsoft Ads' },
      { pattern: /^MUID$/, platform: 'Microsoft' },
      // LinkedIn
      { pattern: /^li_sugr$/, platform: 'LinkedIn' },
      { pattern: /^UserMatchHistory$/, platform: 'LinkedIn' },
      { pattern: /^AnalyticsSyncHistory$/, platform: 'LinkedIn' },
      { pattern: /^bcookie$/, platform: 'LinkedIn' },
      // Twitter
      { pattern: /^guest_id_ads$/, platform: 'Twitter/X' },
      { pattern: /^muc_ads$/, platform: 'Twitter/X' },
      { pattern: /^personalization_id$/, platform: 'Twitter/X' },
      // Pinterest
      { pattern: /^_pin_unauth$/, platform: 'Pinterest' },
      { pattern: /^_epik$/, platform: 'Pinterest' },
      // Snapchat
      { pattern: /^_scid$/, platform: 'Snapchat' },
      // Reddit
      { pattern: /^_rdt_uuid$/, platform: 'Reddit' },
      // Amazon
      { pattern: /^ad-id$/, platform: 'Amazon Ads' },
      { pattern: /^ad-privacy$/, platform: 'Amazon Ads' },
      // Impact Radius
      { pattern: /^IR_/, platform: 'Impact Radius' },
      // TVSquared
      { pattern: /^_tq_id/, platform: 'TVSquared' },
      // Tapad
      { pattern: /^TapAd_/, platform: 'Tapad' },
    ];

    attributionCookies = rawCookies
      .filter(c => attrPatterns.some(p => p.pattern.test(c.name)))
      .map(c => {
        const match = attrPatterns.find(p => p.pattern.test(c.name));
        return { name: c.name, domain: c.domain, platform: match?.platform ?? 'unknown' };
      });
  } catch {
    // Cookie access failure is non-fatal
  }
  data.attributionCookies = attributionCookies;

  // Group attribution cookies by platform
  const cookiesByPlatform: Record<string, string[]> = {};
  for (const c of attributionCookies) {
    if (!cookiesByPlatform[c.platform]) cookiesByPlatform[c.platform] = [];
    cookiesByPlatform[c.platform]!.push(c.name);
  }
  data.cookiesByPlatform = cookiesByPlatform;

  // ─── Step 7: Build signals ───────────────────────────────────────────
  for (const pixel of pixels) {
    signals.push(
      createSignal({
        type: 'ad_pixel',
        name: pixel.name,
        confidence: pixel.confidence,
        evidence: pixel.id
          ? `${pixel.name} (${pixel.id})${pixel.networkFires > 0 ? ` — ${pixel.networkFires} fires` : ''}`
          : `${pixel.name} detected${pixel.networkFires > 0 ? ` — ${pixel.networkFires} network fires` : ''}`,
        category: 'advertising',
      }),
    );
  }

  if (capiDetected) {
    signals.push(createSignal({
      type: 'server_side_tracking',
      name: 'CAPI/sGTM',
      confidence: 0.85,
      evidence: m05ServerSide ? 'Server-side GTM endpoint detected (via M05)' : 'Facebook CAPI network calls detected',
      category: 'advertising',
    }));
  }

  // ─── Step 8: Build checkpoints ───────────────────────────────────────
  const hasAnyPixel = pixels.length > 0 || adRequests.length > 0;
  const totalNetworkFires = pixels.reduce((sum, p) => sum + p.networkFires, 0);

  // CP1: Ad pixel presence
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (pixels.length >= 3 && totalNetworkFires > 0) {
      health = 'excellent';
      evidence = `${pixels.length} ad pixels detected and firing: ${pixels.map(p => p.name).join(', ')}`;
    } else if (pixels.length >= 2 && adRequests.length > 0) {
      health = 'excellent';
      evidence = `${pixels.length} ad pixels detected: ${pixels.map(p => p.name).join(', ')}`;
    } else if (pixels.length >= 1 && adRequests.length > 0) {
      health = 'good';
      evidence = `${pixels.length} ad pixel(s): ${pixels.map(p => p.name).join(', ')}`;
    } else if (pixels.length >= 1) {
      health = 'warning';
      evidence = 'Ad pixel script loads but no pixel fires detected in network';
      recommendation = 'Verify pixel initialization — the script may load but not trigger events.';
    } else {
      health = 'critical';
      evidence = 'No advertising pixels detected';
      recommendation = 'If running paid media, install the appropriate conversion pixels (Meta, Google Ads, etc.).';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-pixel-presence', name: 'Ad Pixel Presence', weight: 0.9, health, evidence, recommendation }));
  }

  // CP2: Enhanced conversions
  {
    const hasEnhanced = pixels.some(p => p.hasEnhancedConversions);
    const hasConversion = pixels.some(p => p.events.length > 0);

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (hasEnhanced) {
      health = 'excellent';
      evidence = `Enhanced conversions enabled: ${pixels.filter(p => p.hasEnhancedConversions).map(p => p.name).join(', ')}`;
    } else if (hasConversion) {
      health = 'good';
      evidence = `Standard conversion tracking detected: ${pixels.filter(p => p.events.length > 0).map(p => `${p.name} (${p.events.join(', ')})`).join('; ')}`;
      recommendation = 'Enable Enhanced Conversions (Google Ads) or Advanced Matching (Meta) for better attribution.';
    } else if (hasAnyPixel) {
      health = 'warning';
      evidence = 'Pixels present but no conversion events detected on this page';
      recommendation = 'Configure conversion events (Purchase, Lead, etc.) for proper attribution.';
    } else {
      health = 'critical';
      evidence = 'No conversion tracking infrastructure detected';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-enhanced-conv', name: 'Enhanced Conversions', weight: 0.7, health, evidence, recommendation }));
  }

  // CP3: Conversion event coverage
  {
    const allEvents = pixels.flatMap(p => p.events);
    const keyEvents = ['Purchase', 'Lead', 'AddToCart', 'ViewContent', 'CompleteRegistration', 'conversion', 'PageView', 'pageview', 'page_view', 'Pageview', 'impression'];
    const foundKeyEvents = [...new Set(allEvents.filter(e => keyEvents.some(ke => e.toLowerCase().includes(ke.toLowerCase()))))];
    const uniqueEvents = [...new Set(allEvents)];

    let health: CheckpointHealth;
    let evidence: string;

    if (foundKeyEvents.length >= 3) {
      health = 'excellent';
      evidence = `Comprehensive event coverage: ${uniqueEvents.join(', ')}`;
    } else if (foundKeyEvents.length >= 1 || uniqueEvents.length >= 2) {
      health = 'good';
      evidence = `Conversion events detected: ${uniqueEvents.join(', ')}`;
    } else if (uniqueEvents.length >= 1) {
      health = 'good';
      evidence = `Events: ${uniqueEvents.join(', ')}`;
    } else if (hasAnyPixel) {
      health = 'warning';
      evidence = 'Pixels present but no conversion events detected on this page (may fire on conversion pages only)';
    } else {
      health = 'critical';
      evidence = 'No conversion event coverage';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-conv-events', name: 'Conversion Event Coverage', weight: 0.8, health, evidence }));
  }

  // CP4: Click ID capture
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (clickIdCount >= 2) {
      health = 'excellent';
      evidence = `Click IDs preserved: ${Object.keys(clickIds).join(', ')}`;
    } else if (clickIdCount === 1) {
      health = 'good';
      evidence = `Click ID captured: ${Object.keys(clickIds)[0]}`;
    } else {
      health = 'good';
      evidence = 'No click IDs in current URL (normal for organic/direct visits)';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-click-ids', name: 'Click ID Capture', weight: 0.6, health, evidence }));
  }

  // CP5: Attribution cookies
  {
    const platformCount = Object.keys(cookiesByPlatform).length;
    let health: CheckpointHealth;
    let evidence: string;

    if (platformCount >= 3) {
      health = 'excellent';
      evidence = `Attribution cookies from ${platformCount} platforms: ${Object.entries(cookiesByPlatform).map(([p, cs]) => `${p} (${cs.join(', ')})`).join('; ')}`;
    } else if (platformCount >= 1) {
      health = 'good';
      evidence = `${attributionCookies.length} attribution cookie(s) from ${platformCount} platform(s): ${Object.keys(cookiesByPlatform).join(', ')}`;
    } else if (hasAnyPixel) {
      health = 'warning';
      evidence = 'Ad pixels present but no attribution cookies set';
    } else {
      health = 'good';
      evidence = 'No attribution cookies (no ad pixels detected)';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-attr-cookies', name: 'Attribution Cookies', weight: 0.5, health, evidence }));
  }

  // CP6: UTM parameter handling
  {
    const hasUtm = Object.keys(utmParams).length > 0;
    checkpoints.push(
      hasUtm
        ? createCheckpoint({ id: 'm06-utm', name: 'UTM Parameter Handling', weight: 0.6, health: 'excellent', evidence: `UTM parameters detected: ${Object.entries(utmParams).map(([k, v]) => `${k}=${v}`).join(', ')}` })
        : infoCheckpoint({ id: 'm06-utm', name: 'UTM Parameter Handling', weight: 0.6, evidence: 'No UTM parameters in current URL (normal for organic/direct)' }),
    );
  }

  // CP7: CAPI / server-side pixels
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (capiDetected && m05ServerSide) {
      health = 'excellent';
      evidence = 'Server-side GTM endpoint detected — CAPI/sGTM infrastructure in place';
    } else if (capiDetected) {
      health = 'excellent';
      evidence = 'Server-side conversion events detected (CAPI)';
    } else {
      health = 'good'; // Info-level — not penalized but noted
      evidence = 'Client-side pixels only — server-side CAPI improves attribution accuracy and data resilience';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-capi', name: 'Server-Side Conversions (CAPI)', weight: 0.5, health, evidence }));
  }

  // CP8: Pixel consent compliance (DRY: read M05 + M08)
  {
    const m05Consent = (m05Data?.consent as Record<string, unknown>) ?? {};
    const consentPlatform = m05Consent.consentPlatform as string | null;
    const hasConsentMode = m05Consent.hasConsentMode === true;

    // DRY: also check M08 for consent indicators
    const m08Result = ctx.previousResults.get('M08' as ModuleId);
    const m08Data = m08Result?.data as Record<string, unknown> | undefined;
    const m08DataLayer = m08Data?.dataLayer as Record<string, unknown> | undefined;
    const m08Events = m08DataLayer?.events as string[] | undefined;
    const hasConsentEvent = m08Events?.some(e => /consent/i.test(e)) ?? false;
    const preConsentFires = (m08Data?.tagAudit as Record<string, unknown>)?.preConsentFires;
    const zeroPreConsent = preConsentFires === 0;

    const hasAnyConsent = !!consentPlatform || hasConsentMode || hasConsentEvent;

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (hasAnyConsent && zeroPreConsent) {
      health = 'excellent';
      evidence = `Consent management active${consentPlatform ? ` (${consentPlatform})` : ''}, zero pre-consent fires`;
    } else if (hasAnyConsent && adRequests.length > 0) {
      health = 'good';
      evidence = `Consent signals detected${consentPlatform ? ` (${consentPlatform})` : hasConsentEvent ? ' (consent events in dataLayer)' : ''} — verify pre-consent behavior`;
    } else if (!hasAnyConsent && adRequests.length > 0) {
      health = 'warning';
      evidence = 'Ad pixels fire but no consent management detected';
      recommendation = 'Implement a CMP to gate ad pixel firing until user consent is obtained.';
    } else if (hasAnyConsent) {
      health = 'excellent';
      evidence = `Consent platform active, no ad requests fired (may be awaiting consent)`;
    } else {
      health = 'good';
      evidence = 'No ad pixels to gate (consent N/A)';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-pixel-consent', name: 'Pixel Consent Compliance', weight: 0.8, health, evidence, recommendation }));
  }

  // CP9: Ad script performance impact (now with real bytes)
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (adScriptCount === 0) {
      health = 'excellent';
      evidence = 'No ad scripts detected — zero performance impact';
    } else if (adScriptBytes < 100_000) {
      health = 'excellent';
      evidence = `${adScriptCount} ad scripts (~${Math.round(adScriptBytes / 1024)}KB)`;
    } else if (adScriptBytes < 250_000) {
      health = 'good';
      evidence = `${adScriptCount} ad scripts (~${Math.round(adScriptBytes / 1024)}KB)`;
    } else if (adScriptBytes < 500_000) {
      health = 'warning';
      evidence = `${adScriptCount} ad scripts totaling ~${Math.round(adScriptBytes / 1024)}KB`;
      recommendation = 'Consolidate ad scripts through a tag manager and ensure async loading.';
    } else {
      health = 'critical';
      evidence = `Heavy ad script footprint: ${adScriptCount} scripts (~${Math.round(adScriptBytes / 1024)}KB)`;
      recommendation = 'Significant ad script overhead — consolidate via server-side tagging to reduce client-side weight.';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-ad-perf', name: 'Ad Script Performance Impact', weight: 0.4, health, evidence, recommendation }));
  }

  // CP10: Pixel fire verification (network evidence vs. script-only)
  {
    const pixelsWithFires = pixels.filter(p => p.networkFires > 0);
    const pixelsNoFires = pixels.filter(p => p.networkFires === 0);

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (pixels.length === 0) {
      health = 'good';
      evidence = 'No pixels to verify';
    } else if (pixelsWithFires.length === pixels.length) {
      health = 'excellent';
      evidence = `All ${pixels.length} pixels verified firing: ${pixelsWithFires.map(p => `${p.name} (${p.networkFires})`).join(', ')}`;
    } else if (pixelsWithFires.length > 0) {
      health = 'good';
      evidence = `${pixelsWithFires.length}/${pixels.length} pixels verified firing; unverified: ${pixelsNoFires.map(p => p.name).join(', ')}`;
      recommendation = `Verify ${pixelsNoFires.map(p => p.name).join(', ')} — scripts load but no network fires detected.`;
    } else {
      health = 'warning';
      evidence = 'Pixel scripts detected but zero network fires verified (may be blocked by consent)';
      recommendation = 'Check if pixels are gated behind consent and verify they fire after consent is granted.';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-fire-verify', name: 'Pixel Fire Verification', weight: 0.5, health, evidence, recommendation }));
  }

  // CP11: Attribution window coverage (how many platforms have both pixel + cookie)
  {
    const pixelPlatforms = new Set(pixels.map(p => p.name));
    const cookiePlatforms = new Set(Object.keys(cookiesByPlatform));
    const fullCoverage: string[] = [];
    const pixelOnly: string[] = [];

    for (const pp of pixelPlatforms) {
      // Map pixel name to cookie platform name
      const cookieName = pp === 'Meta Pixel' ? 'Meta'
        : pp === 'Microsoft Ads (UET)' ? 'Microsoft Ads'
        : pp === 'Twitter/X Pixel' ? 'Twitter/X'
        : pp.replace(' Pixel', '').replace(' Insight', '').replace(' Tag', '');

      if (cookiePlatforms.has(cookieName) || cookiePlatforms.has(pp)) {
        fullCoverage.push(pp);
      } else {
        pixelOnly.push(pp);
      }
    }

    let health: CheckpointHealth;
    let evidence: string;

    if (pixels.length === 0) {
      health = 'good';
      evidence = 'No pixels for attribution coverage assessment';
    } else if (fullCoverage.length >= pixels.length * 0.8) {
      health = 'excellent';
      evidence = `${fullCoverage.length}/${pixels.length} platforms have pixel + attribution cookie: ${fullCoverage.join(', ')}`;
    } else if (fullCoverage.length >= 1) {
      health = 'good';
      evidence = `${fullCoverage.length}/${pixels.length} platforms fully covered; pixel-only: ${pixelOnly.join(', ')}`;
    } else {
      health = 'warning';
      evidence = 'Pixels detected but no matching attribution cookies — cookie blocking or consent may prevent attribution';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-attr-coverage', name: 'Attribution Window Coverage', weight: 0.4, health, evidence }));
  }

  data.pixelCount = pixels.length;
  data.pixelNames = pixels.map(p => p.name);
  data.totalNetworkFires = totalNetworkFires;

  return {
    moduleId: 'M06' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null,
    checkpoints,
    duration: 0,
  };
};

export { execute };
registerModuleExecutor('M06' as ModuleId, execute);
