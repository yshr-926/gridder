import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Gridder Application
 * Provides abstraction for common page interactions
 */
export class AppPage {
  readonly page: Page;
  readonly canvas: Locator;
  readonly toolbar: Locator;
  readonly propertyPanel: Locator;
  readonly statusBar: Locator;
  readonly header: Locator;

  // Toolbar buttons (using role="radio" with aria-checked)
  readonly drawButton: Locator;
  readonly selectButton: Locator;
  readonly eraserButton: Locator;

  // Property panel elements
  readonly cellSizeInput: Locator;
  readonly unitSelect: Locator;
  readonly exportJSONButton: Locator;
  readonly exportPNGButton: Locator;
  readonly exportJPEGButton: Locator;
  readonly importButton: Locator;

  // Zoom controls
  readonly zoomInButton: Locator;
  readonly zoomOutButton: Locator;
  readonly zoomDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.canvas = page.locator('canvas').first();
    this.toolbar = page.getByRole('toolbar');
    this.propertyPanel = page.locator('aside[aria-label="プロパティパネル"]');
    this.statusBar = page.locator('footer');
    this.header = page.locator('header');

    // Toolbar buttons - using aria-label matching
    this.drawButton = page.getByRole('radio', { name: /描画ツール/i });
    this.selectButton = page.getByRole('radio', { name: /選択ツール/i });
    this.eraserButton = page.getByRole('radio', { name: /消しゴム/i });

    // Property panel elements
    this.cellSizeInput = page.getByLabel(/セルサイズ|cell size/i);
    this.unitSelect = page.getByLabel(/単位|unit/i);
    this.exportJSONButton = page.getByRole('button', { name: /JSON.*保存|export.*json/i });
    this.exportPNGButton = page.getByRole('button', { name: /PNG/i });
    this.exportJPEGButton = page.getByRole('button', { name: /JPEG/i });
    this.importButton = page.getByRole('button', { name: /読み込み|import|ファイルを開く/i });

    // Zoom controls
    this.zoomInButton = page.getByRole('button', { name: /ズームイン/i });
    this.zoomOutButton = page.getByRole('button', { name: /ズームアウト/i });
    this.zoomDisplay = page.locator('[data-testid="zoom-display"]');
  }

  /**
   * Navigate to the application root
   */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for canvas to be ready (with extended timeout for Konva initialization)
   */
  async waitForCanvasReady(): Promise<void> {
    // Wait for canvas element to appear
    await this.canvas.waitFor({ state: 'visible', timeout: 30000 });
    // Wait for Konva to initialize the canvas
    await this.page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      return canvas && canvas.width > 0 && canvas.height > 0;
    }, { timeout: 30000 });
  }

  /**
   * Click on canvas at specific coordinates
   * Uses mouse.click for Konva canvas compatibility
   */
  async clickCanvas(x: number, y: number): Promise<void> {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    await this.page.mouse.click(box.x + x, box.y + y);
  }

  /**
   * Drag on canvas from start to end position
   */
  async dragOnCanvas(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): Promise<void> {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    await this.page.mouse.move(box.x + startX, box.y + startY);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + endX, box.y + endY, { steps: 10 });
    await this.page.mouse.up();
  }

  /**
   * Switch to drawing mode
   */
  async switchToDrawMode(): Promise<void> {
    await this.drawButton.click();
    await expect(this.drawButton).toHaveAttribute('aria-checked', 'true');
  }

  /**
   * Switch to selection mode
   */
  async switchToSelectMode(): Promise<void> {
    await this.selectButton.click();
    await expect(this.selectButton).toHaveAttribute('aria-checked', 'true');
  }

  /**
   * Switch to eraser mode
   */
  async switchToEraserMode(): Promise<void> {
    await this.eraserButton.click();
    await expect(this.eraserButton).toHaveAttribute('aria-checked', 'true');
  }

  /**
   * Get current tool mode
   */
  async getCurrentToolMode(): Promise<'draw' | 'select' | 'eraser' | 'unknown'> {
    if (await this.drawButton.getAttribute('aria-checked') === 'true') {
      return 'draw';
    }
    if (await this.selectButton.getAttribute('aria-checked') === 'true') {
      return 'select';
    }
    if (await this.eraserButton.getAttribute('aria-checked') === 'true') {
      return 'eraser';
    }
    return 'unknown';
  }

  /**
   * Zoom in on canvas
   */
  async zoomIn(): Promise<void> {
    await this.zoomInButton.click();
  }

  /**
   * Zoom out on canvas
   */
  async zoomOut(): Promise<void> {
    await this.zoomOutButton.click();
  }

  /**
   * Perform mouse wheel zoom on canvas
   */
  async wheelZoom(deltaY: number): Promise<void> {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.wheel(0, deltaY);
  }

  /**
   * Clear local storage
   */
  async clearLocalStorage(): Promise<void> {
    await this.page.evaluate(() => localStorage.clear());
  }

  /**
   * Set local storage item
   */
  async setLocalStorageItem(key: string, value: string): Promise<void> {
    await this.page.evaluate(
      ({ k, v }) => localStorage.setItem(k, v),
      { k: key, v: value }
    );
  }

  /**
   * Get local storage item
   */
  async getLocalStorageItem(key: string): Promise<string | null> {
    return await this.page.evaluate(
      (k) => localStorage.getItem(k),
      key
    );
  }

  /**
   * Take a screenshot of the canvas only
   */
  async screenshotCanvas(path: string): Promise<void> {
    await this.canvas.screenshot({ path });
  }

  /**
   * Press keyboard shortcut
   */
  async pressShortcut(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /**
   * Get canvas dimensions
   */
  async getCanvasDimensions(): Promise<{ width: number; height: number }> {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    return { width: box.width, height: box.height };
  }

  /**
   * Get the count of objects from the application state
   * Reads from localStorage or evaluates application state
   */
  async getObjectCount(): Promise<number> {
    return await this.page.evaluate(() => {
      // Try to get object count from localStorage (auto-saved project)
      // The app uses 'gridder_autosave' as the storage key
      const storedData = localStorage.getItem('gridder_autosave');
      if (storedData) {
        try {
          const project = JSON.parse(storedData);
          if (project.objects && Array.isArray(project.objects)) {
            return project.objects.length;
          }
        } catch {
          // Ignore parse errors
        }
      }
      return 0;
    });
  }

  /**
   * Wait for object count to reach expected value
   */
  async waitForObjectCount(expectedCount: number, timeout: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const count = await this.getObjectCount();
      if (count === expectedCount) {
        return;
      }
      await this.page.waitForTimeout(100);
    }
    throw new Error(`Object count did not reach ${expectedCount} within ${timeout}ms`);
  }

  /**
   * Check if there are any objects on the canvas
   */
  async hasObjects(): Promise<boolean> {
    const count = await this.getObjectCount();
    return count > 0;
  }

  /**
   * Get the current status bar text
   */
  async getStatusBarText(): Promise<string> {
    const text = await this.statusBar.textContent();
    return text || '';
  }

  /**
   * Wait for the status bar to contain specific text
   */
  async waitForStatusText(text: string, timeout: number = 5000): Promise<void> {
    await this.page.waitForFunction(
      (expectedText) => {
        const footer = document.querySelector('footer');
        return footer?.textContent?.includes(expectedText);
      },
      text,
      { timeout }
    );
  }
}
