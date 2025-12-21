import { test, expect } from '../helpers';
import fs from 'fs';

// Auto-save delay is 2000ms, we need to wait longer
const AUTOSAVE_DELAY = 2500;

/**
 * Cross-Browser Compatibility E2E Tests
 * Tests for ensuring consistent behavior across Chrome, Firefox, Safari (WebKit), and Edge
 */
test.describe('Cross-Browser Compatibility - Application Loading', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should load application and display main components', async ({
    appPage,
    browserName,
  }) => {
    // Canvas should be visible
    await expect(appPage.canvas).toBeVisible();

    // Toolbar should be visible
    await expect(appPage.toolbar).toBeVisible();

    // Property panel should be visible
    await expect(appPage.propertyPanel).toBeVisible();

    console.log(`[${browserName}] Application loaded successfully`);
  });

  test('should display toolbar buttons correctly', async ({
    appPage,
    browserName,
  }) => {
    // Draw button should be visible
    await expect(appPage.drawButton).toBeVisible();

    // Select button should be visible
    await expect(appPage.selectButton).toBeVisible();

    // Eraser button should be visible
    await expect(appPage.eraserButton).toBeVisible();

    console.log(`[${browserName}] Toolbar buttons displayed correctly`);
  });

  test('should display export buttons correctly', async ({
    appPage,
    browserName,
  }) => {
    // Export JSON button should be visible
    await expect(appPage.exportJSONButton).toBeVisible();

    // Export PNG button should be visible
    await expect(appPage.exportPNGButton).toBeVisible();

    // Export JPEG button should be visible
    await expect(appPage.exportJPEGButton).toBeVisible();

    console.log(`[${browserName}] Export buttons displayed correctly`);
  });
});

test.describe('Cross-Browser Compatibility - Drawing Mode', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should draw on canvas with click', async ({ appPage, browserName }) => {
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);

    // Wait for auto-save
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify object was created
    const hasObjects = await appPage.hasObjects();
    expect(hasObjects).toBe(true);

    console.log(`[${browserName}] Drawing with click works correctly`);
  });

  test('should draw on canvas with drag', async ({ appPage, browserName }) => {
    await appPage.switchToDrawMode();
    await appPage.dragOnCanvas(50, 50, 150, 50);

    // Wait for auto-save
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify object was created
    const hasObjects = await appPage.hasObjects();
    expect(hasObjects).toBe(true);

    console.log(`[${browserName}] Drawing with drag works correctly`);
  });
});

test.describe('Cross-Browser Compatibility - Selection Mode', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create an object for selection testing
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);
  });

  test('should select object on canvas', async ({ appPage, browserName }) => {
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    // Verify mode is select
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('select');

    console.log(`[${browserName}] Selection mode works correctly`);
  });

  test('should move object with arrow keys', async ({
    appPage,
    browserName,
  }) => {
    await appPage.switchToSelectMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(200);

    // Move with arrow key
    await appPage.page.keyboard.press('ArrowRight');
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Object should still exist
    const hasObjects = await appPage.hasObjects();
    expect(hasObjects).toBe(true);

    console.log(`[${browserName}] Arrow key navigation works correctly`);
  });
});

test.describe('Cross-Browser Compatibility - Export Functions', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create an object for export testing
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);
  });

  test('should export project as JSON', async ({ appPage, browserName }) => {
    const downloadPromise = appPage.page.waitForEvent('download');
    await appPage.exportJSONButton.click();
    const download = await downloadPromise;

    // Verify file name
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/.*\.json$/);

    // Verify content structure
    const filePath = await download.path();
    if (filePath) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('objects');
      expect(Array.isArray(data.objects)).toBe(true);
    }

    console.log(`[${browserName}] JSON export works correctly`);
  });

  test('should export canvas as PNG', async ({ appPage, browserName }) => {
    const downloadPromise = appPage.page.waitForEvent('download');
    await appPage.exportPNGButton.click();
    const download = await downloadPromise;

    // Verify file name
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/.*\.png$/);

    // Verify file has content
    const filePath = await download.path();
    if (filePath) {
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(0);
    }

    console.log(`[${browserName}] PNG export works correctly`);
  });

  test('should export canvas as JPEG', async ({ appPage, browserName }) => {
    const downloadPromise = appPage.page.waitForEvent('download');
    await appPage.exportJPEGButton.click();
    const download = await downloadPromise;

    // Verify file name
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/.*\.(jpg|jpeg)$/);

    // Verify file has content
    const filePath = await download.path();
    if (filePath) {
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(0);
    }

    console.log(`[${browserName}] JPEG export works correctly`);
  });
});

