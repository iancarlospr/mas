// patchright: drop-in Playwright replacement that patches CDP Runtime.enable
// leak — the #1 detection vector for Akamai/Cloudflare/DataDome bot managers.
// See: https://github.com/Kaliiiiiiiiii-Vinyzu/patchright
import { chromium, type Browser, type BrowserContext, type Page } from 'patchright';
import { generateStealthProfile, type StealthProfile } from './stealth-profile.js';
import { applyStealthPatches } from './stealth-patches.js';
import { existsSync } from 'node:fs';
import pino from 'pino';

/**
 * Detect whether system Chrome is installed. Prefer it over bundled Chromium
 * because system Chrome has a genuine TLS fingerprint (JA3/JA4) that Akamai,
 * Cloudflare, and DataDome won't flag as automation.
 */
function detectChromeChannel(): string | undefined {
  // Explicit env var override — set to empty string to force bundled Chromium
  const envChannel = process.env.STEALTH_CHROME_CHANNEL;
  if (envChannel !== undefined) return envChannel || undefined;

  // Auto-detect system Chrome
  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',  // macOS
    '/usr/bin/google-chrome-stable',                                  // Linux (Debian/Ubuntu)
    '/usr/bin/google-chrome',                                         // Linux (generic)
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',     // Windows
  ];
  for (const p of chromePaths) {
    if (existsSync(p)) return 'chrome';
  }
  return undefined;
}

const logger = pino({ name: 'browser-pool' });

const MAX_RESTART_ATTEMPTS = 3;

/**
 * BrowserPool manages a single persistent Chromium instance with
 * page/context creation per scan and auto-restart on crash.
 *
 * Design:
 * - One browser instance shared across a scan's lifecycle
 * - Fresh BrowserContext per scan (isolated cookies, storage)
 * - Auto-restart up to MAX_RESTART_ATTEMPTS on crashes
 * - Per-scan randomized stealth profile to avoid bot detection
 */
export class BrowserPool {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private restartCount = 0;
  private launching = false;
  private launchPromise: Promise<Browser> | null = null;
  private currentProfile: StealthProfile | null = null;

