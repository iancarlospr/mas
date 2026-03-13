/**
 * M21 - Ad Library Extractor
 *
 * Navigates Facebook Ad Library and Google Ads Transparency Center using
 * browser automation. Captures screenshots and extracts Facebook CTA URLs.
 * Uploads 12 images to Supabase Storage for AI analysis and dashboard rendering.
 *
 * Checkpoints:
 *   1. Facebook Ad Library (weight: 0.35)
 *   2. Google Search Ads (weight: 0.35)
 *   3. YouTube Ads (weight: 0.15)
 *   4. Multi-Platform Advertising (weight: 0.15)
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint } from '../../utils/signals.js';
import { BrowserPool } from '../../ghostscan/browser-pool.js';
import { getSupabaseAdmin, getScanById } from '../../services/supabase.js';
import { callFlash } from '../../services/gemini.js';
import { z } from 'zod';
import type { Page } from 'patchright';
import pino from 'pino';

const logger = pino({ name: 'm21-ad-library' });

// ---------------------------------------------------------------------------
// Facebook page identification from previous modules
// ---------------------------------------------------------------------------

/**
 * Extract the Facebook page slug from a Facebook URL.
 * Handles: /PageName, /pages/PageName/ID, /profile.php?id=ID
 */
function parseFacebookSlug(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/+$/, '');

    // facebook.com/pages/PageName/123456789
    const pagesMatch = pathname.match(/^\/pages\/([^/]+)/);
    if (pagesMatch) return decodeURIComponent(pagesMatch[1]!).replace(/-/g, ' ');

    // facebook.com/profile.php?id=123456789
    if (pathname === '/profile.php') return parsed.searchParams.get('id');

    // facebook.com/PageName (standard format)
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) return decodeURIComponent(segments[0]!);

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract the Facebook page slug from M15 or M04 previous results.
 * Priority: M15 sameAsLinks (browser-rendered) → M04 socialProfiles (passive).
 */
function extractFacebookSlug(ctx: ModuleContext): string | null {
  const findInUrls = (urls: string[]): string | null => {
    for (const url of urls) {
      if (/facebook\.com\//i.test(url)) {
        const slug = parseFacebookSlug(url);
        if (slug) return slug;
      }
    }
    return null;
  };

  // Source 1: M15 sameAsLinks (browser-rendered, most reliable)
  try {
    const m15 = ctx.previousResults.get('M15' as ModuleId);
    if (m15 && m15.status !== 'error' && m15.status !== 'skipped') {
      const socialData = (m15.data as Record<string, unknown>)?.socialData as { sameAsLinks?: string[] } | undefined;
      if (socialData?.sameAsLinks) {
        const slug = findInUrls(socialData.sameAsLinks);
        if (slug) {
          logger.info({ slug, source: 'M15' }, 'Extracted Facebook slug from M15 sameAsLinks');
          return slug;
        }
      }
    }
  } catch { /* fall through */ }

  // Source 2: M04 socialProfiles (passive HTML parse)
  try {
    const m04 = ctx.previousResults.get('M04' as ModuleId);
    if (m04 && m04.status !== 'error' && m04.status !== 'skipped') {
      const jsonLd = (m04.data as Record<string, unknown>)?.jsonLd as { socialProfiles?: string[] } | undefined;
      if (jsonLd?.socialProfiles) {
        const slug = findInUrls(jsonLd.socialProfiles);
        if (slug) {
          logger.info({ slug, source: 'M04' }, 'Extracted Facebook slug from M04 socialProfiles');
          return slug;
        }
      }
    }
  } catch { /* fall through */ }

  return null;
}

interface FacebookPageInfo {
  pageName: string | null;
  pageId: string | null;
}

/**
 * Resolve a Facebook page slug to its display name and numeric page ID.
 * The display name is what the Ad Library uses for advertiser search
 * (which can differ from the page slug — e.g., slug "pideuva" → name "Uva App").
 * The numeric page ID enables direct Ad Library navigation via view_all_page_id.
 */
