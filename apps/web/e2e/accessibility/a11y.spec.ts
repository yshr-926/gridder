import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../helpers';

/**
 * Accessibility checks for the polygon-document UI (issue #58, spec §12 /
 * ui-principles §7): the compact top bar and the context inspector are the
 * only persistent chrome — everything else is direct canvas manipulation, so
 * axe coverage focuses on those two surfaces plus the app shell.
 */
test.describe('Accessibility', () => {
  test('initial page load has no WCAG AA violations', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('top bar has no accessibility violations', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('header')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('top bar actions have accessible names', async ({ page }) => {
    const nav = page.locator('nav[aria-label]');
    await expect(nav).toBeVisible();

    await expect(page.getByRole('button', { name: 'ファイル' })).toBeVisible();
    await expect(page.getByRole('button', { name: '元に戻す' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'やり直す' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ポリゴンを追加' })).toBeVisible();
    await expect(page.getByRole('button', { name: '内容に合わせる' })).toBeVisible();
    await expect(page.getByRole('button', { name: '共有' })).toBeVisible();
    await expect(page.getByRole('button', { name: '設定' })).toBeVisible();
  });

  test('canvas application region has proper role and label', async ({ page }) => {
    const mainArea = page.locator('[role="application"]');
    await expect(mainArea).toBeVisible();
    await expect(mainArea).toHaveAttribute('aria-label', /.+/);
  });

  test('context inspector has no accessibility violations once a shape is selected', async ({
    page,
    canvasHelper,
  }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    const inspector = page.locator('aside[aria-label="図形インスペクター"]');
    await expect(inspector).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('aside[aria-label="図形インスペクター"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('inspector is absent with no selection', async ({ page }) => {
    const inspector = page.locator('aside[aria-label="図形インスペクター"]');
    await expect(inspector).toHaveCount(0);
  });

  test('file menu has proper ARIA attributes and opens as a menu', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'ファイル' });
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await trigger.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: '新規スケッチ' })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('color contrast meets WCAG AA requirements', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(results.violations).toEqual([]);
  });

  test('buttons have accessible names', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    const results = await new AxeBuilder({ page }).withRules(['button-name']).analyze();
    expect(results.violations).toEqual([]);
  });

  test('form elements have labels', async ({ page, canvasHelper }) => {
    await canvasHelper.dragGrid(2, 2, 7, 6);
    const results = await new AxeBuilder({ page })
      .withRules(['label', 'label-title-only'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
