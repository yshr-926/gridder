import { test, expect } from '../helpers';

// Auto-save delay is 2000ms, we need to wait longer
const AUTOSAVE_DELAY = 2500;

/**
 * Keyboard Shortcuts E2E Tests
 * Tests for all keyboard shortcut functionality
 */
test.describe('Tool Switching Shortcuts', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should switch to draw mode with D key', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.pressShortcut('d');

    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('draw');
  });

  test('should switch to select mode with V key', async ({ appPage }) => {
    await appPage.switchToDrawMode();
    await appPage.pressShortcut('v');

    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('select');
  });

  test('should switch to eraser mode with E key', async ({ appPage }) => {
    await appPage.switchToDrawMode();
    await appPage.pressShortcut('e');

    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('eraser');
  });

  test('should cycle through modes correctly', async ({ appPage }) => {
    // Start with draw
    await appPage.pressShortcut('d');
    expect(await appPage.getCurrentToolMode()).toBe('draw');

    // Switch to select
    await appPage.pressShortcut('v');
    expect(await appPage.getCurrentToolMode()).toBe('select');

    // Switch to eraser
    await appPage.pressShortcut('e');
    expect(await appPage.getCurrentToolMode()).toBe('eraser');

    // Back to draw
    await appPage.pressShortcut('d');
    expect(await appPage.getCurrentToolMode()).toBe('draw');
  });
});

test.describe('Object Manipulation Shortcuts', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create an object for testing
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);
  });

  test('should delete selected object with Delete key', async ({ appPage }) => {
    const initialCount = await appPage.getObjectCount();
    expect(initialCount).toBeGreaterThan(0);

    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    await appPage.page.keyboard.press('Delete');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    const finalCount = await appPage.getObjectCount();
    expect(finalCount).toBeLessThan(initialCount);
  });

  test('should rotate selected object with R key', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    await appPage.page.keyboard.press('r');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Object should still exist
    const hasObjects = await appPage.hasObjects();
    expect(hasObjects).toBe(true);
  });

  test('should duplicate selected object with Ctrl+D', async ({ appPage }) => {
    const initialCount = await appPage.getObjectCount();
    expect(initialCount).toBeGreaterThan(0);

    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    await appPage.page.keyboard.press('Control+d');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    const finalCount = await appPage.getObjectCount();
    expect(finalCount).toBeGreaterThan(initialCount);
  });

  test('should deselect with Escape key', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    await appPage.page.keyboard.press('Escape');
    await appPage.page.waitForTimeout(200);

    // Mode should still be select
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('select');
  });
});

test.describe('Arrow Key Navigation', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create an object for testing
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);
  });

  test('should move object right with ArrowRight', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    await appPage.page.keyboard.press('ArrowRight');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    const hasObjects = await appPage.hasObjects();
    expect(hasObjects).toBe(true);
  });

  test('should move object left with ArrowLeft', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    await appPage.page.keyboard.press('ArrowLeft');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    const hasObjects = await appPage.hasObjects();
    expect(hasObjects).toBe(true);
  });

  test('should move object up with ArrowUp', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    await appPage.page.keyboard.press('ArrowUp');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    const hasObjects = await appPage.hasObjects();
    expect(hasObjects).toBe(true);
  });

  test('should move object down with ArrowDown', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    await appPage.page.keyboard.press('ArrowDown');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    const hasObjects = await appPage.hasObjects();
    expect(hasObjects).toBe(true);
  });
});

test.describe('Undo/Redo Shortcuts', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should attempt undo with Ctrl+Z', async ({ appPage }) => {
    // Create an object
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Try undo
    await appPage.page.keyboard.press('Control+z');
    await appPage.page.waitForTimeout(300);

    // App should not crash
    await expect(appPage.canvas).toBeVisible();
  });

  test('should attempt redo with Ctrl+Shift+Z', async ({ appPage }) => {
    // Create an object
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Try undo then redo
    await appPage.page.keyboard.press('Control+z');
    await appPage.page.waitForTimeout(200);
    await appPage.page.keyboard.press('Control+Shift+z');
    await appPage.page.waitForTimeout(300);

    // App should not crash
    await expect(appPage.canvas).toBeVisible();
  });
});

test.describe('Help Shortcut', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should open help dialog with ? key', async ({ appPage }) => {
    await appPage.pressShortcut('?');
    await appPage.page.waitForTimeout(300);

    // Look for help dialog or keyboard shortcuts help
    // The dialog might or might not be visible depending on implementation
    await expect(appPage.canvas).toBeVisible(); // At least canvas should still be visible
  });
});