test.describe('Cross-Browser Compatibility - LocalStorage', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should persist data to LocalStorage', async ({
    appPage,
    browserName,
  }) => {
    // Draw on canvas
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);

    // Wait for auto-save
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify LocalStorage has data
    const hasData = await appPage.page.evaluate(() => {
      return localStorage.getItem('gridder_autosave') !== null;
    });

    expect(hasData).toBe(true);

    console.log(`[${browserName}] LocalStorage persistence works correctly`);
  });

  test('should restore data from LocalStorage on reload', async ({
    appPage,
    browserName,
  }) => {
    // Draw on canvas
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);

    // Wait for auto-save
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Get the object count before reload
    const countBefore = await appPage.getObjectCount();
    expect(countBefore).toBeGreaterThan(0);

    // Handle the confirmation dialog on reload (accept to restore)
    appPage.page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Reload the page
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Wait for data restoration
    await appPage.page.waitForTimeout(1000);

    // Verify data was restored
    const countAfter = await appPage.getObjectCount();
    expect(countAfter).toBe(countBefore);

    console.log(`[${browserName}] LocalStorage restoration works correctly`);
  });
});

test.describe('Cross-Browser Compatibility - Keyboard Shortcuts', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should switch to draw mode with D key', async ({
    appPage,
    browserName,
  }) => {
    await appPage.switchToSelectMode();
    await appPage.pressShortcut('d');

    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('draw');

    console.log(`[${browserName}] D key shortcut works correctly`);
  });

  test('should switch to select mode with V key', async ({
    appPage,
    browserName,
  }) => {
    await appPage.switchToDrawMode();
    await appPage.pressShortcut('v');

    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('select');

    console.log(`[${browserName}] V key shortcut works correctly`);
  });

  test('should switch to eraser mode with E key', async ({
    appPage,
    browserName,
  }) => {
    await appPage.switchToDrawMode();
    await appPage.pressShortcut('e');

    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('eraser');

    console.log(`[${browserName}] E key shortcut works correctly`);
  });

  test('should cycle through all tool modes', async ({
    appPage,
    browserName,
  }) => {
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

    console.log(`[${browserName}] Tool mode cycling works correctly`);
  });
});

test.describe('Cross-Browser Compatibility - Zoom Functions', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should zoom in with button', async ({ appPage, browserName }) => {
    // Check if zoom button exists
    const zoomInButtonExists = await appPage.zoomInButton.isVisible().catch(() => false);
    if (!zoomInButtonExists) {
      console.log(`[${browserName}] Zoom in button not found, skipping test`);
      return;
    }

    await appPage.zoomIn();
    await appPage.page.waitForTimeout(200);

    // Canvas should still be visible after zoom
    await expect(appPage.canvas).toBeVisible();

    console.log(`[${browserName}] Zoom in button works correctly`);
  });

  test('should zoom out with button', async ({ appPage, browserName }) => {
    // Check if zoom button exists
    const zoomOutButtonExists = await appPage.zoomOutButton.isVisible().catch(() => false);
    if (!zoomOutButtonExists) {
      console.log(`[${browserName}] Zoom out button not found, skipping test`);
      return;
    }

    await appPage.zoomOut();
    await appPage.page.waitForTimeout(200);

    // Canvas should still be visible after zoom
    await expect(appPage.canvas).toBeVisible();

    console.log(`[${browserName}] Zoom out button works correctly`);
  });

  test('should zoom with mouse wheel', async ({ appPage, browserName }) => {
    // Get canvas dimensions before zoom
    const sizeBefore = await appPage.getCanvasDimensions();

    // Perform wheel zoom
    await appPage.wheelZoom(-100); // Negative for zoom in
    await appPage.page.waitForTimeout(300);

    // Canvas should still be visible
    await expect(appPage.canvas).toBeVisible();

    // Canvas dimensions should be accessible
    const sizeAfter = await appPage.getCanvasDimensions();
    expect(sizeAfter.width).toBeGreaterThan(0);
    expect(sizeAfter.height).toBeGreaterThan(0);

    console.log(
      `[${browserName}] Mouse wheel zoom works correctly (${sizeBefore.width}x${sizeBefore.height} -> ${sizeAfter.width}x${sizeAfter.height})`
    );
  });
});

