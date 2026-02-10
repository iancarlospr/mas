import type { Page } from 'playwright';
import type { NetworkCollector, CapturedRequest } from '../utils/network.js';
import pino from 'pino';

const logger = pino({ name: 'ghostscan-probes' });

/**
 * Scroll to a specific position on the page.
 * Useful for triggering lazy-loaded content and scroll-based analytics events.
 */
export async function scrollTo(
  page: Page,
  options: {
    /** Percentage of the page to scroll to (0-100) */
    percentage?: number;
    /** Specific Y position in pixels */
    y?: number;
    /** Whether to scroll smoothly */
    smooth?: boolean;
    /** Wait time after scrolling (ms) */
    waitAfter?: number;
  } = {},
): Promise<void> {
  const { percentage, y, smooth = true, waitAfter = 500 } = options;

  try {
    if (percentage !== undefined) {
      await page.evaluate(
        ([pct, isSmooth]) => {

          const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
          const targetY = (pct / 100) * maxScrollY;

          window.scrollTo({
            top: targetY,
            behavior: isSmooth ? 'smooth' : 'instant',
          });
        },
        [percentage, smooth] as [number, boolean],
      );
    } else if (y !== undefined) {
      await page.evaluate(
        ([targetY, isSmooth]) => {

          window.scrollTo({
            top: targetY,
            behavior: isSmooth ? 'smooth' : 'instant',
          });
        },
        [y, smooth] as [number, boolean],
      );
    } else {
      // Default: scroll to bottom
      await page.evaluate(() => {

        window.scrollTo({

          top: document.documentElement.scrollHeight,
          behavior: 'smooth',
        });
      });
    }

    if (waitAfter > 0) {
      await page.waitForTimeout(waitAfter);
    }
  } catch (error) {
    logger.debug({ error: (error as Error).message }, 'scrollTo probe failed');
  }
}

/**
 * Click an element by selector.
 * Useful for triggering click-based event listeners and tracking pixels.
 */
export async function clickElement(
  page: Page,
  selector: string,
  options: {
    /** Wait for the element to be visible first */
    waitForVisible?: boolean;
    /** Timeout for waiting */
    timeout?: number;
    /** Wait time after clicking (ms) */
    waitAfter?: number;
  } = {},
): Promise<boolean> {
  const { waitForVisible = true, timeout = 5_000, waitAfter = 1_000 } = options;

  try {
    if (waitForVisible) {
      await page.waitForSelector(selector, { state: 'visible', timeout });
    }

    await page.click(selector, { timeout });

    if (waitAfter > 0) {
      await page.waitForTimeout(waitAfter);
    }

    return true;
  } catch (error) {
    logger.debug(
      { selector, error: (error as Error).message },
      'clickElement probe failed',
    );
    return false;
  }
}

/**
 * Hover over an element by selector.
 * Useful for triggering hover-based event handlers.
 */
export async function hoverElement(
  page: Page,
  selector: string,
  options: {
    timeout?: number;
    waitAfter?: number;
  } = {},
): Promise<boolean> {
  const { timeout = 5_000, waitAfter = 500 } = options;

  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    await page.hover(selector, { timeout });

    if (waitAfter > 0) {
      await page.waitForTimeout(waitAfter);
    }

    return true;
  } catch (error) {
    logger.debug(
      { selector, error: (error as Error).message },
      'hoverElement probe failed',
    );
    return false;
  }
}

/**
 * Wait for the page to become idle (no pending network requests).
 */
export async function waitForIdle(
  page: Page,
  options: {
    /** Max time to wait for idle (ms) */
    timeout?: number;
    /** Number of ms with no network activity to consider idle */
    idleTime?: number;
  } = {},
): Promise<void> {
  const { timeout = 10_000, idleTime = 2_000 } = options;

  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // Network idle timeout is common, not an error
    logger.debug('waitForIdle: networkidle timeout, waiting for manual idle');

    // Fallback: just wait the idle time
    await page.waitForTimeout(Math.min(idleTime, timeout));
  }
}

/**
 * Fill a form field with text.
 * Useful for testing form tracking and validation scripts.
 */
