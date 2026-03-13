import type { Page } from 'patchright';
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

// ── Human-Like Behavior Functions ────────────────────────────────────────
// These functions simulate realistic human mouse movement and interaction
// patterns to avoid behavioral detection by DataDome, Akamai, PerimeterX.

/**
 * Generate Bezier curve control points for human-like mouse movement.
 * Real mouse paths are not straight lines — they curve with variable speed
 * (fast in the middle, slow at endpoints).
 */
function bezierPath(
  x0: number, y0: number,
  x1: number, y1: number,
  steps: number,
): Array<{ x: number; y: number }> {
  // Two random control points create a natural-looking curve
  const cp1x = x0 + (x1 - x0) * 0.25 + (Math.random() - 0.5) * 60;
  const cp1y = y0 + (y1 - y0) * 0.25 + (Math.random() - 0.5) * 60;
  const cp2x = x0 + (x1 - x0) * 0.75 + (Math.random() - 0.5) * 60;
  const cp2y = y0 + (y1 - y0) * 0.75 + (Math.random() - 0.5) * 60;

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    // Cubic Bezier formula
    const x = u * u * u * x0 + 3 * u * u * t * cp1x + 3 * u * t * t * cp2x + t * t * t * x1;
    const y = u * u * u * y0 + 3 * u * u * t * cp1y + 3 * u * t * t * cp2y + t * t * t * y1;
    points.push({ x: Math.round(x), y: Math.round(y) });
  }
  return points;
}

/**
 * Move mouse along a Bezier curve path to target coordinates.
 * Mimics human mouse movement with variable speed.
 */
export async function humanMove(
  page: Page,
  targetX: number,
  targetY: number,
): Promise<void> {
  try {
    // Get current mouse position (default to random starting point)
    const startX = 100 + Math.random() * 200;
    const startY = 100 + Math.random() * 200;

    const distance = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);
    const steps = Math.max(8, Math.min(25, Math.floor(distance / 30)));
    const path = bezierPath(startX, startY, targetX, targetY, steps);

    for (let i = 0; i < path.length; i++) {
      const point = path[i]!;
      // Variable speed: slow at start and end, fast in middle
      const progress = i / path.length;
      const speedFactor = Math.sin(progress * Math.PI); // 0→1→0
      const delay = Math.max(2, 15 - speedFactor * 12);
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(delay);
    }
  } catch (error) {
    logger.debug({ error: (error as Error).message }, 'humanMove failed');
  }
}

/**
 * Click an element with human-like behavior:
 * - Move to a random point within the element's bounding box (not center)
 * - Brief pause before clicking (50-150ms)
 * - Natural mouse movement path to the element
 */
export async function humanClick(
  page: Page,
  selector: string,
  options: {
    timeout?: number;
    waitAfter?: number;
  } = {},
): Promise<boolean> {
  const { timeout = 5_000, waitAfter = 800 } = options;

  try {
    const element = await page.waitForSelector(selector, { state: 'visible', timeout });
    if (!element) return false;

    const box = await element.boundingBox();
    if (!box) return false;

    // Random point within bounding box (not dead center)
    const clickX = box.x + box.width * (0.2 + Math.random() * 0.6);
    const clickY = box.y + box.height * (0.2 + Math.random() * 0.6);

    // Move to the element with human-like path
    await humanMove(page, clickX, clickY);

    // Brief pause before clicking (humans hesitate slightly)
    await page.waitForTimeout(50 + Math.random() * 100);

    // Click at the position
    await page.mouse.click(clickX, clickY);

    if (waitAfter > 0) {
      await page.waitForTimeout(waitAfter);
    }

    return true;
  } catch (error) {
    logger.debug(
      { selector, error: (error as Error).message },
      'humanClick failed',
    );
    return false;
  }
}

/**
 * Scroll the page with human-like behavior using mouse wheel events.
 * Real users scroll with variable speed and micro-pauses, not
 * instantaneous window.scrollTo() calls.
 *
 * @param page - Playwright page
 * @param totalPixels - Total pixels to scroll (positive = down)
 * @param options - Speed and pause configuration
 */
export async function humanScroll(
  page: Page,
  totalPixels: number,
  options: {
    /** Minimum pixels per wheel event */
    minDelta?: number;
    /** Maximum pixels per wheel event */
    maxDelta?: number;
    /** Delay range between wheel events (ms) */
    minDelay?: number;
    maxDelay?: number;
  } = {},
): Promise<void> {
  const {
    minDelta = 40,
    maxDelta = 120,
    minDelay = 30,
    maxDelay = 100,
  } = options;

  try {
    let scrolled = 0;
    const direction = totalPixels > 0 ? 1 : -1;
    const target = Math.abs(totalPixels);

    while (scrolled < target) {
      const remaining = target - scrolled;
      const delta = Math.min(
        remaining,
        minDelta + Math.random() * (maxDelta - minDelta),
      );

      await page.mouse.wheel(0, delta * direction);
      scrolled += delta;

      // Variable delay — slower at start and end
      const progress = scrolled / target;
      const speedFactor = Math.sin(progress * Math.PI);
      const delay = maxDelay - speedFactor * (maxDelay - minDelay);
      await page.waitForTimeout(delay);

      // Occasional micro-pause (10% chance) — humans naturally pause
      if (Math.random() < 0.1) {
        await page.waitForTimeout(200 + Math.random() * 400);
      }
    }
  } catch (error) {
    logger.debug({ error: (error as Error).message }, 'humanScroll failed');
  }
}

/**
 * Perform a full human-like scroll probe: scroll from top to bottom
 * using realistic mouse wheel events with variable speed and pauses.
 */
export async function humanFullScrollProbe(
  page: Page,
  options: {
    /** Number of scroll segments */
    segments?: number;
    /** Pause between segments (ms) */
    segmentPause?: number;
  } = {},
): Promise<void> {
  const { segments = 4, segmentPause = 500 } = options;

  try {
    const pageHeight = await page.evaluate(() =>
      document.documentElement.scrollHeight - window.innerHeight,
    );
    if (pageHeight <= 0) return;

    // Start at top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    const segmentHeight = Math.ceil(pageHeight / segments);

    for (let i = 0; i < segments; i++) {
      await humanScroll(page, segmentHeight);
      // Pause between segments (reading time)
      await page.waitForTimeout(segmentPause + Math.random() * 400);
    }

    // Scroll back to top
    await page.waitForTimeout(500);
    await humanScroll(page, -pageHeight, { minDelta: 80, maxDelta: 200, minDelay: 15, maxDelay: 50 });
  } catch (error) {
    logger.debug({ error: (error as Error).message }, 'humanFullScrollProbe failed');
  }
}