async function resolveFacebookPageInfo(pool: BrowserPool, slug: string): Promise<FacebookPageInfo> {
  let page: Page | null = null;
  try {
    page = await pool.createPage('https://www.facebook.com');
    await page.goto(`https://www.facebook.com/${encodeURIComponent(slug)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });
    await new Promise(r => setTimeout(r, 3000));

    const info = await page.evaluate(() => {
      // --- Page name extraction ---
      let pageName: string | null = null;
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
      if (ogTitle) {
        pageName = ogTitle.trim();
      } else {
        const title = document.title;
        if (title.includes('|')) pageName = title.split('|')[0]!.trim();
        else if (title.includes('-')) pageName = title.split('-')[0]!.trim();
        else pageName = title?.trim() || null;
      }

      // --- Numeric page ID extraction ---
      let pageId: string | null = null;
      const idPattern = /^(\d{5,})$/;

      // Priority 1: al:android:url meta tag (fb://page/ID or fb://profile/ID)
      const androidUrl = document.querySelector('meta[property="al:android:url"]')?.getAttribute('content');
      if (androidUrl) {
        const match = androidUrl.match(/fb:\/\/(?:page|profile)\/(\d+)/);
        if (match?.[1] && idPattern.test(match[1])) pageId = match[1];
      }

      // Priority 2: al:ios:url meta tag (fb://page/ID or fb://profile/ID)
      if (!pageId) {
        const iosUrl = document.querySelector('meta[property="al:ios:url"]')?.getAttribute('content');
        if (iosUrl) {
          const match = iosUrl.match(/fb:\/\/(?:page|profile)\/(\d+)/);
          if (match?.[1] && idPattern.test(match[1])) pageId = match[1];
        }
      }

      // Priority 3: JSON patterns in script tags
      if (!pageId) {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          const text = script.textContent ?? '';
          if (text.length < 100) continue;
          // "pageID":"123456789"
          const m1 = text.match(/"pageID"\s*:\s*"(\d{5,})"/);
          if (m1?.[1]) { pageId = m1[1]; break; }
          // "page_id":"123456789"
          const m2 = text.match(/"page_id"\s*:\s*"(\d{5,})"/);
          if (m2?.[1]) { pageId = m2[1]; break; }
          // "entity_id":"123456789"
          const m3 = text.match(/"entity_id"\s*:\s*"(\d{5,})"/);
          if (m3?.[1]) { pageId = m3[1]; break; }
        }
      }

      return { pageName, pageId };
    });

    if (info.pageName) {
      logger.info({ slug, pageName: info.pageName, pageId: info.pageId }, 'Resolved Facebook page info');
    } else {
      logger.warn({ slug, pageId: info.pageId }, 'Could not resolve Facebook page display name');
    }
    return info;
  } catch (err) {
    logger.warn({ slug, error: (err as Error).message }, 'Failed to resolve Facebook page info');
    return { pageName: null, pageId: null };
  } finally {
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
  }
}

/**
 * Convert an ISO 3166-1 alpha-2 country code to its English display name.
 * Facebook's country dropdown uses these English names for autocomplete.
 */
function getCountryDisplayName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? 'United States';
  } catch {
    return 'United States';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Hide all fixed/sticky elements on the page so they don't float in the
 * middle of a full-page screenshot. Call `restoreFixedElements` to undo.
 */
async function hideFixedElements(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const pos = window.getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') {
        (el as HTMLElement).dataset.m21Hidden = '1';
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
      }
    }
  });
  await new Promise(r => setTimeout(r, 200));
}

/**
 * Restore elements previously hidden by `hideFixedElements`.
 */
async function restoreFixedElements(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-m21-hidden]')) {
      (el as HTMLElement).style.removeProperty('display');
      delete (el as HTMLElement).dataset.m21Hidden;
    }
  });
}

/**
 * Upload a screenshot buffer to Supabase Storage and return the public URL.
 */
async function uploadScreenshot(
  scanId: string,
  fileName: string,
  buffer: Buffer,
): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const path = `${scanId}/${fileName}`;

    const { error } = await supabase.storage
      .from('ad-screenshots')
      .upload(path, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      logger.warn({ scanId, fileName, error: error.message }, 'Screenshot upload failed');
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('ad-screenshots')
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch (err) {
    logger.warn({ scanId, fileName, error: (err as Error).message }, 'Screenshot upload error');
    return null;
  }
}

/**
 * Ensure the ad-screenshots bucket exists (idempotent).
 */
async function ensureBucket(): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    // createBucket is idempotent — returns an error if bucket already exists
    const { error } = await supabase.storage.createBucket('ad-screenshots', {
      public: true,
    });
    if (error && !error.message.includes('already exists')) {
      logger.warn({ error: error.message }, 'Failed to create ad-screenshots bucket');
    }
  } catch {
    // Bucket likely already exists
  }
}

/**
 * Extract UTM parameters from a URL string.
 */
function extractUtmParams(url: string): Record<string, string> {
  try {
    const parsed = new URL(url);
    const utms: Record<string, string> = {};
    for (const [key, value] of parsed.searchParams.entries()) {
      if (key.startsWith('utm_')) {
        utms[key] = value;
      }
    }
    return utms;
  } catch {
    return {};
  }
}


// ---------------------------------------------------------------------------
// Part 1: Facebook Ad Library
// ---------------------------------------------------------------------------

interface FacebookResult {
  screenshots: {
    fullPage: string | null;
    ads: string[];
  };
  ads: Array<{
    ctaUrl: string | null;
    utmParams: Record<string, string>;
    adText: string | null;
    ctaButtonText: string | null;
    advertiserName: string | null;
    advertiserHandle: string | null;
    startedRunning: string | null;
    platforms: string[];
    transparencyByLocation: string | null;
    beneficiaryAndPayer: string | null;
    reachData: Array<{ label: string; reach: string }>;
  }>;
  brandPageName: string | null;
  totalAdsVisible: number;
  searchSuccessful: boolean;
  pageId: string | null;
  directNavigation: boolean;
}

/**
 * Use Gemini Flash to pick the best advertiser from a list of autocomplete options.
 * Returns the 0-based index of the best match, or -1 if none match.
 */
async function pickBestAdvertiser(
  options: string[],
  context: { fbSlug: string; pageName: string | null; brandUrl: string; countryCode: string },
): Promise<number> {
  const PickSchema = z.object({
    index: z.number().int().min(-1),
    reasoning: z.string(),
  });

  const numbered = options.map((text, i) => `[${i}] ${text}`).join('\n');
  const prompt = `You are selecting the correct Facebook advertiser page from an autocomplete dropdown in Facebook Ad Library.

BUSINESS CONTEXT:
- Website URL: ${context.brandUrl}
- Facebook page slug: ${context.fbSlug}
- Facebook page display name: ${context.pageName ?? 'unknown'}
- Country: ${context.countryCode}

AUTOCOMPLETE OPTIONS:
${numbered}

RULES:
1. Pick the option that is the SAME business as the website URL above.
2. The page slug "${context.fbSlug}" and display name "${context.pageName ?? 'unknown'}" are strong signals — the correct option usually contains one of these names.
3. Ignore options that say "Search this exact phrase" or "Search for exact phrase" — these are NOT advertisers.
4. If an option has a follower count or category label (e.g. "147K followers · Supermarket"), that's additional signal.
5. Prefer options with location/category matching the business (e.g. a Puerto Rico supermarket for a PR grocery chain).
6. If NO option is a clear match for this business, return index -1.

Return JSON: { "index": <0-based index of best match or -1>, "reasoning": "<brief explanation>" }`;

  try {
    const result = await callFlash(prompt, PickSchema, {
      temperature: 0.1,
      maxTokens: 256,
    });
    logger.info({ index: result.data.index, reasoning: result.data.reasoning }, 'Gemini picked advertiser');
    return result.data.index;
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'Gemini advertiser selection failed — falling back to first option');
    return -1;
  }
}

async function scrapeFacebookAdLibrary(
  pool: BrowserPool,
  scanId: string,
  countryCode: string,
  brandName: string,
  pageId: string | null,
  fbSlug: string | null,
  brandUrl: string,
): Promise<FacebookResult> {
  const result: FacebookResult = {
    screenshots: { fullPage: null, ads: [] },
    ads: [],
    brandPageName: null,
    totalAdsVisible: 0,
    searchSuccessful: false,
    pageId,
    directNavigation: false,
  };

  // The search term should be the Facebook slug (page username) when available,
  // not the og:title display name. "SupermaxPR" is what Facebook's autocomplete
  // recognizes — not the display name "SuperMax" which matches unrelated pages.
  const searchTerm = fbSlug ?? brandName;

  let page: Page | null = null;

  try {
    page = await pool.createPage('https://www.facebook.com');

    const countryName = getCountryDisplayName(countryCode);
    logger.info({ scanId, searchTerm, brandName, country: countryName, countryCode, pageId }, 'Navigating to Facebook Ad Library');

    // Navigate to Ad Library and set up country + category
    await page.goto('https://www.facebook.com/ads/library/', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await sleep(4000);

    // ── Step 1: Select country from the dropdown ──────────────────────────
    try {
      const countryCombo = page.locator('[role="combobox"]').first();
      await countryCombo.click({ timeout: 5_000, force: true });
      await sleep(1000);

      const countrySearch = page.locator('input[placeholder*="country" i], input[placeholder*="Search for" i]').first();
      await countrySearch.waitFor({ state: 'visible', timeout: 5_000 });
      await countrySearch.click({ timeout: 3_000 });
      await countrySearch.fill('');
      await sleep(300);
      await countrySearch.type(countryName, { delay: 80 });
      await sleep(2000);

      const countryCell = page.locator(`[role="gridcell"]:has-text("${countryName}")`).first();
      await countryCell.waitFor({ state: 'visible', timeout: 5_000 });
      await countryCell.click({ timeout: 3_000, force: true });
      logger.info({ scanId, country: countryName }, 'Selected country');
      await sleep(2000);
    } catch (err) {
      logger.warn({ scanId, error: (err as Error).message }, 'Failed to select country — continuing with default');
    }

    // ── Step 2: Select "All ads" from category dropdown ─────────────────
    try {
      const adCategoryCombo = page.locator('[role="combobox"]:has-text("Ad category"), [role="combobox"]:has-text("All ads"), [role="combobox"]:has-text("Issues")').first();
      await adCategoryCombo.click({ timeout: 5_000, force: true });
      await sleep(1500);

      const allAdsCell = page.locator('[role="gridcell"]:has-text("All ads")').first();
      await allAdsCell.waitFor({ state: 'visible', timeout: 5_000 });
      await allAdsCell.click({ timeout: 3_000, force: true });
      logger.info({ scanId }, 'Selected "All ads" category');
      await sleep(2000);
    } catch (err) {
      logger.warn({ scanId, error: (err as Error).message }, 'Failed to select "All ads" category');
    }

    // ── Step 3: Search for the brand using AI-powered advertiser selection ──
    try {
      const searchBox = page.locator(
        '[role="searchbox"], ' +
        'input[placeholder*="keyword" i], ' +
        'input[placeholder*="advertiser" i], ' +
        'input[aria-label*="Search" i]',
      ).first();
      await searchBox.waitFor({ state: 'visible', timeout: 8_000 });
      await searchBox.click({ timeout: 3_000 });
      await sleep(500);
      await page.keyboard.type(searchTerm, { delay: 100 });
      logger.info({ scanId, searchTerm }, 'Typed search term in Ad Library');
      await sleep(4000);

      const listbox = page.locator('[role="listbox"]');
      try {
        await listbox.waitFor({ state: 'visible', timeout: 8_000 });
        const optionEls = listbox.locator('[role="option"]');
        const count = await optionEls.count();
        logger.info({ scanId, optionCount: count }, 'Autocomplete options appeared');

        // Collect all option texts for AI analysis
        const optionTexts: string[] = [];
        for (let o = 0; o < count; o++) {
          const text = (await optionEls.nth(o).textContent({ timeout: 2_000 }))?.trim() ?? '';
          optionTexts.push(text);
        }
        logger.info({ scanId, options: optionTexts }, 'Extracted autocomplete option texts');

        // Filter out "Search this exact phrase" entries — keep real advertiser options
        const advertiserOptions: Array<{ text: string; originalIndex: number }> = [];
        for (let o = 0; o < optionTexts.length; o++) {
          const t = optionTexts[o]!;
          if (t.toLowerCase().includes('search this') || t.toLowerCase().includes('exact phrase')) continue;
          advertiserOptions.push({ text: t, originalIndex: o });
        }

        let selected = false;

        if (advertiserOptions.length > 0) {
          let pickIndex = -1;

          // Strategy 1: Exact slug match — look for @slug in the option text
          // e.g. slug "SupermaxPR" matches "@supermaxpr" in "SuperMax @supermaxpr · 147K..."
          if (fbSlug) {
            const slugLower = fbSlug.toLowerCase();
            const slugMatchIdx = advertiserOptions.findIndex(
              o => o.text.toLowerCase().includes(`@${slugLower}`),
            );
            if (slugMatchIdx >= 0) {
              pickIndex = slugMatchIdx;
              logger.info({ scanId, method: 'slug-match', slug: fbSlug, matched: advertiserOptions[slugMatchIdx]!.text }, 'Matched advertiser by slug');
            }
          }

          // Strategy 2: AI selection via Gemini — uses full context for fuzzy matching
          if (pickIndex < 0) {
            const aiIdx = await pickBestAdvertiser(
              advertiserOptions.map(o => o.text),
              {
                fbSlug: fbSlug ?? brandName,
                pageName: brandName !== (fbSlug ?? brandName) ? brandName : null,
                brandUrl,
                countryCode,
              },
            );
            if (aiIdx >= 0 && aiIdx < advertiserOptions.length) {
              pickIndex = aiIdx;
              logger.info({ scanId, method: 'ai-match', matched: advertiserOptions[aiIdx]!.text }, 'Matched advertiser by AI');
            }
          }

          // Strategy 3: Highest-follower heuristic — pick the option with the most followers
          // that also contains the brand name or slug substring
          if (pickIndex < 0 && fbSlug) {
            const slugLower = fbSlug.toLowerCase();
            const nameLower = brandName.toLowerCase();
            let bestFollowers = 0;
            let bestHeuristicIdx = -1;
            for (let i = 0; i < advertiserOptions.length; i++) {
              const textLower = advertiserOptions[i]!.text.toLowerCase();
              // Must contain slug or brand name as substring
              if (!textLower.includes(slugLower) && !textLower.includes(nameLower)) continue;
              // Extract follower count: "147K follow", "1K follow", "7 follow"
              const followMatch = advertiserOptions[i]!.text.match(/([\d,.]+)\s*([KkMm])?\s*follow/);
              if (followMatch) {
                let followers = parseFloat(followMatch[1]!.replace(/,/g, ''));
                const multiplier = followMatch[2]?.toUpperCase();
                if (multiplier === 'K') followers *= 1_000;
                if (multiplier === 'M') followers *= 1_000_000;
                if (followers > bestFollowers) {
                  bestFollowers = followers;
                  bestHeuristicIdx = i;
                }
              }
            }
            if (bestHeuristicIdx >= 0) {
              pickIndex = bestHeuristicIdx;
              logger.info({ scanId, method: 'follower-heuristic', followers: bestFollowers, matched: advertiserOptions[bestHeuristicIdx]!.text }, 'Matched advertiser by follower count heuristic');
            }
          }

          // Click the selected option
          if (pickIndex >= 0 && pickIndex < advertiserOptions.length) {
            const pick = advertiserOptions[pickIndex]!;
            await optionEls.nth(pick.originalIndex).click({ timeout: 3_000, force: true });
            logger.info({ scanId, searchTerm, selectedAdvertiser: pick.text, pickIndex }, 'Selected advertiser from autocomplete');
            selected = true;
          } else {
            logger.warn({ scanId, searchTerm }, 'No matching advertiser found in autocomplete');
          }
        }

        if (!selected) {
          // Last resort — press Enter for keyword search (don't click "Search exact phrase")
          logger.warn({ scanId, searchTerm }, 'No advertiser selected — pressing Enter for keyword search');
          await page.keyboard.press('Escape');
          await sleep(300);
          await page.keyboard.press('Enter');
        }
      } catch {
        logger.warn({ scanId, searchTerm }, 'No autocomplete appeared — pressing Enter for keyword search');
        await page.keyboard.press('Enter');
      }
      await sleep(5000);

      result.searchSuccessful = true;
    } catch (err) {
      logger.warn({ scanId, error: (err as Error).message }, 'Failed to search for brand');
    }

    // Try to extract the matched brand page name from the results heading
    try {
      const pageTitle = await page.locator('[role="main"] h2, [role="main"] h1').first().textContent({ timeout: 3_000 });
      result.brandPageName = pageTitle?.trim() ?? null;
    } catch {
      // Not critical
    }

    // Wait for ad results to load
    await sleep(2000);

    // Facebook renders ads in a grid layout. Ad content containers use
    // data-testid="ad-library-dynamic-content-container". "See ad details"
    // buttons are the entry point to individual ad detail views.
    const seeDetailsButtons = page.locator('button:has-text("See ad details"), [role="button"]:has-text("See ad details")');

    // Count visible ads via "See ad details" buttons (most reliable indicator)
    try {
      const count = await seeDetailsButtons.count();
      result.totalAdsVisible = count;
    } catch {
      result.totalAdsVisible = 0;
    }

    // Scroll down 5 times to load more ads
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 800);
      await sleep(500);
    }

    // Recount after scrolling
    try {
      const count = await seeDetailsButtons.count();
      result.totalAdsVisible = Math.max(result.totalAdsVisible, count);
    } catch {
      // Keep existing count
    }

    // Take full-page screenshot.
    // Hide fixed/sticky elements first (navbar, cookie banners) so they don't
    // render floating in the middle of the long screenshot blocking ad content.
    try {
      await hideFixedElements(page);
      const fullBuffer = await page.screenshot({ fullPage: true, type: 'png' });
      result.screenshots.fullPage = await uploadScreenshot(scanId, 'fb-full.png', fullBuffer);
      await restoreFixedElements(page);
    } catch (err) {
      logger.warn({ scanId, error: (err as Error).message }, 'Facebook full-page screenshot failed');
    }

    // Extract individual ad screenshots and CTA URLs (up to 3).
    // Strategy: expand the viewport to 2400px tall before opening ad details
    // so the dialog stretches to show the full ad creative without cutoff,
    // then screenshot the dialog element directly.
    const adsToCapture = Math.min(3, result.totalAdsVisible);

    if (adsToCapture > 0) {
      // Stretch viewport tall so the ad detail dialog expands to fit all content
      await page.setViewportSize({ width: 1280, height: 2400 });
      await sleep(500);
    }

    for (let i = 0; i < adsToCapture; i++) {
      try {
        // Click "See ad details" button to open the ad detail view
        const detailBtn = seeDetailsButtons.nth(i);

        await detailBtn.scrollIntoViewIfNeeded({ timeout: 3_000 });
        await sleep(300);

        // Facebook's data-visualcompletion="ignore" overlays intercept pointer
        // events after closing a previous dialog. Use force:true + JS fallback.
        try {
          await detailBtn.click({ timeout: 5_000, force: true });
        } catch {
          await detailBtn.evaluate((el: HTMLElement) => el.click());
        }
        await sleep(3000);

        // Expand the info column sections on the right side of the ad detail view.
        // The info column has a main dropdown (aria-expanded="false") that must be
        // opened first, then individual section headings ("Transparency by location",
        // "About the advertiser", "Beneficiary and payer") are div[role="heading"]
        // elements that expand when clicked.
        try {
          // Step 1: Open the main info column dropdown
          const mainDropdown = page.locator('[role="dialog"] [role="button"][aria-expanded="false"]').first();
          await mainDropdown.scrollIntoViewIfNeeded({ timeout: 2_000 });
          await mainDropdown.click({ timeout: 3_000, force: true });
          await sleep(1500);

          // Step 2: Click each section heading to expand it
          let expandedCount = 0;
          for (const section of ['Transparency by location', 'About the advertiser', 'Beneficiary and payer']) {
            try {
              const heading = page.locator(`[role="dialog"] :text("${section}")`).first();
              await heading.scrollIntoViewIfNeeded({ timeout: 2_000 });
              await heading.click({ timeout: 2_000, force: true });
              expandedCount++;
              await sleep(1000);
            } catch {
              // Section may not exist for this ad — skip
            }
          }

          // Step 3: Sort the "Reach by location, age and gender" table by Reach descending.
          // Click the "Reach" column header twice (first click = ascending, second = descending).
          try {
            const reachHeader = page.locator('[role="dialog"] :text("Reach")').last();
            await reachHeader.scrollIntoViewIfNeeded({ timeout: 2_000 });
            await reachHeader.click({ timeout: 2_000, force: true });
            await sleep(500);
            await reachHeader.click({ timeout: 2_000, force: true });
            await sleep(1000);
          } catch {
            // Table may not exist for this ad
          }

          logger.info({ scanId, adIndex: i, expandedCount }, 'Expanded Facebook ad info column sections');
          await sleep(1000);
        } catch {
          // Non-critical — screenshot will still capture the ad content
        }

        // Extract structured data from the ad detail info panel.
        // The ad detail view has TWO [role="dialog"] elements: a sidebar nav (large) and
        // the ad detail panel. We need the one containing "Library ID" or "Started running".
        interface AdDetailData {
          adText: string | null;
          ctaButtonText: string | null;
          advertiserName: string | null;
          advertiserHandle: string | null;
          startedRunning: string | null;
          platforms: string[];
          transparencyByLocation: string | null;
          beneficiaryAndPayer: string | null;
          reachData: Array<{ label: string; reach: string }>;
        }

        let adDetails: AdDetailData | null = null;
        try {
          // Step A: Extract text-based data from the correct dialog via page.evaluate
          const textData = await page.evaluate(() => {
            const dialogs = document.querySelectorAll('[role="dialog"]');
            let dialog: Element | null = null;
            // Pick the dialog that contains "Library ID" — that's the ad detail panel
            for (const d of dialogs) {
              if (d.textContent?.includes('Library ID')) { dialog = d; break; }
            }
            if (!dialog) return null;

            const allText = dialog.textContent ?? '';

            // Ad text: extract from between "Open Dropdown​" marker and either
            // "This ad has multiple versions" / a CTA button / "About the advertiser"
            let adText: string | null = null;
            try {
              // The ad copy sits after the "Open Dropdown" hidden button and before ad actions
              const dropdownIdx = allText.indexOf('Open Dropdown');
              if (dropdownIdx >= 0) {
                const after = allText.substring(dropdownIdx + 14); // skip "Open Dropdown​"
                // End markers: known CTA labels, "This ad has", image/carousel markers
                const endMarkers = [
                  'This ad has multiple versions',
                  'Get Offer', 'Shop Now', 'Order Now', 'Learn More', 'Sign Up',
                  'Contact Us', 'Book Now', 'See Menu', 'Cómo llegar', 'Llamar',
                  'Comprar', 'Ordenar ahora', 'Más información', 'Install Now',
                  'About the advertiser',
                ];
                let endIdx = after.length;
                for (const marker of endMarkers) {
                  const idx = after.indexOf(marker);
                  if (idx > 0 && idx < endIdx) endIdx = idx;
                }
                const body = after.substring(0, endIdx).trim();
                // Skip video timestamp artifacts like "0:00 / 0:15"
                if (body.length > 10 && !/^\d+:\d+\s*\/\s*\d+:\d+$/.test(body)) adText = body;
              }
            } catch { /* skip */ }

            // CTA button text
            let ctaButtonText: string | null = null;
            try {
              const ctaLabels = new Set([
                'shop now', 'order now', 'sign up', 'learn more', 'get offer',
                'book now', 'contact us', 'download', 'apply now', 'subscribe',
                'get quote', 'see menu', 'get directions', 'send message', 'watch more',
                'listen now', 'get showtimes', 'request time', 'see more', 'install now',
                'comprar', 'más información', 'registrarte', 'ordenar ahora', 'cómo llegar',
                'ver menú', 'llamar',
              ]);
              const candidates = dialog.querySelectorAll('a, [role="link"], span');
              for (const el of candidates) {
                const t = el.textContent?.trim() ?? '';
                if (t.length > 2 && t.length < 30 && ctaLabels.has(t.toLowerCase())) {
                  ctaButtonText = t;
                  break;
                }
              }
            } catch { /* skip */ }

            // Started running date
            let startedRunning: string | null = null;
            try {
              const match = allText.match(/Started running on\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/);
              if (match?.[1]) startedRunning = match[1];
            } catch { /* skip */ }

            // Advertiser name and handle
            // In raw text: "About the advertiserSuperMax@supermaxpr147K followers • Shopping & retail"
            let advertiserName: string | null = null;
            let advertiserHandle: string | null = null;
            try {
              const aboutIdx = allText.indexOf('About the advertiser');
              if (aboutIdx >= 0) {
                const section = allText.substring(aboutIdx + 20, aboutIdx + 300);
                // Handle: @word — follower count like "147K" or "14.1K" runs directly after
                // Use a negative lookahead to stop before follower patterns (digit+K/M or digit+space)
                const handleMatch = section.match(/@([A-Za-z_][A-Za-z_]{1,29})(?=\d)/);
                if (handleMatch?.[1]) {
                  advertiserHandle = `@${handleMatch[1]}`;
                  const nameEnd = section.indexOf(`@${handleMatch[1]}`);
                  if (nameEnd > 0) {
                    advertiserName = section.substring(0, nameEnd).trim() || null;
                  }
                }
                // Fallback: handle without digit boundary (for pages with small follower counts)
                if (!advertiserHandle) {
                  const fallback = section.match(/@([A-Za-z_][A-Za-z0-9_.]{1,29})/);
                  if (fallback?.[1]) advertiserHandle = `@${fallback[1]}`;
                }
              }
            } catch { /* skip */ }

            // Transparency by location
            let transparencyByLocation: string | null = null;
            try {
              const transIdx = allText.indexOf('Transparency by location');
              if (transIdx >= 0) {
                const afterTrans = allText.substring(transIdx, transIdx + 1000);
                const endIdx = afterTrans.search(/About the advertiser|Beneficiary and payer|About ads and data/);
                const text = (endIdx > 0 ? afterTrans.substring(0, endIdx) : afterTrans).trim();
                if (text.length > 25) transparencyByLocation = text;
              }
            } catch { /* skip */ }

            // Beneficiary and payer
            let beneficiaryAndPayer: string | null = null;
            try {
              const benIdx = allText.indexOf('Beneficiary and payer');
              if (benIdx >= 0) {
                const afterBen = allText.substring(benIdx, benIdx + 500);
                const endIdx = afterBen.search(/About ads and data|Transparency by location|About the advertiser/);
                const text = (endIdx > 0 ? afterBen.substring(0, endIdx) : afterBen).trim();
                if (text.length > 21) beneficiaryAndPayer = text;
              }
            } catch { /* skip */ }

            // Reach by location, age and gender
            const reachData: Array<{ label: string; reach: string }> = [];
            try {
              const reachIdx = allText.indexOf('Reach by location');
              if (reachIdx >= 0) {
                const reachText = allText.substring(reachIdx, reachIdx + 2000);
                const rowPattern = /([A-Za-zÀ-ÿ0-9\s·,.-]{3,60}?)\s+(\d{1,3}(?:\.\d+)?%)/g;
                let m;
                while ((m = rowPattern.exec(reachText)) !== null) {
                  const label = m[1]!.trim();
                  if (label.toLowerCase().includes('reach') || label.toLowerCase().includes('by location')) continue;
                  reachData.push({ label, reach: m[2]! });
                  if (reachData.length >= 10) break;
                }
              }
            } catch { /* skip */ }

            return {
              adText, ctaButtonText, advertiserName, advertiserHandle,
              startedRunning, transparencyByLocation, beneficiaryAndPayer, reachData,
            };
          });

          // Step B: Extract platforms by hovering over platform icons (tooltips)
          // The icons are rendered as divs inside a container next to the "Platforms" span.
          const platforms: string[] = [];
          try {
            const iconContainer = page.locator('[role="dialog"]').locator(
              'xpath=//span[contains(text(),"Platforms")]/following-sibling::div[1]',
            );
            const containerExists = await iconContainer.count();
            if (containerExists > 0) {
              const descendants = iconContainer.locator('div');
              const descCount = await descendants.count();
              const validPlatforms = new Set(['Facebook', 'Instagram', 'Messenger', 'Audience Network']);
              for (let d = 0; d < Math.min(descCount, 20); d++) {
                try {
                  const el = descendants.nth(d);
                  const box = await el.boundingBox();
                  if (!box || box.width < 8 || box.height < 8) continue;
                  await el.hover({ timeout: 800 });
                  await sleep(300);
                  const tooltip = await page.locator('[role="tooltip"]').first().textContent({ timeout: 400 }).catch(() => null);
                  if (tooltip && validPlatforms.has(tooltip) && !platforms.includes(tooltip)) {
                    platforms.push(tooltip);
                  }
                } catch { /* skip individual icon */ }
              }
            }
          } catch {
            // Platform icon extraction failed — non-critical
          }

          if (textData) {
            adDetails = { ...textData, platforms };
            logger.info({
              scanId, adIndex: i,
              hasAdText: !!adDetails.adText,
              advertiser: adDetails.advertiserName,
              handle: adDetails.advertiserHandle,
              platforms: adDetails.platforms,
              reachRows: adDetails.reachData.length,
              hasTransparency: !!adDetails.transparencyByLocation,
              hasBeneficiary: !!adDetails.beneficiaryAndPayer,
            }, 'Extracted ad detail structured data');
          }
        } catch (err) {
          logger.warn({ scanId, adIndex: i, error: (err as Error).message }, 'Ad detail data extraction failed');
        }

        // Screenshot the ad detail dialog element (not just the viewport).
        // Facebook renders two [role="dialog"] elements: a sidebar nav and
        // the actual ad detail panel. We want the one with the most content.
        let screenshotCaptured = false;
        try {
          const dialogs = page.locator('[role="dialog"]');
          const dialogCount = await dialogs.count();

          // Find the dialog with the most text content (the ad detail panel)
          let bestIdx = -1;
          let bestLen = 0;
          for (let d = 0; d < dialogCount; d++) {
            const len = (await dialogs.nth(d).textContent({ timeout: 1_000 }))?.length ?? 0;
            if (len > bestLen) {
              bestLen = len;
              bestIdx = d;
            }
          }

          if (bestIdx >= 0 && bestLen > 50) {
            const adBuffer = await dialogs.nth(bestIdx).screenshot({ type: 'png' });
            const adUrl = await uploadScreenshot(scanId, `fb-ad-${i + 1}.png`, adBuffer);
            if (adUrl) {
              result.screenshots.ads.push(adUrl);
              screenshotCaptured = true;
            }
          }
        } catch {
          // Element screenshot failed
        }

        // Fallback: viewport screenshot if element screenshot didn't work
        if (!screenshotCaptured) {
          const viewportBuffer = await page.screenshot({ type: 'png' });
          const adUrl = await uploadScreenshot(scanId, `fb-ad-${i + 1}.png`, viewportBuffer);
          if (adUrl) result.screenshots.ads.push(adUrl);
        }

        // Extract CTA URL from external links visible in the detail view
        let ctaUrl: string | null = null;
        try {
          const externalLinks = await page.evaluate(() => {
            const links = document.querySelectorAll('a[href]');
            const externals: string[] = [];
            for (const a of links) {
              const href = a.getAttribute('href') ?? '';
              if (href.startsWith('http') &&
                  !href.includes('facebook.com') &&
                  !href.includes('fb.com') &&
                  !href.includes('fbcdn.net')) {
                externals.push(href);
              }
            }
            return externals;
          });
          ctaUrl = externalLinks[0] ?? null;
        } catch {
          // No external CTA link found
        }

        result.ads.push({
          ctaUrl,
          utmParams: ctaUrl ? extractUtmParams(ctaUrl) : {},
          adText: adDetails?.adText ?? null,
          ctaButtonText: adDetails?.ctaButtonText ?? null,
          advertiserName: adDetails?.advertiserName ?? null,
          advertiserHandle: adDetails?.advertiserHandle ?? null,
          startedRunning: adDetails?.startedRunning ?? null,
          platforms: adDetails?.platforms ?? [],
          transparencyByLocation: adDetails?.transparencyByLocation ?? null,
          beneficiaryAndPayer: adDetails?.beneficiaryAndPayer ?? null,
          reachData: adDetails?.reachData ?? [],
        });

        // Close the dialog — FB uses a "Close" button at the bottom or X at top
        try {
          const closeBtn = page.locator('[role="dialog"] button:has-text("Close"), [role="dialog"] [aria-label="Close"]').last();
          await closeBtn.click({ timeout: 2_000, force: true });
          await sleep(1000);
        } catch {
          await page.keyboard.press('Escape');
          await sleep(1000);
        }

        // Remove lingering Facebook overlays that intercept clicks on subsequent ads
        try {
          await page.evaluate(() => {
            document.querySelectorAll('div[data-visualcompletion="ignore"]').forEach(el => {
              const style = window.getComputedStyle(el);
              // Only remove overlay-style elements that cover the page (not structural ones)
              if (style.position === 'fixed' || style.position === 'absolute') {
                const rect = el.getBoundingClientRect();
                if (rect.width > 500 && rect.height > 500) {
                  (el as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
                }
              }
            });
          });
        } catch {
          // Non-critical
        }
      } catch (err) {
        logger.warn({ scanId, adIndex: i, error: (err as Error).message }, 'Failed to capture Facebook ad');
      }
    }
  } catch (err) {
    logger.error({ scanId, error: (err as Error).message }, 'Facebook Ad Library scraping failed');
  } finally {
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
  }

  return result;
}

/**
 * Dismiss overlays on Google Ads Transparency that intercept pointer events.
 * Handles: Google Hats survey iframe, Angular overlay containers (modals).
 */
async function dismissGoogleOverlays(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      // Remove Google Hats survey iframe
      const survey = document.getElementById('google-hats-survey');
      if (survey) survey.remove();
      document.querySelectorAll('iframe[id*="survey"], iframe[id*="hats"]').forEach(el => el.remove());

      // Remove Angular overlay containers that intercept clicks on ad cards.
      // These have class "acx-overlay-container" with child pane divs that
      // block pointer events even when empty.
      document.querySelectorAll('.acx-overlay-container .pane.modal').forEach(el => el.remove());
    });
  } catch {
    // Non-critical
  }
}

// ---------------------------------------------------------------------------
// Part 2 & 3: Google Ads Transparency Center
// ---------------------------------------------------------------------------

interface GooglePlatformResult {
  screenshots: {
    fullPage: string | null;
    ads: string[];
  };
  totalAdsVisible: number;
  searchSuccessful: boolean;
}

interface GoogleResult {
  search: GooglePlatformResult;
  youtube: GooglePlatformResult;
}

async function scrapeGoogleAdsTransparency(
  pool: BrowserPool,
  scanId: string,
  brandUrl: string,
  brandName: string,
  countryCode: string,
): Promise<GoogleResult> {
  const result: GoogleResult = {
    search: { screenshots: { fullPage: null, ads: [] }, totalAdsVisible: 0, searchSuccessful: false },
    youtube: { screenshots: { fullPage: null, ads: [] }, totalAdsVisible: 0, searchSuccessful: false },
  };

  let page: Page | null = null;

  try {
    page = await pool.createPage('https://adstransparency.google.com');

    // ---- PART 2: Google Search Ads ----
    logger.info({ scanId, brandUrl, region: countryCode }, 'Navigating to Google Ads Transparency Center');

    // Navigate directly with domain= URL param — bypasses autocomplete entirely
    // and guarantees we get the correct brand's ads, not a random suggestion.
    const domain = new URL(brandUrl).hostname.replace('www.', '');
    await page.goto(`https://adstransparency.google.com/?hl=en&region=${countryCode}&domain=${domain}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await sleep(4000);

    result.search.searchSuccessful = true;

    // Dismiss overlays before interacting with filter buttons
    await dismissGoogleOverlays(page);

    // Select "Google Search" platform FIRST (before date filter).
    // Applying platform filter first is more reliable because the date filter
    // reloads the page and can disrupt subsequent dropdown interactions.
    try {
      const platformBtn = page.locator('[aria-label*="Platform filter"]').first();
      await platformBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await platformBtn.scrollIntoViewIfNeeded({ timeout: 3_000 });
      await sleep(300);
      await dismissGoogleOverlays(page);
      await platformBtn.click({ timeout: 5_000, force: true });
      await sleep(1500);

      const searchOption = page.locator('material-select-item[role="option"]:has-text("Google Search")').first();
      await searchOption.waitFor({ state: 'visible', timeout: 5_000 });
      await searchOption.click({ timeout: 3_000 });
      logger.info({ scanId }, 'Selected Google Search from platform filter');
      await sleep(4000);
      await dismissGoogleOverlays(page);
    } catch (err) {
      logger.warn({ scanId, error: (err as Error).message }, 'Google Search platform filter failed — continuing with all platforms');
    }

    // Scroll to top, then set date filter to "Last 30 days".
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);

    try {
      const dateBtn = page.locator('[aria-label="Date range filter button"]').first();
      await dateBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await dateBtn.scrollIntoViewIfNeeded({ timeout: 3_000 });
      await sleep(300);
      await dismissGoogleOverlays(page);
      await dateBtn.click({ timeout: 5_000, force: true });
      await sleep(1500);

      const last30 = page.locator('material-select-item[role="option"]:has-text("Last 30 days")').first();
      await last30.waitFor({ state: 'visible', timeout: 5_000 });
      await last30.click({ timeout: 3_000 });
      await sleep(500);

      // The date picker popup stays open after selecting a preset — must click "OK" to confirm.
      // The OK button is <material-button class="apply"> with text "OK".
      const okBtn = page.locator('material-button.apply, material-button:has-text("OK")').first();
      await okBtn.waitFor({ state: 'visible', timeout: 3_000 });
      await okBtn.click({ timeout: 3_000 });
      logger.info({ scanId }, 'Selected "Last 30 days" date filter and confirmed');
      await sleep(4000);
      await dismissGoogleOverlays(page);
    } catch (err) {
      logger.warn({ scanId, error: (err as Error).message }, 'Failed to set "Last 30 days" date filter — using default time range');
    }

    // Click "See all ads" to reveal the full ad listing.
    // Google shows only ~4 ads by default. The expansion button is a <material-button>
    // with class "grid-expansion-button" and text "See all ads".
    {
      const seeAllBtn = page.locator(
        'material-button.grid-expansion-button, ' +
        'material-button:has-text("See all ads"), ' +
        '[role="button"]:has-text("See all ads")',
      ).first();
      try {
        await seeAllBtn.waitFor({ state: 'visible', timeout: 8_000 });
        await seeAllBtn.scrollIntoViewIfNeeded({ timeout: 3_000 });
        await sleep(500);
        await dismissGoogleOverlays(page);
        // Use JS click as fallback — element may be "outside viewport" per Playwright
        // even after scrollIntoView if the page layout is unusual
        try {
          await seeAllBtn.click({ timeout: 5_000, force: true });
        } catch {
          await seeAllBtn.evaluate((el: HTMLElement) => el.click());
        }
        logger.info({ scanId }, 'Clicked "See all ads" for Google Search');
        await sleep(4000);
        await dismissGoogleOverlays(page);
      } catch (err) {
        logger.warn({ scanId, error: (err as Error).message }, 'Failed to click "See all ads" for Google Search — only preview ads will be captured');
      }
    }

    // Count visible ads — Google uses <creative-preview> custom elements
    try {
      const adItems = page.locator('creative-preview');
      const count = await adItems.count();
      result.search.totalAdsVisible = count;
    } catch {
      result.search.totalAdsVisible = 0;
    }

    // Scroll down 5 times to trigger lazy loading
    try {
      for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, 800);
        await sleep(500);
      }

      // Recount after scrolling
      try {
        const adItems = page.locator('creative-preview');
        const count = await adItems.count();
        result.search.totalAdsVisible = Math.max(result.search.totalAdsVisible, count);
      } catch {
        // Keep existing count
      }
    } catch (scrollErr) {
      logger.warn(
        { scanId, error: (scrollErr as Error).message },
        'Page crashed during Google Search scrolling — proceeding with ads captured before scroll',
      );
    }

    // Full-page screenshot of Google Search ads
    try {
      await hideFixedElements(page);
      const fullBuffer = await page.screenshot({ fullPage: true, type: 'png' });
      result.search.screenshots.fullPage = await uploadScreenshot(scanId, 'google-search-full.png', fullBuffer);
      await restoreFixedElements(page);
    } catch (err) {
      logger.warn({ scanId, error: (err as Error).message }, 'Google Search full screenshot failed');
    }

    // Store the results page URL so we can reliably navigate back after ad detail views
    const resultsPageUrl = page.url();

    // Individual ad screenshots (up to 3)
    const searchAdsToCapture = Math.min(3, result.search.totalAdsVisible);
    for (let i = 0; i < searchAdsToCapture; i++) {
      try {
        // Dismiss overlays each iteration in case they reappear
        await dismissGoogleOverlays(page);

        const adItem = page.locator('creative-preview').nth(i);

        // Click to view ad details — this navigates to a new page.
        // Use force:true to bypass overlay interception.
        await adItem.click({ timeout: 5_000, force: true });
        await sleep(3000);

        // Take viewport screenshot of the detail page
        const viewportBuffer = await page.screenshot({ type: 'png' });
        const adUrl = await uploadScreenshot(scanId, `google-search-ad-${i + 1}.png`, viewportBuffer);
        if (adUrl) result.search.screenshots.ads.push(adUrl);

        // Navigate back to results list
        await page.goto(resultsPageUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
        await sleep(2000);
      } catch (err) {
        logger.warn({ scanId, adIndex: i, error: (err as Error).message }, 'Failed to capture Google Search ad');
        // Try to get back to results page on failure
        try { await page.goto(resultsPageUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 }); await sleep(1000); } catch { /* ignore */ }
      }
    }

    // ---- PART 3: YouTube Ads ----
    logger.info({ scanId }, 'Switching to YouTube ads');

    // Navigate back to the results page first — individual ad clicks navigated away.
    try {
      await page.goto(resultsPageUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await sleep(3000);
      await dismissGoogleOverlays(page);
    } catch {
      logger.warn({ scanId }, 'Failed to navigate back for YouTube platform switch');
    }

    // Scroll to top so filter buttons are accessible
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);

    // Switch to YouTube using the platform filter dropdown.
    try {
      const platformBtn = page.locator('[aria-label*="Platform filter"]').first();
      await platformBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await platformBtn.scrollIntoViewIfNeeded({ timeout: 3_000 });
      await sleep(300);
      await dismissGoogleOverlays(page);
      await platformBtn.click({ timeout: 5_000, force: true });
      logger.info({ scanId }, 'Opened platform filter dropdown for YouTube');
      await sleep(1500);

      const youtubeOption = page.locator('material-select-item[role="option"]:has-text("YouTube")').first();
      await youtubeOption.waitFor({ state: 'visible', timeout: 5_000 });
      await youtubeOption.click({ timeout: 3_000 });
      logger.info({ scanId }, 'Selected YouTube from platform filter');
      await sleep(4000);
      await dismissGoogleOverlays(page);

      result.youtube.searchSuccessful = true;
    } catch (err) {
      logger.warn({ scanId, error: (err as Error).message }, 'YouTube platform switch failed');
    }

    if (result.youtube.searchSuccessful) {
      // Scroll to top so filter buttons are accessible
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(500);

      // Set date filter to "Last 30 days" for YouTube.
      // It may carry over from Google Search, but re-apply to be safe.
      try {
        const dateBtn = page.locator('[aria-label="Date range filter button"]').first();
        await dateBtn.waitFor({ state: 'visible', timeout: 5_000 });
        await dateBtn.scrollIntoViewIfNeeded({ timeout: 3_000 });
        await sleep(300);
        await dismissGoogleOverlays(page);
        await dateBtn.click({ timeout: 5_000, force: true });
        await sleep(1500);

        const last30 = page.locator('material-select-item[role="option"]:has-text("Last 30 days")').first();
        await last30.waitFor({ state: 'visible', timeout: 5_000 });
        await last30.click({ timeout: 3_000 });
        await sleep(500);

        // Click OK to confirm the date selection
        const okBtn = page.locator('material-button.apply, material-button:has-text("OK")').first();
        await okBtn.waitFor({ state: 'visible', timeout: 3_000 });
        await okBtn.click({ timeout: 3_000 });
        logger.info({ scanId }, 'Selected "Last 30 days" date filter for YouTube');
        await sleep(4000);
        await dismissGoogleOverlays(page);
      } catch (err) {
        logger.warn({ scanId, error: (err as Error).message }, 'Failed to set date filter for YouTube');
      }

      // Set format filter to "Video" for YouTube.
      // Button: aria-label includes "Ad format filter"
      // Options: <material-select-item role="option"> — "Video"
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(300);

      try {
        const formatBtn = page.locator('[aria-label*="format filter"], [aria-label*="Format filter"]').first();
        await formatBtn.waitFor({ state: 'visible', timeout: 5_000 });
        await formatBtn.scrollIntoViewIfNeeded({ timeout: 3_000 });
        await sleep(300);
        await dismissGoogleOverlays(page);
        await formatBtn.click({ timeout: 5_000, force: true });
        await sleep(1500);

        // Scope to the visible popup to avoid matching hidden platform filter options
        // (YouTube's option text contains "video_youtube" which also matches "Video")
        const videoOption = page.locator('.popup-wrapper.visible material-select-item[role="option"]:has-text("Video")').first();
        await videoOption.waitFor({ state: 'visible', timeout: 5_000 });
        await videoOption.click({ timeout: 3_000 });
        logger.info({ scanId }, 'Selected "Video" format filter for YouTube');
        await sleep(4000);
        await dismissGoogleOverlays(page);
      } catch (err) {
        logger.warn({ scanId, error: (err as Error).message }, 'Failed to set "Video" format filter for YouTube');
      }

      // Click "See all ads" for YouTube ads
      {
        const seeAllBtn = page.locator(
          'material-button.grid-expansion-button, ' +
          'material-button:has-text("See all ads"), ' +
          '[role="button"]:has-text("See all ads")',
        ).first();
        try {
          await seeAllBtn.waitFor({ state: 'visible', timeout: 8_000 });
          await seeAllBtn.scrollIntoViewIfNeeded({ timeout: 3_000 });
          await sleep(500);
          await dismissGoogleOverlays(page);
          try {
            await seeAllBtn.click({ timeout: 5_000, force: true });
          } catch {
            await seeAllBtn.evaluate((el: HTMLElement) => el.click());
          }
          logger.info({ scanId }, 'Clicked "See all ads" for YouTube');
          await sleep(4000);
          await dismissGoogleOverlays(page);
        } catch (err) {
          logger.warn({ scanId, error: (err as Error).message }, 'Failed to click "See all ads" for YouTube — only preview ads will be captured');
        }
      }

      // Count YouTube ads
      try {
        const ytAdItems = page.locator('creative-preview');
        const count = await ytAdItems.count();
        result.youtube.totalAdsVisible = count;
      } catch {
        result.youtube.totalAdsVisible = 0;
      }

      // Scroll 5 times to load more
      try {
        for (let i = 0; i < 5; i++) {
          await page.mouse.wheel(0, 800);
          await sleep(500);
        }

        // Recount after scrolling
        try {
          const ytAdItems = page.locator('creative-preview');
          const count = await ytAdItems.count();
          result.youtube.totalAdsVisible = Math.max(result.youtube.totalAdsVisible, count);
        } catch {
          // Keep existing
        }
      } catch (scrollErr) {
        logger.warn(
          { scanId, error: (scrollErr as Error).message },
          'Page crashed during YouTube scrolling — proceeding with ads captured before scroll',
        );
      }

      // Full-page screenshot of YouTube ads
      try {
        await hideFixedElements(page);
        const fullBuffer = await page.screenshot({ fullPage: true, type: 'png' });
        result.youtube.screenshots.fullPage = await uploadScreenshot(scanId, 'google-youtube-full.png', fullBuffer);
        await restoreFixedElements(page);
      } catch (err) {
        logger.warn({ scanId, error: (err as Error).message }, 'YouTube full screenshot failed');
      }

      // Store YouTube results page URL for back-navigation after ad detail views
      const ytResultsPageUrl = page.url();

      // Individual YouTube ad screenshots (up to 3)
      const ytAdsToCapture = Math.min(3, result.youtube.totalAdsVisible);
      for (let i = 0; i < ytAdsToCapture; i++) {
        try {
          await dismissGoogleOverlays(page);

          const adItem = page.locator('creative-preview').nth(i);
          await adItem.click({ timeout: 5_000, force: true });
          await sleep(3000);

          const viewportBuffer = await page.screenshot({ type: 'png' });
          const adUrl = await uploadScreenshot(scanId, `google-youtube-ad-${i + 1}.png`, viewportBuffer);
          if (adUrl) result.youtube.screenshots.ads.push(adUrl);

          // Navigate back to YouTube results
          await page.goto(ytResultsPageUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
          await sleep(2000);
        } catch (err) {
          logger.warn({ scanId, adIndex: i, error: (err as Error).message }, 'Failed to capture YouTube ad');
          try { await page.goto(ytResultsPageUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 }); await sleep(1000); } catch { /* ignore */ }
        }
      }
    }
  } catch (err) {
    logger.error({ scanId, error: (err as Error).message }, 'Google Ads Transparency scraping failed');
  } finally {
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main execute function
// ---------------------------------------------------------------------------

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');
  const fallbackBrandName = domain.split('.')[0] ?? domain;

  const pool = new BrowserPool();

  try {
    // Ensure storage bucket exists
    await ensureBucket();

    // Get country code from scan record (user's actual location)
    let countryCode = 'US';
    try {
      const scan = await getScanById(ctx.scanId);
      const code = scan?.['country_code'] as string | null;
      if (code && /^[A-Z]{2}$/.test(code)) countryCode = code;
    } catch {
      logger.warn({ scanId: ctx.scanId }, 'Could not fetch scan record for country code — using US fallback');
    }

    // Get best brand name for Facebook search:
    // 1. Extract slug from M15/M04 sameAs (e.g., "pideuva")
    // 2. Visit the Facebook page to get the display name (e.g., "Uva App")
    //    The display name is what the Ad Library uses for advertiser matching,
    //    which can differ from the slug.
    // 3. Fall back to slug, then domain-derived name
    const fbSlug = extractFacebookSlug(ctx);
    let brandName = fallbackBrandName;
    let fbPageId: string | null = null;
    if (fbSlug) {
      const pageInfo = await resolveFacebookPageInfo(pool, fbSlug);
      brandName = pageInfo.pageName ?? fbSlug;
      fbPageId = pageInfo.pageId;
    }

    logger.info(
      { scanId: ctx.scanId, fbSlug, brandName, fbPageId, countryCode },
      'Starting M21 Ad Library Extractor',
    );

    // Run Facebook and Google independently — one failing doesn't affect the other
    let fbResult: FacebookResult | null = null;
    let googleResult: GoogleResult | null = null;

    // Part 1: Facebook Ad Library
    try {
      fbResult = await scrapeFacebookAdLibrary(pool, ctx.scanId, countryCode, brandName, fbPageId, fbSlug, ctx.url);
    } catch (err) {
      logger.error({ scanId: ctx.scanId, error: (err as Error).message }, 'Facebook section failed completely');
    }

    // Parts 2 & 3: Google Ads Transparency (Search + YouTube)
    try {
      googleResult = await scrapeGoogleAdsTransparency(pool, ctx.scanId, ctx.url, fallbackBrandName, countryCode);
    } catch (err) {
      logger.error({ scanId: ctx.scanId, error: (err as Error).message }, 'Google section failed completely');
    }

    // Build data shape
    const fb = fbResult ?? {
      screenshots: { fullPage: null, ads: [] },
      ads: [],
      brandPageName: null,
      totalAdsVisible: 0,
      searchSuccessful: false,
      pageId: null,
      directNavigation: false,
    };

    const google = googleResult ?? {
      search: { screenshots: { fullPage: null, ads: [] }, totalAdsVisible: 0, searchSuccessful: false },
      youtube: { screenshots: { fullPage: null, ads: [] }, totalAdsVisible: 0, searchSuccessful: false },
    };

    const facebookActive = fb.searchSuccessful && fb.totalAdsVisible > 0;
    const googleSearchActive = google.search.searchSuccessful && google.search.totalAdsVisible > 0;
    const googleYoutubeActive = google.youtube.searchSuccessful && google.youtube.totalAdsVisible > 0;

    const totalImages =
      (fb.screenshots.fullPage ? 1 : 0) + fb.screenshots.ads.length +
      (google.search.screenshots.fullPage ? 1 : 0) + google.search.screenshots.ads.length +
      (google.youtube.screenshots.fullPage ? 1 : 0) + google.youtube.screenshots.ads.length;

    data.facebook = fb;
    data.google = google;
    data.summary = {
      totalImages,
      facebookActive,
      googleSearchActive,
      googleYoutubeActive,
    };

    // Signals
    if (facebookActive) {
      signals.push(createSignal({
        type: 'facebook_ads_active', name: 'Facebook Ads Active',
        confidence: 0.9, evidence: `${fb.totalAdsVisible} active ads found in Facebook Ad Library`,
        category: 'paid_media',
      }));
    }
    if (googleSearchActive) {
      signals.push(createSignal({
        type: 'google_search_ads_active', name: 'Google Search Ads Active',
        confidence: 0.9, evidence: `${google.search.totalAdsVisible} Google Search ads found`,
        category: 'paid_media',
      }));
    }
    if (googleYoutubeActive) {
      signals.push(createSignal({
        type: 'youtube_ads_active', name: 'YouTube Ads Active',
        confidence: 0.9, evidence: `${google.youtube.totalAdsVisible} YouTube ads found`,
        category: 'paid_media',
      }));
    }

    // CP1: Facebook Ad Library (weight: 0.35)
    {
      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (facebookActive && fb.screenshots.ads.length > 0) {
        health = 'excellent';
        evidence = `${fb.totalAdsVisible} active Facebook ads found, ${fb.screenshots.ads.length} screenshots captured`;
      } else if (fb.searchSuccessful && fb.totalAdsVisible === 0) {
        health = 'good';
        evidence = 'Facebook Ad Library search successful but no active ads found';
        recommendation = 'Consider running Facebook ad campaigns to increase brand visibility';
      } else {
        health = 'warning';
        evidence = fb.searchSuccessful
          ? `Facebook ads found but screenshot capture incomplete (${fb.screenshots.ads.length} captured)`
          : 'Facebook Ad Library search failed or brand not found';
        recommendation = 'Verify brand presence on Facebook and ensure active ad campaigns are running';
      }

      checkpoints.push(createCheckpoint({ id: 'm21-facebook', name: 'Facebook Ad Library', weight: 0.35, health, evidence, recommendation }));
    }

    // CP2: Google Search Ads (weight: 0.35)
    {
      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (googleSearchActive && google.search.screenshots.ads.length > 0) {
        health = 'excellent';
        evidence = `${google.search.totalAdsVisible} Google Search ads found, ${google.search.screenshots.ads.length} screenshots captured`;
      } else if (google.search.searchSuccessful && google.search.totalAdsVisible === 0) {
        health = 'good';
        evidence = 'Google Ads Transparency search successful but no Search ads in last 30 days';
        recommendation = 'Consider running Google Search ad campaigns for brand visibility';
      } else {
        health = 'warning';
        evidence = google.search.searchSuccessful
          ? `Google Search ads found but screenshot capture incomplete (${google.search.screenshots.ads.length} captured)`
          : 'Google Ads Transparency search failed';
      }

      checkpoints.push(createCheckpoint({ id: 'm21-google-search', name: 'Google Search Ads', weight: 0.35, health, evidence, recommendation }));
    }

    // CP3: YouTube Ads (weight: 0.15)
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (googleYoutubeActive) {
        health = 'excellent';
        evidence = `${google.youtube.totalAdsVisible} YouTube ads found`;
      } else {
        health = 'good';
        evidence = 'No YouTube ads found (common for many brands)';
      }

      checkpoints.push(createCheckpoint({ id: 'm21-youtube', name: 'YouTube Ads', weight: 0.15, health, evidence }));
    }

    // CP4: Multi-Platform Advertising (weight: 0.15)
    {
      const activePlatforms = [facebookActive, googleSearchActive, googleYoutubeActive].filter(Boolean).length;
      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (activePlatforms >= 2) {
        health = 'excellent';
        const platforms = [
          facebookActive ? 'Facebook' : null,
          googleSearchActive ? 'Google Search' : null,
          googleYoutubeActive ? 'YouTube' : null,
        ].filter(Boolean).join(', ');
        evidence = `Active on ${activePlatforms} platforms: ${platforms}`;
      } else if (activePlatforms === 1) {
        health = 'good';
        const platform = facebookActive ? 'Facebook' : googleSearchActive ? 'Google Search' : 'YouTube';
        evidence = `Active on 1 platform: ${platform}`;
        recommendation = 'Diversify advertising across multiple platforms for broader reach';
      } else {
        health = 'warning';
        evidence = 'No ads found on any monitored platform';
        recommendation = 'Consider launching advertising campaigns on Facebook and Google';
      }

      checkpoints.push(createCheckpoint({ id: 'm21-multi-platform', name: 'Multi-Platform Advertising', weight: 0.15, health, evidence, recommendation }));
    }

    // Determine overall status
    const anySuccess = fb.searchSuccessful || google.search.searchSuccessful || google.youtube.searchSuccessful;
    const allSuccess = fb.searchSuccessful && google.search.searchSuccessful;
    const status = allSuccess ? 'success' : anySuccess ? 'partial' : 'error';

    return {
      moduleId: 'M21' as ModuleId,
      status,
      data,
      signals,
      score: null,
      checkpoints,
      duration: 0,
    };
  } catch (error) {
    return {
      moduleId: 'M21' as ModuleId,
      status: 'error',
      data,
      signals,
      score: null,
      checkpoints,
      duration: 0,
      error: (error as Error).message,
    };
  } finally {
    // Always close the browser pool
    try {
      await pool.close();
    } catch {
      // Ignore close errors
    }
  }
};

export { execute };
registerModuleExecutor('M21' as ModuleId, execute);
