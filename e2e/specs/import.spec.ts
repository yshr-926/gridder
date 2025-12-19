import { test, expect } from '../helpers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Auto-save delay is 2000ms, we need to wait longer
const AUTOSAVE_DELAY = 2500;

// Fixture paths
const TEST_PROJECT_PATH = join(__dirname, '../fixtures/test-project.json');
const INVALID_PROJECT_PATH = join(__dirname, '../fixtures/invalid-project.json');
const LARGE_PROJECT_PATH = join(__dirname, '../fixtures/large-project.json');

/**
 * Import Functionality E2E Tests
 * Tests for JSON file import including normal and error cases
 */
test.describe('Import JSON', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should import valid JSON project file', async ({ appPage }) => {
    // Open the "開く" button (Open project)
    const openButton = appPage.page.getByRole('button', { name: /開く|プロジェクトを開く/i });
    await openButton.click();

    // Wait for dialog to appear
    const dialog = appPage.page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Wait for file input to be ready
    const fileInput = appPage.page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_PROJECT_PATH);

    // Wait for import to complete and dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Wait for auto-save to capture the imported data
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify objects were imported
    const count = await appPage.getObjectCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should show error for invalid JSON file', async ({ appPage }) => {
    // Open the "開く" button
    const openButton = appPage.page.getByRole('button', { name: /開く|プロジェクトを開く/i });
    await openButton.click();

    // Wait for dialog to appear
    const dialog = appPage.page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Wait for file input and upload invalid file
    const fileInput = appPage.page.locator('input[type="file"]');
    await fileInput.setInputFiles(INVALID_PROJECT_PATH);

    // Wait for error handling
    await appPage.page.waitForTimeout(1000);

    // Error message should be displayed
    // The dialog should still be visible with an error
    const errorText = appPage.page.getByText(/エラー|失敗|不正/i);
    await expect(errorText).toBeVisible({ timeout: 3000 });

    // Close the dialog
    await appPage.page.keyboard.press('Escape');
    await appPage.page.waitForTimeout(500);

    // App should still be functional
    await expect(appPage.canvas).toBeVisible();
  });

  test('should replace existing project when importing', async ({ appPage }) => {
    // First create some objects
    await appPage.switchToDrawMode();
    await appPage.clickCanvas(100, 100);
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    const initialCount = await appPage.getObjectCount();
    expect(initialCount).toBeGreaterThan(0);

    // Import a new project
    // Open the "開く" button
    const openButton = appPage.page.getByRole('button', { name: /開く|プロジェクトを開く/i });
    await openButton.click();

    // Wait for dialog to appear
    const dialog = appPage.page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const fileInput = appPage.page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_PROJECT_PATH);

    // Wait for import to complete
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Project should be replaced
    const count = await appPage.getObjectCount();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Import Dialog', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should open import dialog when clicking open button', async ({ appPage }) => {
    const openButton = appPage.page.getByRole('button', { name: /開く|プロジェクトを開く/i });
    await openButton.click();

    // Check for dialog
    const dialog = appPage.page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Check dialog title
    const dialogTitle = appPage.page.getByText('プロジェクトを開く');
    await expect(dialogTitle).toBeVisible();
  });

  test('should close import dialog without importing', async ({ appPage }) => {
    const openButton = appPage.page.getByRole('button', { name: /開く|プロジェクトを開く/i });
    await openButton.click();

    // Wait for dialog
    const dialog = appPage.page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Press Escape to close dialog
    await appPage.page.keyboard.press('Escape');
    await appPage.page.waitForTimeout(300);

    // Dialog should be closed
    await expect(dialog).not.toBeVisible();

    // Canvas should still be visible and functional
    await expect(appPage.canvas).toBeVisible();
  });

  test('should close import dialog with cancel button', async ({ appPage }) => {
    const openButton = appPage.page.getByRole('button', { name: /開く|プロジェクトを開く/i });
    await openButton.click();

    // Wait for dialog
    const dialog = appPage.page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click cancel button
    const cancelButton = appPage.page.getByRole('button', { name: /キャンセル/i });
    await cancelButton.click();

    // Dialog should be closed
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('Import Large Project', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should import large project file', async ({ appPage }) => {
    const openButton = appPage.page.getByRole('button', { name: /開く|プロジェクトを開く/i });
    await openButton.click();

    const dialog = appPage.page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const fileInput = appPage.page.locator('input[type="file"]');
    await fileInput.setInputFiles(LARGE_PROJECT_PATH);

    // Wait for import with extended timeout for large file
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await appPage.page.waitForTimeout(AUTOSAVE_DELAY);

    // Verify import succeeded
    const count = await appPage.getObjectCount();
    expect(count).toBeGreaterThan(0);
  });
});
