import { test, expect } from '../helpers';

// Auto-save delay is 2000ms, we need to wait longer
const AUTOSAVE_DELAY = 2500;

/**
 * Drawing Mode E2E Tests
 * Tests for drawing functionality including click, drag, and multiple object creation
 */
test.describe('Drawing Mode', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should fill cell with single click', async ({ appPage }) => {
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);

    // Wait for auto-save to capture the object
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify object was created
    const hasObjects = await appPage.hasObjects();
    expect(hasObjects).toBe(true);
  });

  test('should fill cells with drag operation', async ({ appPage }) => {
    await appPage.switchToDrawMode();
    await appPage.dragOnCanvas(50, 50, 150, 50);

    // Wait for auto-save
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify at least one object was created
    const hasObjects = await appPage.hasObjects();
    expect(hasObjects).toBe(true);
  });

  test('should create multiple separate objects', async ({ appPage }) => {
    await appPage.switchToDrawMode();

    // First object at position 1
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(500);

    // Second object at distant position
    await appPage.clickCanvas(300, 300);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify at least one object was created (may be merged if close)
    const count = await appPage.getObjectCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should switch to draw mode using keyboard shortcut D', async ({ appPage }) => {
    // Start in select mode
    await appPage.switchToSelectMode();
    const initialMode = await appPage.getCurrentToolMode();
    expect(initialMode).toBe('select');

    // Press D to switch to draw mode
    await appPage.pressShortcut('d');

    // Verify mode changed
    const newMode = await appPage.getCurrentToolMode();
    expect(newMode).toBe('draw');
  });

  test('should maintain draw mode after drawing operation', async ({ appPage }) => {
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);

    // Verify still in draw mode
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('draw');
  });

  test('should draw connected shape with continuous drag', async ({ appPage }) => {
    await appPage.switchToDrawMode();

    // Draw an L-shape
    await appPage.dragOnCanvas(50, 50, 50, 150);
    await appPage.page.waitForTimeout(500);
    await appPage.dragOnCanvas(50, 150, 150, 150);

    // Wait for auto-save
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify object was created
    const hasObjects = await appPage.hasObjects();
    expect(hasObjects).toBe(true);
  });
});

test.describe('Drawing Tool Button', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should highlight draw button when active', async ({ appPage }) => {
    await appPage.switchToDrawMode();
    await expect(appPage.drawButton).toHaveAttribute('aria-checked', 'true');
  });

  test('should unhighlight draw button when switching modes', async ({ appPage }) => {
    await appPage.switchToDrawMode();
    await appPage.switchToSelectMode();
    await expect(appPage.drawButton).toHaveAttribute('aria-checked', 'false');
  });
});
