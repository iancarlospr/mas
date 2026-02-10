import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import pino from 'pino';

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
 * - Stealth-mode configuration to avoid bot detection
 */
export class BrowserPool {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private restartCount = 0;
  private launching = false;
  private launchPromise: Promise<Browser> | null = null;

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
   */
  private async launchBrowser(): Promise<Browser> {
    logger.info({ restartCount: this.restartCount }, 'Launching Chromium');

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
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
        // Memory constraints for DigitalOcean
        '--js-flags=--max-old-space-size=256',
        '--disable-features=TranslateUI',
        '--single-process',
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
   */
  async createPage(): Promise<Page> {
    const browser = await this.getBrowser();

    // Close any existing context
    if (this.context) {
      try {
        await this.context.close();
      } catch {
        // Context may already be closed
      }
    }

    // Create a new context with stealth settings
    this.context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
      geolocation: undefined,
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      bypassCSP: false,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });

    // Apply stealth patches
    await this.applyStealthPatches(this.context);

    const page = await this.context.newPage();

    // Set default navigation timeout
    page.setDefaultNavigationTimeout(30_000);
    page.setDefaultTimeout(15_000);

    return page;
  }

  /**
   * Apply stealth patches to avoid bot detection.
   */
  private async applyStealthPatches(context: BrowserContext): Promise<void> {
    await context.addInitScript(() => {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override Chrome specific

      (window as unknown as Record<string, unknown>)['chrome'] = {
        runtime: {},
        loadTimes: () => ({}),
        csi: () => ({}),
        app: {},
      };

      // Override permissions

      const originalQuery = window.navigator.permissions.query;

      window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
        parameters.name === 'notifications'

          ? Promise.resolve({ state: 'denied' } as PermissionStatus)
          : originalQuery(parameters);
    });
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
