import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('homepage should match baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('homepage.png', {
      maxDiffPixelRatio: 0.01,
      fullPage: true,
    });
  });

  test('scan results page should match baseline', async ({ page }) => {
    await page.goto('/scan/test-completed-scan-id');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('scan-results.png', {
      maxDiffPixelRatio: 0.02,
      fullPage: true,
    });
  });

  test('mobile homepage should match baseline', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
