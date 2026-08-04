import { test, expect } from '@playwright/test';

test('playable integration loads, starts and exposes responsive controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 60_000 });

  await expect(page).toHaveTitle(/3D Pacman/i);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('.pacman-hud')).toBeVisible();
  await expect(page.locator('[data-hud="score"]')).toHaveText('0');
  await expect(page.locator('#primary-action')).toHaveText('Start spel');
  await page.locator('#primary-action').click();
  await expect(page.locator('#primary-action')).toBeHidden();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  await expect(page.locator('[data-action="move-up"]')).toHaveAttribute('aria-label', /omhoog|move up/i);
  expect(errors).toEqual([]);
});

test('portrait and landscape layouts keep touch targets usable', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.waitForFunction(() => window.__GAME_READY__ === true);
    const boxes = await page.locator('#touch-controls button').evaluateAll((buttons) => buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }));
    expect(boxes.every((box) => box.width >= 48 && box.height >= 48)).toBeTruthy();
  }
});
