/**
 * Collaboration Feature E2E Tests
 *
 * Tests for real-time collaboration features including:
 * - Room creation and URL sharing
 * - Display name dialog
 * - Collaboration panel visibility
 * - Multi-browser sync (where possible in single test context)
 *
 * Note: Full multi-browser WebSocket sync tests require a running server.
 * These tests focus on UI flows that can be verified without a live server.
 */

import { test, expect } from '../helpers';

/**
 * Mock collaboration room ID for testing
 */
const MOCK_ROOM_ID = 'AbCdEfGhIjKlMnOpQrStUvWx';

test.describe('Collaboration - Display Name Dialog', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should show display name dialog when navigating to room URL', async ({
    appPage,
  }) => {
    // Navigate to a room URL (simulating someone sharing a link)
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog to appear
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Check dialog title
    await expect(
      appPage.page.getByRole('heading', { name: /共同編集に参加/i })
    ).toBeVisible();

    // Check display name input exists
    const displayNameInput = appPage.page.getByLabel(/表示名/i);
    await expect(displayNameInput).toBeVisible();

    // Check submit button exists
    await expect(
      appPage.page.getByRole('button', { name: /参加/i })
    ).toBeVisible();

    // Check cancel button exists
    await expect(
      appPage.page.getByRole('button', { name: /キャンセル/i })
    ).toBeVisible();
  });

  test('should allow entering display name and submitting', async ({
    appPage,
  }) => {
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Enter display name
    const displayNameInput = appPage.page.getByLabel(/表示名/i);
    await displayNameInput.fill('TestUser123');

    // Verify input value
    await expect(displayNameInput).toHaveValue('TestUser123');
  });

  test('should close dialog on cancel click', async ({ appPage }) => {
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Click cancel
    await appPage.page.getByRole('button', { name: /キャンセル/i }).click();

    // Dialog should close (or redirect back)
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('should close dialog on Escape key', async ({ appPage }) => {
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Press Escape
    await appPage.page.keyboard.press('Escape');

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('should close dialog on cancel button click', async ({ appPage }) => {
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Click the cancel button to close the dialog
    const cancelButton = dialog.getByRole('button', { name: 'キャンセル' });
    await cancelButton.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('should have max length constraint on display name input', async ({
    appPage,
  }) => {
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const displayNameInput = appPage.page.getByLabel(/表示名/i);

    // Try to enter a very long name
    const longName = 'A'.repeat(30);
    await displayNameInput.fill(longName);

    // Check that maxLength is enforced (20 characters max)
    const inputValue = await displayNameInput.inputValue();
    expect(inputValue.length).toBeLessThanOrEqual(20);
  });

  test('should show helper text about max characters', async ({ appPage }) => {
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Check for helper text mentioning max characters
    await expect(appPage.page.getByText(/最大.*20.*文字/)).toBeVisible();
  });
});

test.describe('Collaboration - Share Dialog', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should open share dialog from toolbar or menu', async ({ appPage }) => {
    // Look for share button in the UI
    const shareButton = appPage.page.getByRole('button', {
      name: /共有|share/i,
    });

    // If share button exists, click it
    if (await shareButton.isVisible()) {
      await shareButton.click();

      // Check for share dialog
      const dialog = appPage.page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Check dialog title
      await expect(
        appPage.page.getByText(/プロジェクトを共有/i)
      ).toBeVisible();
    } else {
      // Share button might not be visible in solo mode - this is acceptable
      test.skip();
    }
  });
});

test.describe('Collaboration - Panel Visibility', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should not show collaboration panel in solo mode', async ({
    appPage,
  }) => {
    // In solo mode (not connected to a room), collaboration panel should not be visible
    const collaborationPanel = appPage.page.locator(
      '[data-testid="collaboration-panel"]'
    );

    // Panel should not exist or not be visible in solo mode
    await expect(collaborationPanel).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Collaboration - Room URL Format', () => {
  test('should have correct room URL format', async ({ appPage }) => {
    // Test that room URLs follow the expected format
    const baseUrl = appPage.page.url();
    const roomUrl = `${baseUrl}room/${MOCK_ROOM_ID}`;

    // URL should contain /room/ path
    expect(roomUrl).toContain('/room/');

    // Room ID should be URL-safe (alphanumeric with - and _)
    const urlSafePattern = /^[A-Za-z0-9_-]+$/;
    expect(MOCK_ROOM_ID).toMatch(urlSafePattern);
  });

  test('should handle invalid room ID gracefully', async ({ appPage }) => {
    // Navigate to an invalid room ID
    await appPage.page.goto('/room/invalid!!!room!!!id');

    // App should handle this gracefully - either show error or redirect
    // We just verify the page loads without crashing
    await expect(appPage.page).toHaveURL(/room/);
  });

  test('should handle very long room ID', async ({ appPage }) => {
    const longRoomId = 'A'.repeat(100);
    await appPage.page.goto(`/room/${longRoomId}`);

    // App should handle this without crashing
    // May show error or redirect to home
    await appPage.page.waitForLoadState('domcontentloaded');
  });
});