  /**
   * Get or launch the browser instance.
   * Uses a launch lock to prevent concurrent launches.
   */
  async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) {
      return this.browser;
    }

    // If already launching, wait for the existing promise
    if (this.launching && this.launchPromise) {
      return this.launchPromise;
    }

    this.launching = true;
    this.launchPromise = this.launchBrowser();

    try {
      const browser = await this.launchPromise;
      return browser;
    } finally {
      this.launching = false;
      this.launchPromise = null;
    }
  }

  /**
   * Launch a new Chromium browser instance with stealth configuration.
   * Uses modern headless mode and removes automation detection signals.
   */
  private async launchBrowser(): Promise<Browser> {
    const channel = detectChromeChannel();
    logger.info({ restartCount: this.restartCount, channel: channel ?? 'bundled-chromium' }, 'Launching browser');

    this.browser = await chromium.launch({
      headless: true,
      channel,
      args: [
        // Use new headless mode — identical to headed Chrome, undetectable by DataDome/Cloudflare.
        // Old headless was a separate implementation with detectable differences.
        '--headless=new',
        // Critical: removes navigator.webdriver automation flag at browser level
        '--disable-blink-features=AutomationControlled',
        // Sandbox & memory constraints for DigitalOcean
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--js-flags=--max-old-space-size=512',
        // Reduce noise & resource usage
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update',
        '--disable-features=TranslateUI',
        // NOTE: '--single-process' REMOVED — real browsers never use it,
        // and it's a detection signal for bot managers
      ],
    });

    // Set up disconnect handler for auto-restart
    this.browser.on('disconnected', () => {
      logger.warn('Browser disconnected');
      this.browser = null;
      this.context = null;
    });

    logger.info('Chromium launched successfully');
    return this.browser;
  }

  /**
   * Create a new page within a fresh browser context.
   * Context provides cookie and storage isolation per scan.
   * Uses a randomized StealthProfile for anti-detection.
   *
   * @param targetUrl - Optional URL for geo-appropriate profile selection
   */
  async createPage(targetUrl?: string): Promise<Page> {
    const browser = await this.getBrowser();

    // Close any existing context
    if (this.context) {
      try {
        await this.context.close();
      } catch {
        // Context may already be closed
      }
    }

    // Generate a fresh stealth profile for this scan
    this.currentProfile = generateStealthProfile(targetUrl);
    const profile = this.currentProfile;

    logger.debug(
      {
        ua: profile.userAgent.slice(0, 60),
        viewport: `${profile.viewport.width}x${profile.viewport.height}`,
        tz: profile.timezoneId,
        platform: profile.platform,
      },
      'Using stealth profile',
    );

    // Create a new context with stealth settings
    this.context = await browser.newContext({
      userAgent: profile.userAgent,
      viewport: profile.viewport,
      locale: profile.locale,
      timezoneId: profile.timezoneId,
      permissions: [],
      geolocation: undefined,
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      bypassCSP: false,
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'sec-ch-ua': profile.secChUa,
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': profile.secChUaPlatform,
        'Upgrade-Insecure-Requests': '1',
      },
    });

    // Apply comprehensive stealth patches
    await applyStealthPatches(this.context, profile);

    const page = await this.context.newPage();

    // Set default navigation timeout
    page.setDefaultNavigationTimeout(30_000);
    page.setDefaultTimeout(15_000);

    return page;
  }

  /**
   * Create a mobile page in a separate BrowserContext with mobile UA, viewport,
   * and touch support. Used for the mobile rendering pass in the runner.
   *
   * Returns both the page and context so the caller can close them independently
   * (the desktop context remains alive for subsequent ghostscan modules).
   *
   * IMPORTANT: We build a mobile-consistent StealthProfile with Android-appropriate
   * platform, WebGL, and hardware properties. Applying a desktop profile (macOS/Windows
   * WebGL renderer, navigator.platform = 'MacIntel') to a mobile UA would create
   * detectable fingerprint inconsistencies that bot detectors flag.
   */
  async createMobilePage(targetUrl?: string): Promise<{ page: Page; context: BrowserContext }> {
    const browser = await this.getBrowser();

    // Use the existing desktop profile as a base for Chrome version consistency
    const desktopProfile = this.currentProfile ?? generateStealthProfile(targetUrl);

    // Derive a mobile User-Agent from the desktop one, adding "Mobile" before "Safari"
    const mobileUA = desktopProfile.userAgent
      .replace(/\(Macintosh; Intel Mac OS X [^)]+\)/, '(Linux; Android 14; Pixel 8)')
      .replace(/\(Windows NT [^)]+\)/, '(Linux; Android 14; Pixel 8)')
      .replace(/\(X11; Linux x86_64\)/, '(Linux; Android 14; Pixel 8)')
      .replace(/ Safari\//, ' Mobile Safari/');

    // Build a mobile-consistent stealth profile — Android platform, Adreno GPU,
    // mobile-appropriate hardware (fewer cores, less memory than desktop)
    const mobileProfile: StealthProfile = {
      ...desktopProfile,
      userAgent: mobileUA,
      viewport: { width: 393, height: 852 },
      platform: 'Android' as StealthProfile['platform'],
      secChUaPlatform: '"Android"',
      secChUaPlatformVersion: '"14.0.0"',
      webglVendor: 'Qualcomm',
      webglRenderer: 'Adreno (TM) 740',
      hardwareConcurrency: 8,
      deviceMemory: 8,
    };

    const mobileContext = await browser.newContext({
      userAgent: mobileUA,
      viewport: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
      locale: desktopProfile.locale,
      timezoneId: desktopProfile.timezoneId,
      permissions: [],
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      bypassCSP: false,
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'sec-ch-ua': desktopProfile.secChUa,
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    // Apply stealth patches with mobile-consistent profile (Android platform,
    // Adreno GPU, mobile hardware) — NOT the desktop profile
    await applyStealthPatches(mobileContext, mobileProfile);

    const page = await mobileContext.newPage();
    page.setDefaultNavigationTimeout(25_000);
    page.setDefaultTimeout(15_000);

    logger.debug(
      { viewport: '393x852', ua: mobileUA.slice(0, 80) },
      'Created mobile page with Android-consistent stealth profile',
    );

    return { page, context: mobileContext };
  }

  /**
   * Get the current stealth profile (useful for logging/debugging).
   */
  getProfile(): StealthProfile | null {
    return this.currentProfile;
  }

  /**
   * Attempt to restart the browser after a crash.
   * Returns the new browser or throws if max restarts exceeded.
   */
  async restart(): Promise<Browser> {
    this.restartCount++;

    if (this.restartCount > MAX_RESTART_ATTEMPTS) {
      const error = new Error(
        `Browser exceeded maximum restart attempts (${MAX_RESTART_ATTEMPTS})`,
      );
      logger.error({ restartCount: this.restartCount }, error.message);
      throw error;
    }

    logger.warn(
      { restartCount: this.restartCount, max: MAX_RESTART_ATTEMPTS },
      'Restarting browser',
    );

    // Close existing browser if it's still around
    await this.forceClose();

    return this.getBrowser();
  }

  /**
   * Force close the browser, ignoring errors.
   */
  private async forceClose(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
    } catch {
      this.browser = null;
      this.context = null;
    }
  }

  /**
   * Gracefully close the browser pool.
   */
  async close(): Promise<void> {
    await this.forceClose();
    this.restartCount = 0;
    this.currentProfile = null;
    logger.info('Browser pool closed');
  }

  /**
   * Check if the browser is alive and connected.
   */
  isHealthy(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  /**
   * Get the current restart count.
   */
  getRestartCount(): number {
    return this.restartCount;
  }
}
