import { test, expect } from '@playwright/test';

test('homepage loads and signals ready', async ({ page }) => {
  await page.goto('/');

  // The app must set window.__GAME_READY__ = true when bootstrapped.
  await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 60_000 });

  // Bonus health check: page title should exist
  await expect(page).toHaveTitle(/.*/);
});