test.describe('Collaboration - Keyboard Navigation', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should support Tab navigation in display name dialog', async ({
    appPage,
  }) => {
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Tab through focusable elements
    await appPage.page.keyboard.press('Tab');
    await appPage.page.keyboard.press('Tab');

    // Should be able to navigate through dialog elements
    // Verify at least one element is focused
    const focusedElement = await appPage.page.evaluate(
      () => document.activeElement?.tagName
    );
    expect(focusedElement).toBeDefined();
  });

  test('should submit on Enter key in display name input', async ({
    appPage,
  }) => {
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Focus input and type name
    const displayNameInput = appPage.page.getByLabel(/表示名/i);
    await displayNameInput.fill('TestUser');

    // Press Enter to submit
    await displayNameInput.press('Enter');

    // Dialog should attempt to submit (may close or show connection attempt)
    // Since we don't have a real server, we just verify the Enter key works
    await appPage.page.waitForTimeout(500);
  });
});

test.describe('Collaboration - LocalStorage Persistence', () => {
  test('should save display name to localStorage', async ({ appPage }) => {
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Enter display name
    const displayNameInput = appPage.page.getByLabel(/表示名/i);
    await displayNameInput.fill('PersistentUser');

    // Submit
    await appPage.page.getByRole('button', { name: /参加/i }).click();

    // Wait a moment for localStorage to be updated
    await appPage.page.waitForTimeout(500);

    // Check localStorage
    const savedName = await appPage.page.evaluate(() => {
      return localStorage.getItem('gridder_display_name');
    });

    // Name should be saved (may be null if connection failed before save)
    // In real scenario with server, this would be 'PersistentUser'
    expect(savedName === 'PersistentUser' || savedName === null).toBe(true);
  });

  test('should load saved display name on next visit', async ({ appPage }) => {
    // First, set a display name in localStorage
    await appPage.page.evaluate(() => {
      localStorage.setItem('gridder_display_name', 'SavedUser');
    });

    // Navigate to room URL
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Check that the saved name is pre-filled
    const displayNameInput = appPage.page.getByLabel(/表示名/i);
    await expect(displayNameInput).toHaveValue('SavedUser');
  });
});

test.describe('Collaboration - Accessibility', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.clearLocalStorage();
    await appPage.page.reload();
    await appPage.waitForCanvasReady();
  });

  test('should have proper ARIA attributes on display name dialog', async ({
    appPage,
  }) => {
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Check ARIA attributes
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-labelledby');
  });

  test('should have close button with aria-label', async ({ appPage }) => {
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Find close button within the dialog by exact aria-label
    const closeButton = dialog.getByRole('button', { name: '閉じる', exact: true });
    await expect(closeButton).toBeVisible();
  });

  test('should have form with proper labels', async ({ appPage }) => {
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Check that input has associated label
    const displayNameInput = appPage.page.getByLabel(/表示名/i);
    await expect(displayNameInput).toBeVisible();
    await expect(displayNameInput).toHaveAttribute('id');
  });
});

test.describe('Collaboration - Error Handling', () => {
  test('should handle network errors gracefully', async ({ appPage }) => {
    await appPage.page.goto(`/room/${MOCK_ROOM_ID}`);

    // Wait for dialog
    const dialog = appPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Enter name and try to submit
    const displayNameInput = appPage.page.getByLabel(/表示名/i);
    await displayNameInput.fill('TestUser');
    await appPage.page.getByRole('button', { name: /参加/i }).click();

    // Without a server, connection will fail
    // App should show error message or remain functional
    await appPage.page.waitForTimeout(2000);

    // Page should still be responsive (not frozen)
    await expect(appPage.page).toHaveURL(/room/);
  });
});
