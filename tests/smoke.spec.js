import { test, expect } from '@playwright/test';

async function waitUntilReady(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 60_000 });
}

test('playable entrypoint boots all subsystems', async ({ page }) => {
  await waitUntilReady(page);
  await expect(page).toHaveTitle(/3D Pacman/i);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#touch-controls')).toBeVisible();
  await expect(page.locator('[data-hud="score"]')).toHaveText('0');
  await expect(page.locator('#primary-action')).toHaveText('Start spel');

  await page.keyboard.press('Enter');
  await expect(page.locator('#primary-action')).toBeHidden();
  await expect(page.locator('#status')).toHaveText('Spel actief');
  await page.keyboard.press('KeyP');
  await expect(page.locator('#status')).toHaveText('Spel gepauzeerd');
  await page.keyboard.press('KeyR');
  await expect(page.locator('#primary-action')).toHaveText('Start spel');
});

test('touch controls are visible in portrait and landscape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await waitUntilReady(page);
  await expect(page.locator('[data-action="move-up"]')).toBeVisible();
  await page.locator('#primary-action').click();
  await page.locator('[data-action="pause"]').tap();
  await expect(page.locator('#status')).toHaveText('Spel gepauzeerd');

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('[data-action="move-right"]')).toBeVisible();
  await expect(page.locator('#game canvas')).toBeVisible();
});
