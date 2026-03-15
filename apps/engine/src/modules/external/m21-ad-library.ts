/**
 * M21 - Ad Library Extractor
 *
 * Navigates Facebook Ad Library and Google Ads Transparency Center using
 * browser automation. Captures 1 ad detail screenshot per platform and
 * extracts Facebook CTA URLs for downstream M06/M06b analysis.
 *
 * Checkpoints:
 *   1. Facebook Ad Library (weight: 0.40)
 *   2. Google Search Ads (weight: 0.40)
 *   3. Multi-Platform Advertising (weight: 0.20)
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
  screenshot: string | null;
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
    screenshot: null,
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

    logger.info({ scanId, searchTerm, brandName, countryCode, pageId }, 'Navigating to Facebook Ad Library');

    // Navigate to Ad Library and set up category (country defaults to user's region)
    await page.goto('https://www.facebook.com/ads/library/', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    // DO NOT use waitForLoadState('networkidle') — Facebook never goes idle
    // (constant beacon/analytics requests). On the DO server this hangs forever.
    // Instead, wait for the comboboxes to appear which proves the form is ready.
    logger.info({ scanId }, 'Facebook Ad Library page loaded, waiting for comboboxes');

    // ── Step 1: Set country to "All" ────────────────────────────────────
    // Facebook defaults to the server's region (DO = US/PR). Setting to "All"
    // ensures we see ads running globally, not just in one country.
    // Only 2 comboboxes on the page: country (first) and category (second).
    try {
      const countryCombo = page.locator('[role="combobox"]').first();
      await countryCombo.waitFor({ state: 'visible', timeout: 20_000 });
      logger.info({ scanId }, 'Country combobox visible, clicking');
      await sleep(1000);
      // Use JS click — Facebook overlays intercept Playwright's click action
      await countryCombo.evaluate((el: HTMLElement) => el.click());
      await sleep(1500);

      // Click the "All" gridcell in the country dropdown
      const allOption = page.locator('[role="gridcell"]').filter({ hasText: /^All$/ }).first();
      await allOption.waitFor({ state: 'visible', timeout: 5_000 });
      await allOption.evaluate((el: HTMLElement) => el.click());
      logger.info({ scanId }, 'Set country filter to "All"');
      await sleep(3000);
    } catch (err) {
      logger.warn({ scanId, error: (err as Error).message }, 'Failed to set country to "All" — proceeding with default region');
      // Close any lingering dropdown so it doesn't interfere with category selection
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(500);
    }

    // ── Step 2: Select "All ads" from category dropdown ─────────────────
    // The search input is DISABLED until a category is selected. This is a hard
    // dependency — if category selection fails, search will always fail too.
    let categorySelected = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Wait for the category combobox to be interactive
        const adCategoryCombo = page.locator('[role="combobox"]:has-text("Ad category"), [role="combobox"]:has-text("All ads"), [role="combobox"]:has-text("Issues")').first();
        await adCategoryCombo.waitFor({ state: 'visible', timeout: 15_000 });
        logger.info({ scanId, attempt }, 'Category combobox visible, clicking');
        await sleep(1000);
        await adCategoryCombo.evaluate((el: HTMLElement) => el.click());
        await sleep(1500);

        const allAdsCell = page.locator('[role="gridcell"]:has-text("All ads")').first();
        await allAdsCell.waitFor({ state: 'visible', timeout: 5_000 });
        await allAdsCell.evaluate((el: HTMLElement) => el.click());
        logger.info({ scanId, attempt }, 'Selected "All ads" category');

        // Wait for search input to become enabled after category selection
        await sleep(2000);
        const searchReady = page.locator(
          '[role="searchbox"], ' +
          'input[placeholder*="keyword" i], ' +
          'input[placeholder*="advertiser" i], ' +
          'input[aria-label*="Search" i]',
        ).first();
        await searchReady.waitFor({ state: 'visible', timeout: 10_000 });

        categorySelected = true;
        break;
      } catch (err) {
        if (attempt === 0) {
          logger.warn({ scanId, error: (err as Error).message }, 'Category selection attempt 1 failed — retrying');
          await sleep(3000);
          continue;
        }
        logger.warn({ scanId, error: (err as Error).message }, 'Failed to select "All ads" category after 2 attempts');
      }
    }

    // If category selection failed, search input is disabled — skip search entirely
    if (!categorySelected) {
      logger.warn({ scanId }, 'Category not selected — search input disabled, skipping Facebook search');
      return result;
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
      await searchBox.evaluate((el: HTMLElement) => el.click());
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

    // Extract ad detail screenshot and CTA URL (1 ad only).
    // Expand the viewport to 2400px tall so the dialog stretches to show
    // the full ad creative without cutoff, then screenshot the dialog directly.
    const adsToCapture = Math.min(1, result.totalAdsVisible);

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
            const adUrl = await uploadScreenshot(scanId, 'fb-ad.png', adBuffer);
            if (adUrl) {
              result.screenshot = adUrl;
              screenshotCaptured = true;
            }
          }
        } catch {
          // Element screenshot failed
        }

        // Fallback: viewport screenshot if element screenshot didn't work
        if (!screenshotCaptured) {
          const viewportBuffer = await page.screenshot({ type: 'png' });
          const adUrl = await uploadScreenshot(scanId, 'fb-ad.png', viewportBuffer);
          if (adUrl) result.screenshot = adUrl;
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
// Part 2: Google Ads Transparency Center
// ---------------------------------------------------------------------------

interface GoogleResult {
  screenshot: string | null;
  totalAdsVisible: number;
  searchSuccessful: boolean;
}

async function scrapeGoogleAdsTransparency(
  pool: BrowserPool,
  scanId: string,
  brandUrl: string,
  brandName: string,
  countryCode: string,
): Promise<GoogleResult> {
  const result: GoogleResult = {
    screenshot: null,
    totalAdsVisible: 0,
    searchSuccessful: false,
  };

  let page: Page | null = null;

  try {
    page = await pool.createPage('https://adstransparency.google.com');

    logger.info({ scanId, brandUrl, region: countryCode }, 'Navigating to Google Ads Transparency Center');

    // Navigate directly with domain= URL param — bypasses autocomplete entirely
    // and guarantees we get the correct brand's ads, not a random suggestion.
    const domain = new URL(brandUrl).hostname.replace('www.', '');
    await page.goto(`https://adstransparency.google.com/?hl=en&region=${countryCode}&domain=${domain}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await sleep(4000);

    result.searchSuccessful = true;

    // Dismiss overlays before interacting
    await dismissGoogleOverlays(page);

    // Google changed their DOM — ad cards are now <a> links with accessible names
    // like "Advertisement (1 of 80)", not <creative-preview> custom elements.
    // The ad count selector matches these link elements.
    const adCardSelector = 'a[href*="/creative/"], a[href*="/advertiser/"]';

    // Also extract the total ad count from the "~20K ads" text badge
    try {
      const countText = await page.locator('text=/~?\\d+[KkMm]?\\s*ads/').first().textContent({ timeout: 3_000 });
      if (countText) {
        const match = countText.match(/([\d,.]+)\s*([KkMm])?/);
        if (match) {
          let total = parseFloat(match[1]!.replace(/,/g, ''));
          const mult = match[2]?.toUpperCase();
          if (mult === 'K') total *= 1_000;
          if (mult === 'M') total *= 1_000_000;
          result.totalAdsVisible = Math.round(total);
          logger.info({ scanId, totalFromBadge: result.totalAdsVisible, raw: countText.trim() }, 'Extracted total ad count from badge');
        }
      }
    } catch {
      // Badge not found — will count visible cards instead
    }

    // Load ALL ads: scroll to bottom → click "See all ads" → repeat.
    // Google shows ~80 cards initially, then loads more on "See all ads" click.
    try {
      let consecutiveMisses = 0;
      for (let round = 0; round < 10; round++) {
        // Scroll aggressively to the bottom to reveal the "See all" button
        for (let i = 0; i < 8; i++) {
          await page.mouse.wheel(0, 1000);
          await sleep(300);
        }
        await sleep(1000);

        const prevCount = await page.locator(adCardSelector).count().catch(() => 0);

        // Look for "See all ads" button and click it
        const seeAllBtn = page.locator(
          'button:has-text("See all"), ' +
          'button:has-text("Show more"), ' +
          'a:has-text("See all"), ' +
          '[role="button"]:has-text("See all")',
        ).first();
        try {
          await seeAllBtn.waitFor({ state: 'visible', timeout: 5_000 });
          await seeAllBtn.scrollIntoViewIfNeeded({ timeout: 2_000 });
          await dismissGoogleOverlays(page);
          await seeAllBtn.click({ timeout: 5_000, force: true });
          logger.info({ scanId, round, adsBefore: prevCount }, 'Clicked "See all ads" button');
          await sleep(4000);
          consecutiveMisses = 0;
        } catch {
          consecutiveMisses++;
          if (consecutiveMisses >= 2) break;
          continue;
        }

        const newCount = await page.locator(adCardSelector).count().catch(() => 0);
        logger.info({ scanId, round, adsBefore: prevCount, adsAfter: newCount }, 'Ad count after "See all" click');
        if (newCount <= prevCount) break;
      }
    } catch (err) {
      logger.warn(
        { scanId, error: (err as Error).message },
        'Error during Google ad loading loop — proceeding with ads captured so far',
      );
    }

    // If badge count wasn't found, use visible card count
    if (result.totalAdsVisible === 0) {
      try {
        result.totalAdsVisible = await page.locator(adCardSelector).count();
      } catch {
        result.totalAdsVisible = 0;
      }
    }

    logger.info({ scanId, totalAdsVisible: result.totalAdsVisible }, 'Google ads count finalized');

    // Capture 1 ad detail screenshot by clicking first ad card
    const visibleAdCount = await page.locator(adCardSelector).count().catch(() => 0);
    if (visibleAdCount > 0) {
      try {
        await dismissGoogleOverlays(page);

        const adItem = page.locator(adCardSelector).first();
        await adItem.click({ timeout: 5_000, force: true });
        await sleep(3000);

        const viewportBuffer = await page.screenshot({ type: 'png', timeout: 15_000 });
        result.screenshot = await uploadScreenshot(scanId, 'google-search-ad.png', viewportBuffer);
      } catch (err) {
        logger.warn({ scanId, error: (err as Error).message }, 'Failed to capture Google ad screenshot');
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

    // Part 2: Google Ads Transparency (Search only)
    try {
      googleResult = await scrapeGoogleAdsTransparency(pool, ctx.scanId, ctx.url, fallbackBrandName, countryCode);
    } catch (err) {
      logger.error({ scanId: ctx.scanId, error: (err as Error).message }, 'Google section failed completely');
    }

    // Build data shape
    const fb = fbResult ?? {
      screenshot: null,
      ads: [],
      brandPageName: null,
      totalAdsVisible: 0,
      searchSuccessful: false,
      pageId: null,
      directNavigation: false,
    };

    const google = googleResult ?? {
      screenshot: null,
      totalAdsVisible: 0,
      searchSuccessful: false,
    };

    const facebookActive = fb.searchSuccessful && fb.totalAdsVisible > 0;
    const googleSearchActive = google.searchSuccessful && google.totalAdsVisible > 0;

    const totalImages = (fb.screenshot ? 1 : 0) + (google.screenshot ? 1 : 0);

    data.facebook = fb;
    data.google = google;
    data.summary = {
      totalImages,
      facebookActive,
      googleSearchActive,
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
        confidence: 0.9, evidence: `${google.totalAdsVisible} Google Search ads found`,
        category: 'paid_media',
      }));
    }

    // CP1: Facebook Ad Library (weight: 0.40)
    {
      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (facebookActive && fb.screenshot) {
        health = 'excellent';
        evidence = `${fb.totalAdsVisible} active Facebook ads found, screenshot captured`;
      } else if (fb.searchSuccessful && fb.totalAdsVisible === 0) {
        health = 'good';
        evidence = 'Facebook Ad Library search successful but no active ads found';
        recommendation = 'Consider running Facebook ad campaigns to increase brand visibility';
      } else {
        health = 'warning';
        evidence = fb.searchSuccessful
          ? 'Facebook ads found but screenshot capture failed'
          : 'Facebook Ad Library search failed or brand not found';
        recommendation = 'Verify brand presence on Facebook and ensure active ad campaigns are running';
      }

      checkpoints.push(createCheckpoint({ id: 'm21-facebook', name: 'Facebook Ad Library', weight: 0.40, health, evidence, recommendation }));
    }

    // CP2: Google Search Ads (weight: 0.40)
    {
      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (googleSearchActive && google.screenshot) {
        health = 'excellent';
        evidence = `${google.totalAdsVisible} Google Search ads found, screenshot captured`;
      } else if (google.searchSuccessful && google.totalAdsVisible === 0) {
        health = 'good';
        evidence = 'Google Ads Transparency search successful but no Search ads found';
        recommendation = 'Consider running Google Search ad campaigns for brand visibility';
      } else {
        health = 'warning';
        evidence = google.searchSuccessful
          ? 'Google Search ads found but screenshot capture failed'
          : 'Google Ads Transparency search failed';
      }

      checkpoints.push(createCheckpoint({ id: 'm21-google-search', name: 'Google Search Ads', weight: 0.40, health, evidence, recommendation }));
    }

    // CP3: Multi-Platform Advertising (weight: 0.20)
    {
      const activePlatforms = [facebookActive, googleSearchActive].filter(Boolean).length;
      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (activePlatforms === 2) {
        health = 'excellent';
        evidence = 'Active on both Facebook and Google Search';
      } else if (activePlatforms === 1) {
        health = 'good';
        const platform = facebookActive ? 'Facebook' : 'Google Search';
        evidence = `Active on 1 platform: ${platform}`;
        recommendation = 'Diversify advertising across multiple platforms for broader reach';
      } else {
        health = 'warning';
        evidence = 'No ads found on any monitored platform';
        recommendation = 'Consider launching advertising campaigns on Facebook and Google';
      }

      checkpoints.push(createCheckpoint({ id: 'm21-multi-platform', name: 'Multi-Platform Advertising', weight: 0.20, health, evidence, recommendation }));
    }

    // Determine overall status
    const anySuccess = fb.searchSuccessful || google.searchSuccessful;
    const allSuccess = fb.searchSuccessful && google.searchSuccessful;
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
