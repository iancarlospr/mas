import type { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly urlInput: Locator;
  readonly scanButton: Locator;
  readonly loginLink: Locator;
  readonly signUpLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.urlInput = page.getByPlaceholder(/enter.*url/i);
    this.scanButton = page.getByRole('button', { name: /scan|analyze/i });
    this.loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i });
    this.signUpLink = page.getByRole('link', { name: /sign\s?up|get started/i });
  }

  async goto() {
    await this.page.goto('/');
  }

  async submitScan(url: string) {
    await this.urlInput.fill(url);
    await this.scanButton.click();
  }
}
