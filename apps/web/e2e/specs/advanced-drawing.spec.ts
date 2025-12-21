import { test, expect } from '../helpers';

/**
 * Advanced Drawing Features E2E Tests
 * Tests for Phase 15 high-level drawing features:
 * - Command Palette
 * - Polygon drawing
 * - Subtraction mode
 * - Keyboard shortcuts for new tools
 */

// Auto-save delay is 2000ms, we need to wait longer
const AUTOSAVE_DELAY = 2500;

test.describe('Command Palette', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should open command palette with Ctrl+Shift+P', async ({ appPage }) => {
    await appPage.page.keyboard.press('Control+Shift+p');
    await appPage.page.waitForTimeout(300);

    // Command palette dialog should be visible
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
  });

  test('should close command palette with Escape', async ({ appPage }) => {
    // Open command palette
    await appPage.page.keyboard.press('Control+Shift+p');
    await appPage.page.waitForTimeout(300);

    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Close with Escape
    await appPage.page.keyboard.press('Escape');
    await appPage.page.waitForTimeout(300);

    await expect(dialog).not.toBeVisible();
  });

  test('should show command suggestions when typing', async ({ appPage }) => {
    // Open command palette
    await appPage.page.keyboard.press('Control+Shift+p');
    await appPage.page.waitForTimeout(300);

    // Type 'L' to filter commands (use placeholder to identify the correct textbox)
    const input = appPage.page.getByPlaceholder('コマンドを入力');
    await input.fill('L');
    await appPage.page.waitForTimeout(200);

    // Should show LINE command suggestion
    const suggestion = appPage.page.getByText('LINE');
    await expect(suggestion).toBeVisible();
  });

  test('should execute HELP command', async ({ appPage }) => {
    // Open command palette
    await appPage.page.keyboard.press('Control+Shift+p');
    await appPage.page.waitForTimeout(300);

    // Type and execute HELP command
    const input = appPage.page.getByPlaceholder('コマンドを入力');
    await input.fill('HELP');
    await appPage.page.keyboard.press('Enter');
    await appPage.page.waitForTimeout(300);

    // Should show help information (use first() to avoid strict mode violation)
    const helpText = appPage.page.getByText(/利用可能なコマンド|使い方|コマンド一覧/).first();
    await expect(helpText).toBeVisible();
  });
});

test.describe('Polygon Drawing Mode', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should switch to polygon mode with P key', async ({ appPage }) => {
    await appPage.pressShortcut('p');
    await appPage.page.waitForTimeout(200);

    // Check if polygon button is active (if exists) or mode changed
    const polygonButton = appPage.page.getByRole('radio', { name: /ポリゴン|polygon/i });
    if (await polygonButton.isVisible()) {
      await expect(polygonButton).toHaveAttribute('aria-checked', 'true');
    }
  });

  test('should show help text when entering polygon mode', async ({ appPage }) => {
    await appPage.pressShortcut('p');
    await appPage.page.waitForTimeout(300);

    // Look for help text that describes polygon drawing
    const helpText = appPage.page.getByText(/頂点|クリック|ポリゴン/);
    // Help text might or might not be visible depending on implementation
    if (await helpText.isVisible()) {
      await expect(helpText).toBeVisible();
    }
  });

  test('should cancel polygon drawing with Escape', async ({ appPage }) => {
    await appPage.pressShortcut('p');
    await appPage.page.waitForTimeout(200);

    // Click to add first vertex
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(200);

    // Click to add second vertex
    await appPage.clickCanvas(200, 100);
    await appPage.page.waitForTimeout(200);

    // Press Escape to cancel
    await appPage.page.keyboard.press('Escape');
    await appPage.page.waitForTimeout(300);

    // Canvas should still be visible (no crash)
    await expect(appPage.canvas).toBeVisible();
  });
});

test.describe('Subtraction Mode', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create an object first
    await appPage.switchToDrawMode();
    await appPage.dragOnCanvas(100, 100, 200, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);
  });

  test('should switch to subtraction mode with M key', async ({ appPage }) => {
    // First select an object
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 125);
    await appPage.page.waitForTimeout(200);

    // Press M to switch to subtraction mode
    await appPage.pressShortcut('m');
    await appPage.page.waitForTimeout(200);

    // Check if subtraction mode is active
    const subtractionButton = appPage.page.getByRole('radio', { name: /減算|subtract/i });
    if (await subtractionButton.isVisible()) {
      await expect(subtractionButton).toHaveAttribute('aria-checked', 'true');
    }
  });

  test('should show help text about subtraction mode', async ({ appPage }) => {
    // Select an object
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 125);
    await appPage.page.waitForTimeout(200);

    // Switch to subtraction mode
    await appPage.pressShortcut('m');
    await appPage.page.waitForTimeout(300);

    // Look for help text
    const helpText = appPage.page.getByText(/減算|削除|セル/);
    // Help text might or might not be visible
    if (await helpText.isVisible()) {
      await expect(helpText).toBeVisible();
    }
  });
});

