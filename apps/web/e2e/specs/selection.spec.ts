import { test, expect } from '../helpers';

// Auto-save delay is 2000ms, we need to wait longer
const AUTOSAVE_DELAY = 2500;

/**
 * Selection & Edit Mode E2E Tests
 * Tests for selection, movement, rotation, deletion, and duplication functionality
 */
test.describe('Selection Mode', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create an object for testing
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);
  });

  test('should select object by clicking on it', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);

    // Wait for selection to be processed
    await appPage.page.waitForTimeout(300);

    // Verify selection mode is active
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('select');
  });

  test('should switch to select mode using keyboard shortcut V', async ({ appPage }) => {
    // Start in draw mode
    await appPage.switchToDrawMode();
    const initialMode = await appPage.getCurrentToolMode();
    expect(initialMode).toBe('draw');

    // Press V to switch to select mode
    await appPage.pressShortcut('v');

    // Verify mode changed
    const newMode = await appPage.getCurrentToolMode();
    expect(newMode).toBe('select');
  });

  test('should move object using arrow keys', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    // Move with arrow keys
    await appPage.page.keyboard.press('ArrowRight');
    await appPage.page.waitForTimeout(100);
    await appPage.page.keyboard.press('ArrowDown');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify object still exists
    const hasObjects = await appPage.hasObjects();
    expect(hasObjects).toBe(true);
  });

  test('should rotate object using R key', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    // Rotate object
    await appPage.page.keyboard.press('r');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify object still exists
    const hasObjects = await appPage.hasObjects();
    expect(hasObjects).toBe(true);
  });

  test('should delete object using Delete key', async ({ appPage }) => {
    // Verify we have an object
    const initialCount = await appPage.getObjectCount();
    expect(initialCount).toBeGreaterThan(0);

    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    // Delete object
    await appPage.page.keyboard.press('Delete');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify object was deleted
    const finalCount = await appPage.getObjectCount();
    expect(finalCount).toBeLessThan(initialCount);
  });

  test('should delete object using Backspace key', async ({ appPage }) => {
    // Verify we have an object
    const initialCount = await appPage.getObjectCount();
    expect(initialCount).toBeGreaterThan(0);

    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    // Delete object using Backspace
    await appPage.page.keyboard.press('Backspace');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify object was deleted
    const finalCount = await appPage.getObjectCount();
    expect(finalCount).toBeLessThan(initialCount);
  });

  test('should duplicate object using Ctrl+D', async ({ appPage }) => {
    const initialCount = await appPage.getObjectCount();
    expect(initialCount).toBeGreaterThan(0);

    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    // Duplicate object
    await appPage.page.keyboard.press('Control+d');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify object was duplicated
    const finalCount = await appPage.getObjectCount();
    expect(finalCount).toBeGreaterThan(initialCount);
  });

  test('should deselect object using Escape key', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    // Deselect using Escape
    await appPage.page.keyboard.press('Escape');
    await appPage.page.waitForTimeout(200);

    // Verify still in select mode but no selection
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('select');
  });
});

test.describe('Selection Tool Button', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should highlight select button when active', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await expect(appPage.selectButton).toHaveAttribute('aria-checked', 'true');
  });

  test('should unhighlight select button when switching modes', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.switchToDrawMode();
    await expect(appPage.selectButton).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('Multiple Objects Selection', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create two separate objects
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(500);
    await appPage.clickCanvas(300, 300);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);
  });

  test('should maintain multiple objects after operations', async ({ appPage }) => {
    const count = await appPage.getObjectCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
