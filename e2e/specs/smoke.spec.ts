import { test, expect } from '@playwright/test';

/**
 * Smoke tests - basic tests without custom fixtures
 * These tests verify the basic functionality of the test setup
 */
test.describe('Smoke Tests', () => {
  test('page loads and has title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Gridder/);
  });

  test('page has main content', async ({ page }) => {
    await page.goto('/');
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Check if body has content
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  test('toolbar is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for toolbar with longer timeout
    const toolbar = page.getByRole('toolbar');
    await expect(toolbar).toBeVisible({ timeout: 60000 });
  });

  test('canvas is rendered', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for canvas with longer timeout
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 60000 });
  });

  test('can click on toolbar buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for page to fully load
    await page.waitForTimeout(2000);

    // Try to find and click a toolbar button
    const drawButton = page.getByRole('radio', { name: /描画ツール/i });
    await expect(drawButton).toBeVisible({ timeout: 30000 });
    await drawButton.click();
  });
});
