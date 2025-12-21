import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { AppPage } from '../pages/app.page';

/**
 * Accessibility Tests
 *
 * WCAG 2.1 AA compliance tests using axe-playwright
 * Tests cover initial page load, toolbar, property panel, dialogs, and form elements
 */
test.describe('Accessibility', () => {
  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.goto();
    await page.waitForLoadState('domcontentloaded');
    // Wait for toolbar to be visible (indicates app is ready)
    await expect(page.getByRole('toolbar')).toBeVisible({ timeout: 60000 });
  });

  test('initial page load has no WCAG AA violations', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Log violations for debugging
    if (results.violations.length > 0) {
      console.log('Violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test('toolbar has no accessibility violations', async ({ page }) => {
    const toolbar = page.getByRole('toolbar');
    await expect(toolbar).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="toolbar"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Toolbar violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test('toolbar buttons have proper ARIA attributes', async ({ page }) => {
    // Check radiogroup exists
    const radiogroup = page.locator('[role="radiogroup"]');
    await expect(radiogroup).toBeVisible();

    // Check individual tool buttons have proper ARIA
    const drawButton = page.getByRole('radio', { name: /描画ツール/i });
    const selectButton = page.getByRole('radio', { name: /選択ツール/i });
    const eraserButton = page.getByRole('radio', { name: /消しゴム/i });

    await expect(drawButton).toBeVisible();
    await expect(selectButton).toBeVisible();
    await expect(eraserButton).toBeVisible();

    // Check aria-checked attribute
    const drawChecked = await drawButton.getAttribute('aria-checked');
    expect(drawChecked).toMatch(/true|false/);

    const selectChecked = await selectButton.getAttribute('aria-checked');
    expect(selectChecked).toMatch(/true|false/);

    const eraserChecked = await eraserButton.getAttribute('aria-checked');
    expect(eraserChecked).toMatch(/true|false/);
  });

  test('property panel has no accessibility violations', async ({ page }) => {
    // Check property panel exists
    const panel = page.locator('[role="complementary"]');
    await expect(panel).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="complementary"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Property panel violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test('property panel toggle button has proper ARIA attributes', async ({ page }) => {
    const toggleButton = page.locator('button[aria-expanded]').first();
    await expect(toggleButton).toBeVisible();

    // Check aria-expanded
    const expanded = await toggleButton.getAttribute('aria-expanded');
    expect(expanded).toMatch(/true|false/);

    // Check aria-controls
    const controls = await toggleButton.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
  });

  test('header navigation has accessibility support', async ({ page }) => {
    const nav = page.locator('nav[aria-label]');
    await expect(nav).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('nav')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('import dialog has no accessibility violations', async ({ page }) => {
    // Open import dialog
    const openButton = page.getByRole('button', { name: /開く/ });
    await openButton.click();

    // Wait for dialog to appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Dialog violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test('dialog has proper ARIA attributes', async ({ page }) => {
    // Open import dialog
    const openButton = page.getByRole('button', { name: /開く/ });
    await openButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Check aria-modal
    const modal = await dialog.getAttribute('aria-modal');
    expect(modal).toBe('true');

    // Check aria-labelledby
    const labelledBy = await dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();

    // Check that the referenced element exists and has content
    if (labelledBy) {
      const titleElement = page.locator(`#${labelledBy}`);
      await expect(titleElement).toBeVisible();
    }
  });

  test('color contrast meets WCAG AA requirements', async ({ page }) => {
    // Use specific color-contrast rule with AA level (4.5:1 ratio)
    // Note: 'cat.color' includes AAA (7:1 ratio) which is stricter
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Color contrast violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test('images have alternative text', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withRules(['image-alt'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('form elements have labels', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withRules(['label', 'label-title-only'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Label violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results.violations).toEqual([]);
  });

  test('canvas has proper role and label', async ({ page }) => {
    // Check main canvas container has application role
    const mainArea = page.locator('[role="application"]');
    await expect(mainArea).toBeVisible();

    // Check aria-label exists
    const label = await mainArea.getAttribute('aria-label');
    expect(label).toBeTruthy();
  });

  test('buttons have accessible names', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withRules(['button-name'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('links have accessible names', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withRules(['link-name'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
