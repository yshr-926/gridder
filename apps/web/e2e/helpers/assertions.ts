import { type Page, expect } from '@playwright/test';

/**
 * Custom assertion helpers for Gridder E2E tests (issue #58, polygon document).
 */

/** Assert that a modal/dialog is visible, optionally matching its text. */
export const expectModalVisible = async (page: Page, titlePattern?: RegExp): Promise<void> => {
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  if (titlePattern) {
    await expect(modal).toContainText(titlePattern);
  }
};

/** Assert that no modal/dialog is visible. */
export const expectNoModal = async (page: Page): Promise<void> => {
  await expect(page.getByRole('dialog')).toHaveCount(0);
};

/**
 * Run `action` and assert it produced no unexpected console errors. Filters
 * out known-benign noise (favicon 404s, ResizeObserver loop warnings).
 */
export const expectNoConsoleErrors = async (
  page: Page,
  action: () => Promise<void>
): Promise<void> => {
  const errors: string[] = [];
  const handleConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  };
  page.on('console', handleConsole);
  try {
    await action();
  } finally {
    page.off('console', handleConsole);
  }
  const unexpected = errors.filter(
    (err) => !err.includes('favicon') && !err.includes('ResizeObserver')
  );
  expect(unexpected).toHaveLength(0);
};
