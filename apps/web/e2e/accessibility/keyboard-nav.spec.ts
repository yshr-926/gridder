import { test, expect } from '../helpers';

/**
 * Keyboard navigation checks for the polygon-document UI (issue #58).
 * There is no tool-mode radiogroup in this UI (ui-principles §2: every
 * gesture is direct manipulation) — keyboard coverage here is Tab order,
 * the file menu, and its Escape-to-close behaviour.
 */
test.describe('Keyboard Navigation', () => {
  test('Tab key reaches multiple interactive elements', async ({ page }) => {
    let focusedCount = 0;
    const maxTabs = 20;

    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');
      const tag = await page.evaluate(() => document.activeElement?.tagName ?? null);
      if (tag !== null && tag !== 'BODY') {
        focusedCount++;
      }
    }

    expect(focusedCount).toBeGreaterThan(3);
  });

  test('Enter key opens the file menu when focused', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'ファイル' });
    await trigger.focus();
    await expect(trigger).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).not.toBeVisible();
  });

  test('focus indicator is visible on the file menu trigger', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'ファイル' });
    await trigger.focus();

    const focusStyle = await trigger.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return { outline: styles.outline, boxShadow: styles.boxShadow };
    });

    const hasFocusIndicator =
      (focusStyle.outline !== 'none' && focusStyle.outline !== '') ||
      focusStyle.boxShadow !== 'none';
    expect(hasFocusIndicator).toBe(true);
  });

  test('all enabled header buttons are keyboard-focusable', async ({ page }) => {
    const header = page.locator('header');
    const headerButtons = header.getByRole('button');
    const buttonCount = await headerButtons.count();
    expect(buttonCount).toBeGreaterThan(0);

    for (let i = 0; i < buttonCount; i++) {
      const button = headerButtons.nth(i);
      // Undo/redo start disabled (nothing to undo/redo yet, spec §11) — a
      // disabled button is correctly unfocusable, not an accessibility gap.
      if (await button.isDisabled()) {
        continue;
      }
      await button.focus();
      await expect(button).toBeFocused();
    }
  });

  test('Escape closes the file menu without navigating away', async ({ page }) => {
    await page.getByRole('button', { name: 'ファイル' }).click();
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).not.toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible();
  });
});
