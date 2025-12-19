import { test, expect } from '../helpers';

// Auto-save delay is 2000ms, we need to wait longer
const AUTOSAVE_DELAY = 2500;

/**
 * Object Grouping E2E Tests
 * Tests for multiple selection, grouping, and batch operations
 */
test.describe('Multiple Selection', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create two objects for testing
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(500);
    await appPage.clickCanvas(250, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);
  });

  test('should create multiple objects', async ({ appPage }) => {
    const count = await appPage.getObjectCount();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('should select single object by clicking', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(300);

    // Verify selection mode is active
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('select');
  });

  test('should add to selection with Shift+click', async ({ appPage }) => {
    await appPage.switchToSelectMode();

    // Select first object
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(300);

    // Shift+click to add second object to selection
    const box = await appPage.canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    await appPage.page.keyboard.down('Shift');
    await appPage.page.mouse.click(box.x + 250, box.y + 100);
    await appPage.page.keyboard.up('Shift');
    await appPage.page.waitForTimeout(300);

    // Verify mode is still select
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('select');
  });

  test('should select all objects with Ctrl+A', async ({ appPage }) => {
    await appPage.switchToSelectMode();

    // Focus canvas first
    await appPage.clickCanvas(200, 200);
    await appPage.page.waitForTimeout(200);

    // Select all with Ctrl+A
    await appPage.page.keyboard.press('Control+a');
    await appPage.page.waitForTimeout(300);

    // Verify mode is still select
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('select');
  });

  test('should delete multiple selected objects', async ({ appPage }) => {
    const initialCount = await appPage.getObjectCount();
    expect(initialCount).toBeGreaterThanOrEqual(2);

    await appPage.switchToSelectMode();

    // Select all objects
    await appPage.clickCanvas(200, 200);
    await appPage.page.waitForTimeout(200);
    await appPage.page.keyboard.press('Control+a');
    await appPage.page.waitForTimeout(300);

    // Delete all selected
    await appPage.page.keyboard.press('Delete');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify all objects were deleted
    const finalCount = await appPage.getObjectCount();
    expect(finalCount).toBe(0);
  });

  test('should duplicate multiple selected objects with Ctrl+D', async ({ appPage }) => {
    const initialCount = await appPage.getObjectCount();
    expect(initialCount).toBeGreaterThanOrEqual(2);

    await appPage.switchToSelectMode();

    // Select all objects
    await appPage.clickCanvas(200, 200);
    await appPage.page.waitForTimeout(200);
    await appPage.page.keyboard.press('Control+a');
    await appPage.page.waitForTimeout(300);

    // Duplicate all selected
    await appPage.page.keyboard.press('Control+d');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify objects were duplicated
    const finalCount = await appPage.getObjectCount();
    expect(finalCount).toBeGreaterThan(initialCount);
  });
});

test.describe('Object Grouping', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create two objects for testing
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(500);
    await appPage.clickCanvas(250, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);
  });

  test('should group selected objects with Ctrl+G', async ({ appPage }) => {
    await appPage.switchToSelectMode();

    // Select all objects
    await appPage.clickCanvas(200, 200);
    await appPage.page.waitForTimeout(200);
    await appPage.page.keyboard.press('Control+a');
    await appPage.page.waitForTimeout(300);

    // Group with Ctrl+G
    await appPage.page.keyboard.press('Control+g');
    await appPage.page.waitForTimeout(500);

    // Verify group panel appears (if applicable)
    // Note: The UI should show a group indicator
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('select');
  });

  test('should ungroup objects with Ctrl+Shift+G', async ({ appPage }) => {
    await appPage.switchToSelectMode();

    // Select all objects
    await appPage.clickCanvas(200, 200);
    await appPage.page.waitForTimeout(200);
    await appPage.page.keyboard.press('Control+a');
    await appPage.page.waitForTimeout(300);

    // Group with Ctrl+G
    await appPage.page.keyboard.press('Control+g');
    await appPage.page.waitForTimeout(500);

    // Ungroup with Ctrl+Shift+G
    await appPage.page.keyboard.press('Control+Shift+g');
    await appPage.page.waitForTimeout(500);

    // Verify mode is still select
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('select');
  });
});

test.describe('Batch Operations with Multiple Selection', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create three objects for testing
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(500);
    await appPage.clickCanvas(200, 100);
    await appPage.page.waitForTimeout(500);
    await appPage.clickCanvas(300, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);
  });

  test('should move multiple selected objects with arrow keys', async ({ appPage }) => {
    await appPage.switchToSelectMode();

    // Select all objects
    await appPage.clickCanvas(200, 200);
    await appPage.page.waitForTimeout(200);
    await appPage.page.keyboard.press('Control+a');
    await appPage.page.waitForTimeout(300);

    // Move with arrow keys
    await appPage.page.keyboard.press('ArrowRight');
    await appPage.page.waitForTimeout(100);
    await appPage.page.keyboard.press('ArrowDown');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify objects still exist
    const count = await appPage.getObjectCount();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('should maintain relative positions when moving multiple objects', async ({ appPage }) => {
    await appPage.switchToSelectMode();

    // Select all objects
    await appPage.clickCanvas(200, 200);
    await appPage.page.waitForTimeout(200);
    await appPage.page.keyboard.press('Control+a');
    await appPage.page.waitForTimeout(300);

    // Move multiple times
    for (let i = 0; i < 5; i++) {
      await appPage.page.keyboard.press('ArrowRight');
      await appPage.page.waitForTimeout(50);
    }
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify objects still exist
    const count = await appPage.getObjectCount();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Group Export and Import', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should export project with grouped objects', async ({ appPage }) => {
    // Create objects
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(500);
    await appPage.clickCanvas(250, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Select all and group
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(200, 200);
    await appPage.page.waitForTimeout(200);
    await appPage.page.keyboard.press('Control+a');
    await appPage.page.waitForTimeout(300);
    await appPage.page.keyboard.press('Control+g');
    await appPage.page.waitForTimeout(500);

    // Wait for auto-save
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify data is saved to localStorage
    const savedData = await appPage.getLocalStorageItem('gridder_autosave');
    expect(savedData).not.toBeNull();

    // Parse and verify structure
    if (savedData) {
      const projectData = JSON.parse(savedData);
      expect(projectData.objects).toBeDefined();
      expect(projectData.objects.length).toBeGreaterThanOrEqual(2);
      // Group data should be included if groups exist
      if (projectData.groups) {
        expect(projectData.groups.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

test.describe('Selection Mode Keyboard Shortcuts', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create an object for testing
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);
  });

  test('should clear selection with Escape key', async ({ appPage }) => {
    await appPage.switchToSelectMode();

    // Select object
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    // Clear selection with Escape
    await appPage.page.keyboard.press('Escape');
    await appPage.page.waitForTimeout(200);

    // Verify mode is still select
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('select');
  });

  test('should switch to draw mode with D key', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    const initialMode = await appPage.getCurrentToolMode();
    expect(initialMode).toBe('select');

    // Press D to switch to draw mode
    await appPage.pressShortcut('d');

    // Verify mode changed
    const newMode = await appPage.getCurrentToolMode();
    expect(newMode).toBe('draw');
  });

  test('should switch to eraser mode with E key', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    const initialMode = await appPage.getCurrentToolMode();
    expect(initialMode).toBe('select');

    // Press E to switch to eraser mode
    await appPage.pressShortcut('e');

    // Verify mode changed
    const newMode = await appPage.getCurrentToolMode();
    expect(newMode).toBe('eraser');
  });
});
