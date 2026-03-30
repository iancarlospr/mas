import { test as setup, expect } from '@playwright/test';
import { AuthPage } from './pages/auth.page';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'free@test.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpass123';

setup('authenticate test user', async ({ page }) => {
  await page.goto('/login');

  const authPage = new AuthPage(page);
  await authPage.login(TEST_EMAIL, TEST_PASSWORD);

  // Wait for redirect after login
  await expect(page).not.toHaveURL(/\/login/);

  // Save auth state for reuse in other tests
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