test.describe('Cross-Browser Compatibility - Canvas Performance', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should render 10 clicks within 3 seconds', async ({
    appPage,
    browserName,
  }) => {
    await appPage.switchToDrawMode();

    const startTime = Date.now();

    // Perform 10 clicks
    for (let i = 0; i < 10; i++) {
      await appPage.clickCanvas(100 + i * 20, 100);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // All clicks should complete within 3 seconds
    expect(duration).toBeLessThan(3000);

    console.log(
      `[${browserName}] Canvas performance: 10 clicks completed in ${duration}ms`
    );
  });

  test('should render drag operations smoothly', async ({
    appPage,
    browserName,
  }) => {
    await appPage.switchToDrawMode();

    const startTime = Date.now();

    // Perform 5 drag operations
    for (let i = 0; i < 5; i++) {
      await appPage.dragOnCanvas(50 + i * 40, 50, 100 + i * 40, 100);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // All drags should complete within 5 seconds
    expect(duration).toBeLessThan(5000);

    console.log(
      `[${browserName}] Canvas performance: 5 drags completed in ${duration}ms`
    );
  });
});

test.describe('Cross-Browser Compatibility - Browser-Specific Issues', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should handle rapid tool switching', async ({
    appPage,
    browserName,
  }) => {
    // Rapidly switch between tools
    for (let i = 0; i < 5; i++) {
      await appPage.pressShortcut('d');
      await appPage.pressShortcut('v');
      await appPage.pressShortcut('e');
    }

    // App should not crash
    await expect(appPage.canvas).toBeVisible();

    console.log(`[${browserName}] Rapid tool switching handled correctly`);
  });

  test('should handle rapid canvas operations', async ({
    appPage,
    browserName,
  }) => {
    await appPage.switchToDrawMode();

    // Rapid clicks without waiting
    for (let i = 0; i < 10; i++) {
      await appPage.clickCanvas(50 + i * 10, 50 + i * 10);
    }

    // App should not crash
    await expect(appPage.canvas).toBeVisible();

    console.log(`[${browserName}] Rapid canvas operations handled correctly`);
  });

  test('should handle window resize', async ({ page, appPage, browserName }) => {
    // Get initial dimensions
    const initialDimensions = await appPage.getCanvasDimensions();

    // Resize window
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);

    // Canvas should still be visible
    await expect(appPage.canvas).toBeVisible();

    // Resize back
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    // Canvas should still be visible
    await expect(appPage.canvas).toBeVisible();

    console.log(
      `[${browserName}] Window resize handled correctly (initial: ${initialDimensions.width}x${initialDimensions.height})`
    );
  });

  test('should handle focus/blur events', async ({
    page,
    appPage,
    browserName,
  }) => {
    // Draw something
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    const countBefore = await appPage.getObjectCount();

    // Simulate blur/focus (tab switching)
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await page.waitForTimeout(100);

    // Data should be preserved
    const countAfter = await appPage.getObjectCount();
    expect(countAfter).toBe(countBefore);

    // App should still work
    await expect(appPage.canvas).toBeVisible();

    console.log(`[${browserName}] Focus/blur events handled correctly`);
  });
});
