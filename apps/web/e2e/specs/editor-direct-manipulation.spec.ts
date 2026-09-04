import { test, expect, type Page } from '@playwright/test';

/**
 * Issue #42 — direct manipulation on the polygon document.
 *
 * The rest of the e2e suite still targets the retired cell UI and is being
 * migrated under #58; this spec is self-contained so it can be run alone:
 *
 *   pnpm --filter @gridder/web test:e2e:chromium -- --grep "@issue-42"
 */

const GRID_SIZE = 20; // gridSettingsStore.basePixelSize default

interface EditorSessionHandle {
  shapeCount: number;
  canUndo: boolean;
}

const readSession = (page: Page): Promise<EditorSessionHandle> =>
  page.evaluate(() => {
    const session = (
      window as unknown as {
        __GRIDDER_EDITOR_SESSION__: { shapeCount: number; canUndo: boolean };
      }
    ).__GRIDDER_EDITOR_SESSION__;
    return { shapeCount: session.shapeCount, canUndo: session.canUndo };
  });

const readSelectionCount = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const store = (
      window as unknown as {
        __GRIDDER_SELECTION_STORE__: {
          getState: () => { selectedIds: readonly string[] };
        };
      }
    ).__GRIDDER_SELECTION_STORE__;
    return store.getState().selectedIds.length;
  });

test.describe('@issue-42 direct manipulation', () => {
  test.beforeEach(async ({ page }) => {
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
          (window as unknown as { __GRIDDER_EDITOR_SESSION__?: unknown })
            .__GRIDDER_EDITOR_SESSION__
        ),
      undefined,
      { timeout: 30000 }
    );
  });

  test('drag on blank canvas creates a shape, selects it, and the creation can be undone', async ({
    page,
  }) => {
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error('canvas has no bounding box');
    }

    await expect.poll(async () => (await readSession(page)).shapeCount).toBe(0);

    // Blank left-drag: grid vertex (2,2) -> (7,6).
    await page.mouse.move(box.x + 2 * GRID_SIZE, box.y + 2 * GRID_SIZE);
    await page.mouse.down();
    await page.mouse.move(box.x + 7 * GRID_SIZE, box.y + 6 * GRID_SIZE, { steps: 12 });
    await page.mouse.up();

    // One shape now exists and is selected.
    await expect.poll(async () => (await readSession(page)).shapeCount).toBe(1);
    await expect.poll(() => readSelectionCount(page)).toBe(1);
    await expect.poll(async () => (await readSession(page)).canUndo).toBe(true);

    // Undo removes it.
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await readSession(page)).shapeCount).toBe(0);

    // Redo brings it back.
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(async () => (await readSession(page)).shapeCount).toBe(1);
  });

  test('clicking blank space clears the selection', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error('canvas has no bounding box');
    }

    await page.mouse.move(box.x + 2 * GRID_SIZE, box.y + 2 * GRID_SIZE);
    await page.mouse.down();
    await page.mouse.move(box.x + 7 * GRID_SIZE, box.y + 6 * GRID_SIZE, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => readSelectionCount(page)).toBe(1);

    // Click far away on empty canvas.
    await page.mouse.click(box.x + 20 * GRID_SIZE, box.y + 18 * GRID_SIZE);
    await expect.poll(() => readSelectionCount(page)).toBe(0);
  });
});
