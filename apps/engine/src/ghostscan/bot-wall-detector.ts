/**
 * Bot Wall Detector
 *
 * Post-navigation detection of bot protection walls with auto-wait
 * and retry strategies. Identifies specific providers for reporting.
 *
 * Supported providers:
 * - Cloudflare Turnstile / Challenge pages
 * - Akamai Bot Manager
 * - PerimeterX / HUMAN
 * - DataDome
 * - Generic WAF/captcha pages
 */

import type { Page } from 'patchright';
import pino from 'pino';

const logger = pino({ name: 'bot-wall-detector' });

export interface BotWallResult {
  blocked: boolean;
  provider: string | null;
  autoResolved: boolean;
  retrySucceeded: boolean;
}

interface DetectionRule {
  provider: string;
  detect: (page: Page) => Promise<boolean>;
  /** Max ms to wait for auto-resolve (e.g., Turnstile solving silently) */
  autoWaitMs: number;
  /** Whether to retry navigation after wait */
  retryNavigation: boolean;
}

// KEY INSIGHT: Real bot block pages are ALWAYS sparse interstitials (<2KB body text).
// Normal pages that USE bot protection (DataDome, Cloudflare, PerimeterX) still have
// rich content. We MUST require sparse body + block indicators to avoid false positives.
const MAX_BODY_FOR_BLOCK = 2000;  // Real block pages never have >2KB of visible text

const DETECTION_RULES: DetectionRule[] = [
  {
    provider: 'cloudflare_turnstile',
    detect: async (page: Page) => {
      return page.evaluate((maxBody) => {
        const bodyLen = document.body?.innerText?.length ?? 0;
        // Rich content pages with Turnstile embedded are NOT blocked
        if (bodyLen > maxBody) return false;
        // Cloudflare challenge interstitial (sparse page with challenge elements)
        const cfChallenge = document.querySelector('#challenge-running, #challenge-form, .cf-browser-verification');
        const turnstileIframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
        return !!(cfChallenge || turnstileIframe);
      }, MAX_BODY_FOR_BLOCK);
    },
    autoWaitMs: 15_000,
    retryNavigation: true,  // CF challenge auto-redirects — retry picks up the real page
  },
  {
    provider: 'cloudflare_waf',
    detect: async (page: Page) => {
      return page.evaluate((maxBody) => {
        const bodyText = document.body?.innerText ?? '';
        if (bodyText.length > maxBody) return false;
        const title = document.title.toLowerCase();
        const bodyLower = bodyText.slice(0, 500).toLowerCase();
        return (
          (title.includes('just a moment') && bodyLower.includes('cloudflare')) ||
          (title.includes('attention required') && bodyLower.includes('cloudflare')) ||
          !!document.querySelector('.cf-error-details')
        );
      }, MAX_BODY_FOR_BLOCK);
    },
    autoWaitMs: 10_000,
    retryNavigation: true,  // CF WAF challenge auto-resolves — retry picks up the real page
  },
  {
    provider: 'akamai_bot_manager',
    detect: async (page: Page) => {
      return page.evaluate((maxBody) => {
        const bodyText = document.body?.innerText ?? '';
        if (bodyText.length > maxBody) return false;
        const title = document.title.toLowerCase();
        const bodyLower = bodyText.slice(0, 500).toLowerCase();
        const accessDenied = bodyLower.includes('access denied') || title.includes('access denied');
        return accessDenied;
      }, MAX_BODY_FOR_BLOCK);
    },
    autoWaitMs: 5_000,
    retryNavigation: true,
  },
  {
    provider: 'perimeterx_human',
    detect: async (page: Page) => {
      return page.evaluate((maxBody) => {
        const bodyText = document.body?.innerText ?? '';
        if (bodyText.length > maxBody) return false;
        const pxCaptcha = !!document.querySelector('#px-captcha, .px-captcha');
        if (pxCaptcha) return true;
        const bodyLower = bodyText.slice(0, 500).toLowerCase();
        return bodyLower.includes('press & hold') || bodyLower.includes('human verification');
      }, MAX_BODY_FOR_BLOCK);
    },
    autoWaitMs: 10_000,  // PX "press & hold" challenges can take 8-10s to auto-resolve
    retryNavigation: true,
  },
  {
    provider: 'datadome',
    detect: async (page: Page) => {
      return page.evaluate((maxBody) => {
        const bodyText = document.body?.innerText ?? '';
        // DataDome captcha iframe is a definitive signal regardless of body length
        const ddCaptchaIframe = !!document.querySelector('iframe[src*="datadome.co/captcha"], iframe[src*="geo.captcha-delivery.com"]');
        if (ddCaptchaIframe) return true;
        // For cookie + script detection, require sparse body (actual block page)
        if (bodyText.length > maxBody) return false;
        const hasDDCookie = document.cookie.includes('datadome');
        const bodyLower = bodyText.slice(0, 500).toLowerCase();
        return hasDDCookie && (bodyLower.includes('blocked') || bodyLower.includes('captcha'));
      }, MAX_BODY_FOR_BLOCK);
    },
    autoWaitMs: 5_000,
    retryNavigation: true,
  },
  {
    provider: 'generic_waf',
    detect: async (page: Page) => {
      return page.evaluate(() => {
        const title = document.title.toLowerCase();
        const body = document.body?.innerText?.slice(0, 1000) ?? '';
        const bodyLower = body.toLowerCase();
        const bodyLen = body.length;
        // Only flag as blocked if the page is very short (real block pages are sparse)
        const blockPattern = /access denied|captcha|robot check|not authorized|please verify|are you human|blocked by|security check/i;
        return bodyLen < 500 && (blockPattern.test(title) || blockPattern.test(bodyLower));
      });
    },
    autoWaitMs: 3_000,
    retryNavigation: false,
  },
];

