/**
 * Example test demonstrating the use of custom test helpers
 * This file serves as documentation and verification of helper functionality
 */
import { test, expect, customExpect, TIMEOUTS } from '../helpers';

test.describe('Custom Helper Example Tests', () => {
  test('using app fixture for drawing', async ({ app, canvasHelper }) => {
    // Switch to draw mode using AppPage
    await app.switchToDrawMode();

    // Use CanvasHelper to click on grid coordinates
    await canvasHelper.clickGrid(5, 5);
    await canvasHelper.waitForRender(TIMEOUTS.medium);

    // Verify using custom assertion
    await customExpect.toBeInToolMode(app.page, 'draw');
  });

  test('using canvasHelper for grid coordinate operations', async ({ app, canvasHelper }) => {
    // Verify grid to pixel conversion
    const pixelCoords = await canvasHelper.gridToPixel(3, 3);
    expect(pixelCoords.x).toBeGreaterThan(0);
    expect(pixelCoords.y).toBeGreaterThan(0);

    // Verify pixel to grid conversion
    const gridCoords = await canvasHelper.pixelToGrid(pixelCoords.x, pixelCoords.y);
    expect(gridCoords.x).toBe(3);
    expect(gridCoords.y).toBe(3);
  });

  test('using canvasHelper for drag operations', async ({ app, canvasHelper }) => {
    await app.switchToDrawMode();

    // Drag draw from grid (2,2) to (5,5)
    await canvasHelper.dragGrid(2, 2, 5, 5);
    await canvasHelper.waitForRender(TIMEOUTS.medium);

    // Verify canvas has content
    await customExpect.toHaveVisibleCanvas(app.page);
  });

  test('using custom assertions', async ({ app }) => {
    // Verify initial state
    await customExpect.toHaveVisibleCanvas(app.page);
    await customExpect.toHaveNoErrors(app.page);

    // Verify tool mode
    await app.switchToSelectMode();
    await customExpect.toBeInToolMode(app.page, 'select');

    // Switch to eraser mode
    await app.switchToEraserMode();
    await customExpect.toBeInToolMode(app.page, 'eraser');
  });

  test('using canvasHelper for hover and wheel', async ({ app, canvasHelper }) => {
    // Hover over specific grid cell
    await canvasHelper.hoverGrid(10, 10);

    // Get canvas bounding box
    const box = await canvasHelper.getBoundingBox();
    expect(box).toBeTruthy();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);

    // Test wheel (for zoom scenarios)
    await canvasHelper.wheel(0, -100);
    await canvasHelper.waitForRender(TIMEOUTS.short);
  });

  test('demonstrating test fixture isolation', async ({ app, canvasHelper }) => {
    // Each test gets a fresh page with cleared localStorage
    // The app fixture handles setup automatically

    // Draw something
    await app.switchToDrawMode();
    await canvasHelper.clickGrid(7, 7);
    await canvasHelper.waitForRender(TIMEOUTS.medium);

    // This test is isolated from other tests
    // The next test will start fresh
  });

  test('using multiple custom assertions together', async ({ app }) => {
    // Verify page structure
    await customExpect.toHaveVisibleCanvas(app.page);
    await customExpect.toHaveNoErrors(app.page);

    // Status text should contain zoom level
    await customExpect.toHaveStatusText(app.page, /%/);

    // Default mode should be draw
    await customExpect.toBeInToolMode(app.page, 'draw');
  });
});

test.describe('Canvas Helper Coordinate Tests', () => {
  test('grid coordinates round-trip correctly', async ({ canvasHelper }) => {
    // Test multiple grid coordinates
    const testCoords = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 10 },
      { x: 20, y: 15 },
    ];

    for (const coord of testCoords) {
      const pixel = await canvasHelper.gridToPixel(coord.x, coord.y);
      const grid = await canvasHelper.pixelToGrid(pixel.x, pixel.y);

      // Due to center-click offset, we should get the same grid coords back
      expect(grid.x).toBe(coord.x);
      expect(grid.y).toBe(coord.y);
    }
  });

  test('getGridSize returns valid size', async ({ canvasHelper }) => {
    const gridSize = await canvasHelper.getGridSize();

    // Grid size should be a positive number (default is 20)
    expect(gridSize).toBeGreaterThan(0);
    expect(gridSize).toBeLessThanOrEqual(100); // Reasonable upper bound
  });

  test('canvas locator is accessible', async ({ canvasHelper }) => {
    const locator = canvasHelper.getLocator();
    await expect(locator).toBeVisible();
  });
});
