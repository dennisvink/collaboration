import { test, expect } from '@playwright/test';

test('integrated game exposes renderer, HUD, controls and entities', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 60_000 });
  await expect(page).toHaveTitle(/3D Pacman/i);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('.pacman-hud')).toBeVisible();
  await expect(page.locator('#touch-controls button')).toHaveCount(6);
  await expect.poll(() => page.evaluate(() => window.__GAME__.entities.size)).toBeGreaterThan(20);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__GAME__.gameplay.getState().status)).toBe('playing');
});