/**
 * Detect if the current page shows a bot wall/challenge.
 * If detected, attempts auto-wait for resolution and optional retry.
 *
 * @param page - The Playwright page after navigation
 * @param url - The target URL (for retry navigation)
 * @returns BotWallResult with detection details
 */
export async function detectAndHandleBotWall(
  page: Page,
  url: string,
): Promise<BotWallResult> {
  for (const rule of DETECTION_RULES) {
    let detected = false;
    try {
      detected = await rule.detect(page);
    } catch {
      continue;  // Page context lost or error — skip this check
    }

    if (!detected) continue;

    logger.info(
      { provider: rule.provider, autoWaitMs: rule.autoWaitMs },
      'Bot wall detected, attempting auto-resolution',
    );

    // Wait for auto-resolve (e.g., Turnstile solving silently)
    await page.waitForTimeout(rule.autoWaitMs);

    // Re-check if the wall cleared
    let stillBlocked = false;
    try {
      stillBlocked = await rule.detect(page);
    } catch {
      stillBlocked = false;  // If we can't check, assume cleared
    }

    if (!stillBlocked) {
      logger.info({ provider: rule.provider }, 'Bot wall auto-resolved');
      return { blocked: false, provider: rule.provider, autoResolved: true, retrySucceeded: false };
    }

    // Try retry navigation if the rule supports it
    if (rule.retryNavigation) {
      // Attempt 1: Simple re-navigate (sometimes challenge auto-resolves on redirect)
      logger.info({ provider: rule.provider }, 'Retrying navigation after bot wall (attempt 1: re-navigate)');
      try {
        const referer = `https://www.google.com/search?q=${encodeURIComponent(new URL(url).hostname)}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000, referer });
        // Wait for networkidle so JS-rendered content (footers, social links) loads
        try {
          await page.waitForLoadState('networkidle', { timeout: 15_000 });
        } catch {
          // Best effort — some sites never reach networkidle
          await page.waitForTimeout(3_000);
        }

        let blockedAfterRetry = false;
        try {
          blockedAfterRetry = await rule.detect(page);
        } catch {
          blockedAfterRetry = false;
        }

        if (!blockedAfterRetry) {
          logger.info({ provider: rule.provider }, 'Bot wall cleared after retry (attempt 1)');
          return { blocked: false, provider: rule.provider, autoResolved: false, retrySucceeded: true };
        }
      } catch (error) {
        logger.warn(
          { provider: rule.provider, error: (error as Error).message },
          'Retry navigation failed (attempt 1)',
        );
      }

      // Attempt 2: Clear cookies + re-navigate with fresh session state
      // PerimeterX/DataDome set tracking cookies that accumulate risk score —
      // clearing them resets the score and often lets the next request through.
      logger.info({ provider: rule.provider }, 'Retrying after cookie clear (attempt 2)');
      try {
        const context = page.context();
        await context.clearCookies();
        // Small random delay to avoid pattern detection
        await page.waitForTimeout(1000 + Math.floor(Math.random() * 2000));
        const referer = `https://www.google.com/search?q=${encodeURIComponent(new URL(url).hostname)}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000, referer });
        // Wait for networkidle so JS-rendered content (footers, social links) loads
        try {
          await page.waitForLoadState('networkidle', { timeout: 15_000 });
        } catch {
          await page.waitForTimeout(3_000);
        }

        let blockedAfterClear = false;
        try {
          blockedAfterClear = await rule.detect(page);
        } catch {
          blockedAfterClear = false;
        }

        if (!blockedAfterClear) {
          logger.info({ provider: rule.provider }, 'Bot wall cleared after cookie clear (attempt 2)');
          return { blocked: false, provider: rule.provider, autoResolved: false, retrySucceeded: true };
        }
      } catch (error) {
        logger.warn(
          { provider: rule.provider, error: (error as Error).message },
          'Cookie-clear retry failed (attempt 2)',
        );
      }
    }

    // Still blocked after all attempts
    logger.warn({ provider: rule.provider }, 'Bot wall could not be resolved after all attempts');
    return { blocked: true, provider: rule.provider, autoResolved: false, retrySucceeded: false };
  }

  return { blocked: false, provider: null, autoResolved: false, retrySucceeded: false };
}
