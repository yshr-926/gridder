import { test, expect } from '../helpers';

/**
 * Visual Regression Tests for Gridder
 *
 * These tests capture screenshots of the application in various states
 * and compare them against baseline images to detect unintended visual changes.
 *
 * Tolerance settings:
 * - 0.01 (1%): Static UI components
 * - 0.02 (2%): Canvas-containing dynamic content
 */
test.describe('Visual Regression - Initial State', () => {
  test('initial application state', async ({ appPage }) => {
    // Wait for any animations to complete
    await appPage.page.waitForTimeout(500);

    await expect(appPage.page).toHaveScreenshot('initial-state.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('page layout structure', async ({ appPage }) => {
    // Capture the overall layout
    await expect(appPage.page).toHaveScreenshot('page-layout.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
});

test.describe('Visual Regression - Tool Modes', () => {
  test('draw mode selected', async ({ appPage }) => {
    await appPage.switchToDrawMode();
    await appPage.page.waitForTimeout(300);

    await expect(appPage.page).toHaveScreenshot('draw-mode.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('select mode selected', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    await appPage.page.waitForTimeout(300);

    await expect(appPage.page).toHaveScreenshot('select-mode.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('eraser mode selected', async ({ appPage }) => {
    await appPage.switchToEraserMode();
    await appPage.page.waitForTimeout(300);

    await expect(appPage.page).toHaveScreenshot('eraser-mode.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
});

test.describe('Visual Regression - UI Components', () => {
  test('toolbar component', async ({ appPage }) => {
    await expect(appPage.toolbar).toHaveScreenshot('toolbar.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('property panel component', async ({ appPage }) => {
    // Property panel might not exist in all layouts
    const propertyPanel = appPage.propertyPanel;
    const isVisible = await propertyPanel.isVisible().catch(() => false);

    if (isVisible) {
      await expect(propertyPanel).toHaveScreenshot('property-panel.png', {
        maxDiffPixelRatio: 0.01,
      });
    } else {
      // Take full page screenshot if property panel is not separate
      await expect(appPage.page).toHaveScreenshot('property-panel-area.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    }
  });

  test('status bar component', async ({ appPage }) => {
    const statusBar = appPage.statusBar;
    const isVisible = await statusBar.isVisible().catch(() => false);

    if (isVisible) {
      await expect(statusBar).toHaveScreenshot('status-bar.png', {
        maxDiffPixelRatio: 0.01,
      });
    }
  });

  test('header component', async ({ appPage }) => {
    const header = appPage.header;
    const isVisible = await header.isVisible().catch(() => false);

    if (isVisible) {
      await expect(header).toHaveScreenshot('header.png', {
        maxDiffPixelRatio: 0.01,
      });
    }
  });
});

test.describe('Visual Regression - Canvas States', () => {
  test('canvas with drawn object', async ({ appPage }) => {
    await appPage.switchToDrawMode();

    // Draw a simple shape by clicking multiple cells
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(100);
    await appPage.clickCanvas(120, 100);
    await appPage.page.waitForTimeout(100);
    await appPage.clickCanvas(140, 100);
    await appPage.page.waitForTimeout(100);
    await appPage.clickCanvas(140, 120);
    await appPage.page.waitForTimeout(300);

    await expect(appPage.page).toHaveScreenshot('with-drawn-object.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('canvas with selected object', async ({ appPage }) => {
    // First draw an object
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(100);
    await appPage.clickCanvas(120, 100);
    await appPage.page.waitForTimeout(200);

    // Switch to select mode and select the object
    await appPage.switchToSelectMode();
    await appPage.page.waitForTimeout(100);
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(300);

    await expect(appPage.page).toHaveScreenshot('object-selected.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('canvas after drag operation', async ({ appPage }) => {
    await appPage.switchToDrawMode();

    // Draw by dragging
    await appPage.dragOnCanvas(150, 150, 250, 200);
    await appPage.page.waitForTimeout(300);

    await expect(appPage.page).toHaveScreenshot('after-drag-draw.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Visual Regression - Zoom States', () => {
  test('canvas zoomed in', async ({ appPage }) => {
    // Zoom in multiple times
    await appPage.zoomIn();
    await appPage.page.waitForTimeout(200);
    await appPage.zoomIn();
    await appPage.page.waitForTimeout(300);

    await expect(appPage.page).toHaveScreenshot('zoomed-in.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('canvas zoomed out', async ({ appPage }) => {
    // Zoom out multiple times
    await appPage.zoomOut();
    await appPage.page.waitForTimeout(200);
    await appPage.zoomOut();
    await appPage.page.waitForTimeout(300);

    await expect(appPage.page).toHaveScreenshot('zoomed-out.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Visual Regression - Interactive Elements', () => {
  test('toolbar button hover state', async ({ appPage }) => {
    // Hover over the select button
    await appPage.selectButton.hover();
    await appPage.page.waitForTimeout(200);

    await expect(appPage.toolbar).toHaveScreenshot('toolbar-hover.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('zoom controls area', async ({ appPage }) => {
    // Try to capture zoom control area
    const zoomInButton = appPage.zoomInButton;
    const isVisible = await zoomInButton.isVisible().catch(() => false);

    if (isVisible) {
      const zoomArea = appPage.page.locator('[data-testid="zoom-controls"]');
      const zoomAreaVisible = await zoomArea.isVisible().catch(() => false);

      if (zoomAreaVisible) {
        await expect(zoomArea).toHaveScreenshot('zoom-controls.png', {
          maxDiffPixelRatio: 0.01,
        });
      } else {
        // Take toolbar screenshot as fallback
        await expect(appPage.toolbar).toHaveScreenshot('zoom-area-fallback.png', {
          maxDiffPixelRatio: 0.01,
        });
      }
    }
  });
});

test.describe('Visual Regression - Empty Canvas', () => {
  test('clean canvas after clear', async ({ appPage }) => {
    // Clear any existing data
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
    await appPage.page.waitForTimeout(500);

    await expect(appPage.page).toHaveScreenshot('clean-canvas.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
});
