import { type Page, expect } from '@playwright/test';

/**
 * Custom assertion helpers for Gridder E2E tests
 * These provide semantic assertions specific to the Gridder application
 */

/**
 * Custom assertion object for Gridder-specific checks
 */
export const customExpect = {
  /**
   * Assert that the object count matches expected value
   */
  async toHaveObjectCount(page: Page, count: number): Promise<void> {
    const statusBar = page.locator('footer');
    const regex = new RegExp(`オブジェクト:\\s*${count}`);
    await expect(statusBar).toContainText(regex);
  },

  /**
   * Assert that the application is in a specific tool mode
   */
  async toBeInToolMode(page: Page, mode: 'draw' | 'select' | 'eraser'): Promise<void> {
    const buttonNames = {
      draw: /描画ツール/i,
      select: /選択ツール/i,
      eraser: /消しゴム/i,
    };

    const button = page.getByRole('radio', { name: buttonNames[mode] });
    await expect(button).toHaveAttribute('aria-checked', 'true');
  },

  /**
   * Assert that an object is currently selected
   */
  async toHaveSelectedObject(page: Page): Promise<void> {
    const statusBar = page.locator('footer');
    await expect(statusBar).toContainText('選択');
  },

  /**
   * Assert that no object is selected
   */
  async toHaveNoSelectedObject(page: Page): Promise<void> {
    const statusBar = page.locator('footer');
    await expect(statusBar).not.toContainText('選択中');
  },

  /**
   * Assert that no errors are displayed on the page
   */
  async toHaveNoErrors(page: Page): Promise<void> {
    const errorElements = page.locator('[role="alert"][class*="error"], .error-message, [data-error="true"]');
    await expect(errorElements).toHaveCount(0);
  },

  /**
   * Assert that the zoom level matches expected value
   */
  async toHaveZoomLevel(page: Page, level: number): Promise<void> {
    const statusBar = page.locator('footer');
    await expect(statusBar).toContainText(`${level}%`);
  },

  /**
   * Assert that the status bar contains specific text
   */
  async toHaveStatusText(page: Page, text: string | RegExp): Promise<void> {
    const statusBar = page.locator('footer');
    await expect(statusBar).toContainText(text);
  },

  /**
   * Assert that the canvas is visible and has dimensions
   */
  async toHaveVisibleCanvas(page: Page): Promise<void> {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
  },

  /**
   * Assert that local storage contains saved project data
   */
  async toHaveSavedProject(page: Page): Promise<void> {
    const hasProject = await page.evaluate(() => {
      const data = localStorage.getItem('gridder_autosave');
      if (!data) return false;

      try {
        const project = JSON.parse(data);
        return 'version' in project || 'objects' in project;
      } catch {
        return false;
      }
    });

    expect(hasProject).toBe(true);
  },
};

// Individual assertion functions for direct use

/**
 * Assert that canvas has content (pixels have been drawn)
 */
export async function expectCanvasHasContent(page: Page): Promise<void> {
  const hasContent = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Check if any pixel is not fully transparent
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return true;
    }
    return false;
  });

  expect(hasContent).toBe(true);
}

/**
 * Assert that canvas is empty (no drawn content)
 */
export async function expectCanvasIsEmpty(page: Page): Promise<void> {
  const isEmpty = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return true;

    const ctx = canvas.getContext('2d');
    if (!ctx) return true;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Check if all pixels are fully transparent
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return false;
    }
    return true;
  });

  expect(isEmpty).toBe(true);
}

/**
 * Assert that local storage contains project data
 */
export async function expectLocalStorageHasProject(page: Page): Promise<void> {
  const hasProject = await page.evaluate(() => {
    const data = localStorage.getItem('gridder_project') || localStorage.getItem('gridder_autosave');
    if (!data) return false;

    try {
      const project = JSON.parse(data);
      return 'version' in project || 'objects' in project;
    } catch {
      return false;
    }
  });

  expect(hasProject).toBe(true);
}

/**
 * Assert that a file download was triggered
 */
export async function expectDownload(
  page: Page,
  action: () => Promise<void>,
  expectedFilename?: string | RegExp
): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await action();
  const download = await downloadPromise;

  if (expectedFilename) {
    if (typeof expectedFilename === 'string') {
      expect(download.suggestedFilename()).toBe(expectedFilename);
    } else {
      expect(download.suggestedFilename()).toMatch(expectedFilename);
    }
  }

  return download.suggestedFilename();
}

/**
 * Assert that an element is focused
 */
export async function expectElementFocused(
  page: Page,
  selector: string
): Promise<void> {
  const isFocused = await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    return element === document.activeElement;
  }, selector);

  expect(isFocused).toBe(true);
}

/**
 * Assert that keyboard navigation works correctly
 */
export async function expectTabNavigation(
  page: Page,
  expectedOrder: string[]
): Promise<void> {
  for (const selector of expectedOrder) {
    await page.keyboard.press('Tab');
    await expectElementFocused(page, selector);
  }
}

/**
 * Assert that objects exist on the canvas (via localStorage)
 */
export async function expectObjectCount(page: Page, count: number): Promise<void> {
  const objectCount = await page.evaluate(() => {
    const data = localStorage.getItem('gridder_autosave');
    if (!data) return 0;

    try {
      const project = JSON.parse(data);
      return project.objects?.length ?? 0;
    } catch {
      return 0;
    }
  });

  expect(objectCount).toBe(count);
}

/**
 * Assert that the toolbar is visible and has expected buttons
 */
export async function expectToolbarVisible(page: Page): Promise<void> {
  const toolbar = page.getByRole('toolbar');
  await expect(toolbar).toBeVisible();

  const drawButton = page.getByRole('radio', { name: /描画ツール/i });
  const selectButton = page.getByRole('radio', { name: /選択ツール/i });
  const eraserButton = page.getByRole('radio', { name: /消しゴム/i });

  await expect(drawButton).toBeVisible();
  await expect(selectButton).toBeVisible();
  await expect(eraserButton).toBeVisible();
}

/**
 * Assert that the property panel is visible
 */
export async function expectPropertyPanelVisible(page: Page): Promise<void> {
  const panel = page.locator('aside[aria-label="プロパティパネル"]');
  await expect(panel).toBeVisible();
}

/**
 * Assert that the status bar is visible
 */
export async function expectStatusBarVisible(page: Page): Promise<void> {
  const statusBar = page.locator('footer');
  await expect(statusBar).toBeVisible();
}

/**
 * Assert that the page has no console errors
 */
export async function expectNoConsoleErrors(
  page: Page,
  action: () => Promise<void>
): Promise<void> {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await action();

  // Filter out expected errors (like third-party library warnings)
  const unexpectedErrors = errors.filter(
    (err) => !err.includes('favicon') && !err.includes('ResizeObserver')
  );

  expect(unexpectedErrors).toHaveLength(0);
}

/**
 * Assert that a modal/dialog is visible
 */
export async function expectModalVisible(page: Page, titlePattern?: RegExp): Promise<void> {
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();

  if (titlePattern) {
    await expect(modal).toContainText(titlePattern);
  }
}

/**
 * Assert that no modal/dialog is visible
 */
export async function expectNoModal(page: Page): Promise<void> {
  const modal = page.getByRole('dialog');
  await expect(modal).toHaveCount(0);
}
