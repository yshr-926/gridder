import { test as base, expect } from '@playwright/test';
import { CanvasHelper } from './canvas';

/**
 * Custom test fixtures for Gridder E2E tests (issue #58, polygon document).
 */
interface TestFixtures {
  /** CanvasHelper instance for grid-vertex <-> screen conversions. */
  canvasHelper: CanvasHelper;
}

/**
 * Extended test with custom fixtures. Every test starts from a fresh,
 * empty sketch: `localStorage` is cleared (drops the crash-recovery draft
 * and any dirty flag) before the app boots, then the page reloads so the
 * app reads that clean state from its very first render.
 */
export const test = base.extend<TestFixtures>({
  page: async ({ page }, use) => {
    // Auto-dismiss the "discard unsaved changes?" / crash-recovery-draft
    // confirm dialogs (spec §9) so a stray one never hangs a test.
    page.on('dialog', (dialog) => {
      void dialog.dismiss();
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(
      () =>
        Boolean(
          (window as unknown as { __GRIDDER_EDITOR_SESSION__?: unknown }).__GRIDDER_EDITOR_SESSION__
        ),
      undefined,
      { timeout: 30000 }
    );
    await use(page);
  },

  canvasHelper: async ({ page }, use) => {
    const helper = new CanvasHelper(page);
    await use(helper);
  },
});

export { expect };

/** Base grid size in pixels at zoom 1 (`gridSettingsStore.basePixelSize`). */
export const GRID_SIZE = 20;
