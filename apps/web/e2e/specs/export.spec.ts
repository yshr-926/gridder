import { test, expect } from '../helpers';
import fs from 'fs';

/**
 * Export Functionality E2E Tests
 * Tests for JSON, PNG, and JPEG export functionality
 */
test.describe('Export JSON', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create an object for export testing
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(500);
  });

  test('should export project as JSON file', async ({ appPage }) => {
    const downloadPromise = appPage.page.waitForEvent('download');
    await appPage.exportJSONButton.click();
    const download = await downloadPromise;

    // Verify file name
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/.*\.json$/);
  });

  test('should export valid JSON with correct structure', async ({ appPage }) => {
    const downloadPromise = appPage.page.waitForEvent('download');
    await appPage.exportJSONButton.click();
    const download = await downloadPromise;

    // Read and validate JSON content
    const filePath = await download.path();
    if (filePath) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Verify structure
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('objects');
      expect(data).toHaveProperty('gridSettings');
      expect(Array.isArray(data.objects)).toBe(true);
    }
  });

  test('should export project with objects', async ({ appPage }) => {
    const downloadPromise = appPage.page.waitForEvent('download');
    await appPage.exportJSONButton.click();
    const download = await downloadPromise;

    const filePath = await download.path();
    if (filePath) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Should have at least one object
      expect(data.objects.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Export PNG', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create an object for export testing
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(500);
  });

  test('should export canvas as PNG file', async ({ appPage }) => {
    const downloadPromise = appPage.page.waitForEvent('download');
    await appPage.exportPNGButton.click();
    const download = await downloadPromise;

    // Verify file name
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/.*\.png$/);
  });

  test('should export PNG with content', async ({ appPage }) => {
    const downloadPromise = appPage.page.waitForEvent('download');
    await appPage.exportPNGButton.click();
    const download = await downloadPromise;

    const filePath = await download.path();
    if (filePath) {
      const stats = fs.statSync(filePath);
      // PNG file should have some content
      expect(stats.size).toBeGreaterThan(0);
    }
  });
});

test.describe('Export JPEG', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Create an object for export testing
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(500);
  });

  test('should export canvas as JPEG file', async ({ appPage }) => {
    const downloadPromise = appPage.page.waitForEvent('download');
    await appPage.exportJPEGButton.click();
    const download = await downloadPromise;

    // Verify file name (could be .jpg or .jpeg)
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/.*\.(jpg|jpeg)$/);
  });

  test('should export JPEG with content', async ({ appPage }) => {
    const downloadPromise = appPage.page.waitForEvent('download');
    await appPage.exportJPEGButton.click();
    const download = await downloadPromise;

    const filePath = await download.path();
    if (filePath) {
      const stats = fs.statSync(filePath);
      // JPEG file should have some content
      expect(stats.size).toBeGreaterThan(0);
    }
  });
});

test.describe('Export Empty Canvas', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should export empty project as JSON', async ({ appPage }) => {
    const downloadPromise = appPage.page.waitForEvent('download');
    await appPage.exportJSONButton.click();
    const download = await downloadPromise;

    const filePath = await download.path();
    if (filePath) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Should have empty objects array
      expect(data.objects).toEqual([]);
    }
  });
});
