import type { Page, Locator } from '@playwright/test';

export class ScanPage {
  readonly page: Page;
  readonly urlInput: Locator;
  readonly scanButton: Locator;
  readonly progressBar: Locator;
  readonly phaseIndicators: Locator;
  readonly moduleCards: Locator;
  readonly marketingIQScore: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.urlInput = page.getByPlaceholder(/enter.*url/i);
    this.scanButton = page.getByRole('button', { name: /scan|analyze/i });
    this.progressBar = page.getByRole('progressbar');
    this.phaseIndicators = page.locator('[data-testid="phase-indicator"]');
    this.moduleCards = page.locator('[data-testid="module-card"]');
    this.marketingIQScore = page.locator('[data-testid="marketing-iq"]');
    this.errorMessage = page.locator('[data-testid="scan-error"]');
  }

  async submitUrl(url: string) {
    await this.urlInput.fill(url);
    await this.scanButton.click();
  }

  async waitForScanComplete(timeout = 120_000) {
    await this.marketingIQScore.waitFor({
      state: 'visible',
      timeout,
    });
  }

  async getProgress(): Promise<number> {
    const value = await this.progressBar.getAttribute('aria-valuenow');
    return parseInt(value || '0', 10);
  }

  async getCompletedModuleCount(): Promise<number> {
    return this.moduleCards
      .filter({ has: this.page.locator('.status-complete') })
      .count();
  }
}
