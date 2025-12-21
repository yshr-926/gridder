import { test, expect } from '../helpers';

test.describe('Application Basics', () => {
  test('should load the application successfully', async ({ appPage }) => {
    // Canvas should be visible
    await expect(appPage.canvas).toBeVisible();
  });

  test('should have toolbar visible', async ({ appPage }) => {
    // Toolbar should be visible
    await expect(appPage.toolbar).toBeVisible();
  });

  test('should have correct page title', async ({ appPage }) => {
    const title = await appPage.page.title();
    expect(title).toBeTruthy();
  });

  test('should be responsive to canvas click', async ({ appPage }) => {
    // Click on canvas should not throw errors
    await appPage.clickCanvas(100, 100);
  });
});

test.describe('Tool Mode Switching', () => {
  test('should switch to draw mode', async ({ appPage }) => {
    await appPage.switchToDrawMode();
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('draw');
  });

  test('should switch to select mode', async ({ appPage }) => {
    await appPage.switchToSelectMode();
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('select');
  });

  test('should switch to eraser mode', async ({ appPage }) => {
    await appPage.switchToEraserMode();
    const mode = await appPage.getCurrentToolMode();
    expect(mode).toBe('eraser');
  });
});

test.describe('Canvas Operations', () => {
  test('should get canvas dimensions', async ({ appPage }) => {
    const dimensions = await appPage.getCanvasDimensions();
    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
  });

  test('should perform drag operation on canvas', async ({ appPage }) => {
    await appPage.switchToDrawMode();
    // Drag should not throw errors
    await appPage.dragOnCanvas(50, 50, 150, 150);
  });
});

test.describe('Local Storage', () => {
  test('should clear local storage', async ({ appPage }) => {
    await appPage.setLocalStorageItem('test_key', 'test_value');
    await appPage.clearLocalStorage();
    const value = await appPage.getLocalStorageItem('test_key');
    expect(value).toBeNull();
  });

  test('should set and get local storage items', async ({ appPage }) => {
    await appPage.setLocalStorageItem('gridder_test', 'hello');
    const value = await appPage.getLocalStorageItem('gridder_test');
    expect(value).toBe('hello');
  });
});

test.describe('Zoom Controls', () => {
  test('should zoom in using button', async ({ appPage }) => {
    await appPage.zoomIn();
    // Should not throw an error
  });

  test('should zoom out using button', async ({ appPage }) => {
    await appPage.zoomOut();
    // Should not throw an error
  });

  test('should zoom using mouse wheel', async ({ appPage }) => {
    await appPage.wheelZoom(-100); // Zoom in
    await appPage.wheelZoom(100);  // Zoom out
    // Should not throw an error
  });
});