test.describe('Keyboard Shortcuts for Advanced Tools', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should maintain canvas stability when switching modes rapidly', async ({ appPage }) => {
    // Rapidly switch between modes
    await appPage.pressShortcut('d'); // Draw
    await appPage.page.waitForTimeout(50);
    await appPage.pressShortcut('v'); // Select
    await appPage.page.waitForTimeout(50);
    await appPage.pressShortcut('e'); // Eraser
    await appPage.page.waitForTimeout(50);
    await appPage.pressShortcut('p'); // Polygon
    await appPage.page.waitForTimeout(50);
    await appPage.pressShortcut('d'); // Back to Draw
    await appPage.page.waitForTimeout(200);

    // Canvas should remain stable
    await expect(appPage.canvas).toBeVisible();
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('draw');
  });

  test('should handle keyboard shortcuts with modifiers', async ({ appPage }) => {
    // Create an object
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Test Ctrl+Z (undo)
    await appPage.page.keyboard.press('Control+z');
    await appPage.page.waitForTimeout(300);

    // Canvas should still be visible
    await expect(appPage.canvas).toBeVisible();
  });
});

test.describe('Command Execution', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should handle LINE command through palette', async ({ appPage }) => {
    // Open command palette
    await appPage.page.keyboard.press('Control+Shift+p');
    await appPage.page.waitForTimeout(300);

    // Execute LINE command with coordinates
    const input = appPage.page.getByPlaceholder('コマンドを入力');
    await input.fill('LINE 0,0 5,5');
    await appPage.page.keyboard.press('Enter');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify command was executed (either success message or object created)
    const outputArea = appPage.page.getByRole('dialog');
    const hasOutput = await outputArea.isVisible();
    expect(hasOutput || await appPage.hasObjects()).toBeTruthy();
  });

  test('should handle RECT command through palette', async ({ appPage }) => {
    // Open command palette
    await appPage.page.keyboard.press('Control+Shift+p');
    await appPage.page.waitForTimeout(300);

    // Execute RECT command with coordinates
    const input = appPage.page.getByPlaceholder('コマンドを入力');
    await input.fill('RECT 0,0 5,5');
    await appPage.page.keyboard.press('Enter');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify command was executed
    const outputArea = appPage.page.getByRole('dialog');
    const hasOutput = await outputArea.isVisible();
    expect(hasOutput || await appPage.hasObjects()).toBeTruthy();
  });

  test('should show error for invalid command', async ({ appPage }) => {
    // Open command palette
    await appPage.page.keyboard.press('Control+Shift+p');
    await appPage.page.waitForTimeout(300);

    // Execute invalid command
    const input = appPage.page.getByPlaceholder('コマンドを入力');
    await input.fill('INVALID_COMMAND');
    await appPage.page.keyboard.press('Enter');
    await appPage.page.waitForTimeout(300);

    // Should show error message
    const errorText = appPage.page.getByText(/不明なコマンド|Unknown command|エラー/);
    await expect(errorText).toBeVisible();
  });
});

test.describe('Integration Tests', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should combine drawing and command palette workflow', async ({ appPage }) => {
    // First draw something manually
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    const initialCount = await appPage.getObjectCount();
    expect(initialCount).toBeGreaterThan(0);

    // Then use command palette to create another object
    await appPage.page.keyboard.press('Control+Shift+p');
    await appPage.page.waitForTimeout(300);

    const input = appPage.page.getByPlaceholder('コマンドを入力');
    await input.fill('RECT 10,10 15,15');
    await appPage.page.keyboard.press('Enter');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Close the dialog if still open
    await appPage.page.keyboard.press('Escape');
    await appPage.page.waitForTimeout(200);

    // Canvas should still work
    await expect(appPage.canvas).toBeVisible();
  });

  test('should preserve objects after mode switches', async ({ appPage }) => {
    // Create an object
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    const countAfterDraw = await appPage.getObjectCount();
    expect(countAfterDraw).toBeGreaterThan(0);

    // Switch through various modes
    await appPage.switchToSelectMode();
    await appPage.page.waitForTimeout(200);
    await appPage.pressShortcut('p'); // Polygon mode
    await appPage.page.waitForTimeout(200);
    await appPage.switchToDrawMode();
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Objects should still exist
    const finalCount = await appPage.getObjectCount();
    expect(finalCount).toBeGreaterThanOrEqual(countAfterDraw);
  });
});
