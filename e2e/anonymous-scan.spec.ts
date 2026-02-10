import { test, expect } from '@playwright/test';
import { ScanPage } from './pages/scan.page';

test.describe('Anonymous Scan Flow', () => {
  test('should complete a full scan and show results', async ({ page }) => {
    const scanPage = new ScanPage(page);

    await page.goto('/');
    await scanPage.submitUrl('https://example.com');

    // Should navigate to scan progress page
    await expect(page).toHaveURL(/\/scan\/[a-z0-9-]+/);

    // Progress should start updating
    await expect(scanPage.progressBar).toBeVisible({ timeout: 10_000 });

    // Wait for phase 1 to complete (passive modules)
    await expect(scanPage.phaseIndicators.nth(0)).toHaveAttribute(
      'data-status',
      'complete',
      { timeout: 30_000 },
    );

    // Wait for full scan completion (up to 2 minutes)
    await scanPage.waitForScanComplete(120_000);

    // MarketingIQ score should be visible
    await expect(scanPage.marketingIQScore).toBeVisible();
    const scoreText = await scanPage.marketingIQScore.textContent();
    const score = parseInt(scoreText || '0', 10);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);

    // Module cards should be rendered
    const moduleCount = await scanPage.moduleCards.count();
    expect(moduleCount).toBeGreaterThanOrEqual(20);
  });

  test('should handle invalid URL gracefully', async ({ page }) => {
    const scanPage = new ScanPage(page);

    await page.goto('/');
    await scanPage.submitUrl('not-a-url');

    await expect(scanPage.errorMessage).toBeVisible();
    await expect(scanPage.errorMessage).toContainText(/valid url/i);
  });

  test('should handle unreachable site gracefully', async ({ page }) => {
    const scanPage = new ScanPage(page);

    await page.goto('/');
    await scanPage.submitUrl('https://this-domain-does-not-exist-12345.com');

    await expect(scanPage.errorMessage).toBeVisible({ timeout: 30_000 });
  });
});
