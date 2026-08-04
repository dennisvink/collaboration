import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 60_000 });
}

test('desktop exposes playable renderer and visible in-viewport HUD', async ({ page }) => {
  await ready(page);
  await expect(page).toHaveTitle(/3D Pacman/i);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('.pacman-hud')).toBeVisible();
  await expect(page.locator('#touch-controls')).toBeHidden();
  const box = await page.locator('.pacman-hud').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await expect.poll(() => page.evaluate(() => window.__GAME__.entities.size)).toBeGreaterThan(20);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__GAME__.gameplay.getState().status)).toBe('playing');
});

test('first D-pad press starts play, applies direction and exposes 48px targets', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage(); await ready(page);
  const right = page.getByRole('button', { name: 'Rechts' });
  await expect(right).toBeVisible();
  const box = await right.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(48); expect(box.height).toBeGreaterThanOrEqual(48);
  await right.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await expect.poll(() => page.evaluate(() => window.__GAME__.gameplay.getState().status)).toBe('playing');
  await expect.poll(() => page.evaluate(() => window.__GAME__.input.getDirection().x)).toBe(1);
  await expect(right).toHaveAttribute('aria-pressed', 'true');
  await right.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await context.close();
});
