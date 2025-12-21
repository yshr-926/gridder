import { test, expect } from '../helpers';

// The app uses 'gridder_autosave' as the storage key with 2000ms delay
const STORAGE_KEY = 'gridder_autosave';
const AUTOSAVE_DELAY = 2500; // Slightly longer than app's 2000ms delay

/**
 * Auto-save and Restore E2E Tests
 * Tests for automatic saving to localStorage and restoration on reload
 */
test.describe('Auto-save Functionality', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should auto-save project to localStorage', async ({ appPage }) => {
    // Create an object
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);

    // Wait for auto-save (debounced with 2000ms delay)
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Check localStorage
    const storedData = await appPage.getLocalStorageItem(STORAGE_KEY);
    expect(storedData).not.toBeNull();

    if (storedData) {
      const project = JSON.parse(storedData);
      expect(project).toHaveProperty('version');
      expect(project).toHaveProperty('objects');
    }
  });

  test('should save multiple objects to localStorage', async ({ appPage }) => {
    // Create multiple objects
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(300);
    await appPage.clickCanvas(300, 300);

    // Wait for auto-save
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Check localStorage
    const storedData = await appPage.getLocalStorageItem(STORAGE_KEY);
    expect(storedData).not.toBeNull();

    if (storedData) {
      const project = JSON.parse(storedData);
      expect(project.objects.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('should update localStorage when modifying objects', async ({ appPage }) => {
    // Create an object
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Get initial saved state
    const initialData = await appPage.getLocalStorageItem(STORAGE_KEY);
    expect(initialData).not.toBeNull();

    // Modify by adding another object
    await appPage.clickCanvas(300, 300);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Get updated state
    const updatedData = await appPage.getLocalStorageItem(STORAGE_KEY);
    expect(updatedData).not.toBeNull();

    // Data should be updated
    if (initialData && updatedData) {
      const initial = JSON.parse(initialData);
      const updated = JSON.parse(updatedData);
      expect(updated.objects.length).toBeGreaterThanOrEqual(initial.objects.length);
    }
  });
});

test.describe('Restore Functionality', () => {
  test('should prompt to restore on page load when data exists', async ({ appPage }) => {
    // Create an object
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify data was saved
    const storedData = await appPage.getLocalStorageItem(STORAGE_KEY);
    expect(storedData).not.toBeNull();

    // Handle the confirmation dialog on reload
    appPage.page.once('dialog', async (dialog) => {
      // Accept the restore prompt
      await dialog.accept();
    });

    // Reload page
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Wait for restoration
    await appPage.page.waitForTimeout(500);

    // Objects should be restored
    const count = await appPage.getObjectCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should clear data when user declines restore', async ({ appPage }) => {
    // Create an object
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Handle the confirmation dialog on reload
    appPage.page.once('dialog', async (dialog) => {
      // Decline the restore prompt
      await dialog.dismiss();
    });

    // Reload page
    await appPage.page.reload();
    await appPage.waitForCanvasReady();

    // Wait for clearing
    await appPage.page.waitForTimeout(500);

    // Data should be cleared
    const storedData = await appPage.getLocalStorageItem(STORAGE_KEY);
    expect(storedData).toBeNull();
  });
});

test.describe('Clear LocalStorage', () => {
  test.beforeEach(async ({ appPage }) => {
    // Pre-populate some data using the correct key
    await appPage.setLocalStorageItem(STORAGE_KEY, JSON.stringify({
      version: '1.0',
      objects: [{ id: 'test', cells: [[0, 0]] }],
      gridSettings: { cellSize: 10, unit: 'cm' }
    }));
  });

  test('should clear localStorage when requested', async ({ appPage }) => {
    // Verify data exists
    const initialData = await appPage.getLocalStorageItem(STORAGE_KEY);
    expect(initialData).not.toBeNull();

    // Clear localStorage
    await appPage.clearLocalStorage();

    // Verify data is cleared
    const clearedData = await appPage.getLocalStorageItem(STORAGE_KEY);
    expect(clearedData).toBeNull();
  });
});

test.describe('Auto-save with Grid Settings', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should save grid settings to localStorage', async ({ appPage }) => {
    // Create an object (triggers auto-save)
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(150, 150);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Check localStorage for grid settings
    const storedData = await appPage.getLocalStorageItem(STORAGE_KEY);
    expect(storedData).not.toBeNull();

    if (storedData) {
      const project = JSON.parse(storedData);
      expect(project).toHaveProperty('gridSettings');
      expect(project.gridSettings).toHaveProperty('cellSize');
      expect(project.gridSettings).toHaveProperty('unit');
    }
  });
});