export async function fillForm(
  page: Page,
  selector: string,
  value: string,
  options: {
    timeout?: number;
    waitAfter?: number;
    clearFirst?: boolean;
  } = {},
): Promise<boolean> {
  const { timeout = 5_000, waitAfter = 500, clearFirst = true } = options;

  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });

    if (clearFirst) {
      await page.fill(selector, '');
    }

    await page.fill(selector, value);

    if (waitAfter > 0) {
      await page.waitForTimeout(waitAfter);
    }

    return true;
  } catch (error) {
    logger.debug(
      { selector, error: (error as Error).message },
      'fillForm probe failed',
    );
    return false;
  }
}

/**
 * Capture network delta -- records all new network requests made during
 * a probe action. Returns the requests captured between the before and
 * after timestamps.
 *
 * Usage:
 *   const before = Date.now();
 *   await clickElement(page, 'button');
 *   const delta = captureNetworkDelta(networkCollector, before);
 */
export function captureNetworkDelta(
  networkCollector: NetworkCollector,
  sinceTimestamp: number,
): CapturedRequest[] {
  return networkCollector.getRequestsSince(sinceTimestamp);
}

/**
 * Perform a full scroll probe: scroll from top to bottom in increments,
 * capturing any lazy-loaded content and network activity.
 */
export async function fullScrollProbe(
  page: Page,
  options: {
    /** Number of scroll steps */
    steps?: number;
    /** Delay between steps (ms) */
    stepDelay?: number;
  } = {},
): Promise<void> {
  const { steps = 5, stepDelay = 800 } = options;

  try {
    // Start at top
    await scrollTo(page, { y: 0, smooth: false, waitAfter: 200 });

    // Scroll in increments
    for (let i = 1; i <= steps; i++) {
      const percentage = (i / steps) * 100;
      await scrollTo(page, { percentage, smooth: true, waitAfter: stepDelay });
    }

    // Return to top
    await scrollTo(page, { y: 0, smooth: false, waitAfter: 300 });
  } catch (error) {
    logger.debug({ error: (error as Error).message }, 'fullScrollProbe failed');
  }
}

/**
 * Probe for consent/cookie banner and attempt to interact with it.
 * Returns whether a consent banner was found and interacted with.
 */
export async function probeConsentBanner(
  page: Page,
): Promise<{ found: boolean; type: string | null; interacted: boolean }> {
  const consentSelectors = [
    // Common consent management platforms
    '#onetrust-banner-sdk',
    '#CybotCookiebotDialog',
    '.cc-banner',
    '#cookie-law-info-bar',
    '.evidon-consent-button',
    '[data-testid="cookie-policy-manage-dialog"]',
    '#gdpr-cookie-notice',
    '.qc-cmp2-summary-buttons',
    '#consent-banner',
    '.cookie-consent',
    '.cookie-banner',
    '[class*="cookie-consent"]',
    '[class*="cookie-banner"]',
    '[class*="consent-banner"]',
    '[id*="cookie-consent"]',
    '[id*="cookie-banner"]',
  ];

  for (const selector of consentSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          // Try to find and click an "accept" button within the banner
          const acceptSelectors = [
            `${selector} button[class*="accept"]`,
            `${selector} button[id*="accept"]`,
            `${selector} [class*="accept"]`,
            `${selector} button:has-text("Accept")`,
            `${selector} button:has-text("Allow")`,
            `${selector} button:has-text("OK")`,
            `${selector} button:has-text("Got it")`,
            `${selector} button:has-text("I agree")`,
          ];

          for (const acceptSelector of acceptSelectors) {
            const clicked = await clickElement(page, acceptSelector, {
              waitForVisible: false,
              timeout: 2_000,
              waitAfter: 1_000,
            });
            if (clicked) {
              return { found: true, type: selector, interacted: true };
            }
          }

          return { found: true, type: selector, interacted: false };
        }
      }
    } catch {
      // Continue to next selector
    }
  }

  return { found: false, type: null, interacted: false };
}

/**
 * Type text character by character (simulates real typing).
 * Useful for triggering key-by-key event handlers.
 */
export async function typeText(
  page: Page,
  selector: string,
  text: string,
  options: {
    delay?: number;
    timeout?: number;
  } = {},
): Promise<boolean> {
  const { delay = 50, timeout = 5_000 } = options;

  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    await page.type(selector, text, { delay });
    return true;
  } catch (error) {
    logger.debug(
      { selector, error: (error as Error).message },
      'typeText probe failed',
    );
    return false;
  }
}
