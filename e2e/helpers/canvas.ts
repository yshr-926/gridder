import type { Page, Locator } from '@playwright/test';

/**
 * Canvas Helper Class for E2E tests
 * Provides grid coordinate conversion and canvas operations
 */
export class CanvasHelper {
  private page: Page;
  private canvas: Locator;
  private defaultGridSize: number = 20;

  constructor(page: Page) {
    this.page = page;
    this.canvas = page.locator('canvas').first();
  }

  /**
   * Get the grid size from application state or use default
   */
  async getGridSize(): Promise<number> {
    const gridSize = await this.page.evaluate(() => {
      // Try to get grid size from localStorage (autosave)
      const storedData = localStorage.getItem('gridder_autosave');
      if (storedData) {
        try {
          const project = JSON.parse(storedData);
          if (project.gridSettings?.cellSize) {
            return project.gridSettings.cellSize;
          }
        } catch {
          // Ignore parse errors
        }
      }
      // Default grid size
      return 20;
    });
    return gridSize || this.defaultGridSize;
  }

  /**
   * Convert grid coordinates to pixel coordinates
   * Returns coordinates relative to the canvas
   */
  async gridToPixel(gridX: number, gridY: number): Promise<{ x: number; y: number }> {
    const gridSize = await this.getGridSize();
    const canvasRect = await this.canvas.boundingBox();

    if (!canvasRect) {
      throw new Error('Canvas not found');
    }

    return {
      x: canvasRect.x + gridX * gridSize + gridSize / 2,
      y: canvasRect.y + gridY * gridSize + gridSize / 2,
    };
  }

  /**
   * Convert pixel coordinates to grid coordinates
   */
  async pixelToGrid(pixelX: number, pixelY: number): Promise<{ x: number; y: number }> {
    const gridSize = await this.getGridSize();
    const canvasRect = await this.canvas.boundingBox();

    if (!canvasRect) {
      throw new Error('Canvas not found');
    }

    const relativeX = pixelX - canvasRect.x;
    const relativeY = pixelY - canvasRect.y;

    return {
      x: Math.floor(relativeX / gridSize),
      y: Math.floor(relativeY / gridSize),
    };
  }

  /**
   * Click at specified grid coordinates
   */
  async clickGrid(gridX: number, gridY: number): Promise<void> {
    const { x, y } = await this.gridToPixel(gridX, gridY);
    await this.page.mouse.click(x, y);
  }

  /**
   * Double click at specified grid coordinates
   */
  async doubleClickGrid(gridX: number, gridY: number): Promise<void> {
    const { x, y } = await this.gridToPixel(gridX, gridY);
    await this.page.mouse.dblclick(x, y);
  }

  /**
   * Drag from one grid coordinate to another
   */
  async dragGrid(
    startGridX: number,
    startGridY: number,
    endGridX: number,
    endGridY: number,
    options?: { steps?: number }
  ): Promise<void> {
    const start = await this.gridToPixel(startGridX, startGridY);
    const end = await this.gridToPixel(endGridX, endGridY);

    await this.page.mouse.move(start.x, start.y);
    await this.page.mouse.down();
    await this.page.mouse.move(end.x, end.y, { steps: options?.steps ?? 10 });
    await this.page.mouse.up();
  }

  /**
   * Hover over specified grid coordinates
   */
  async hoverGrid(gridX: number, gridY: number): Promise<void> {
    const { x, y } = await this.gridToPixel(gridX, gridY);
    await this.page.mouse.move(x, y);
  }

  /**
   * Take a screenshot of the canvas
   */
  async screenshot(): Promise<Buffer> {
    return await this.canvas.screenshot();
  }

  /**
   * Get the canvas bounding box
   */
  async getBoundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null> {
    return await this.canvas.boundingBox();
  }

  /**
   * Wait for canvas to be rendered (useful after operations)
   */
  async waitForRender(timeout: number = 500): Promise<void> {
    await this.page.waitForTimeout(timeout);
  }

  /**
   * Wait for canvas element to be ready
   */
  async waitForCanvas(): Promise<void> {
    await this.canvas.waitFor({ state: 'visible', timeout: 30000 });
    await this.page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      return canvas && canvas.width > 0 && canvas.height > 0;
    }, { timeout: 30000 });
  }

  /**
   * Get canvas locator
   */
  getLocator(): Locator {
    return this.canvas;
  }

  /**
   * Perform mouse wheel on canvas center
   */
  async wheel(deltaX: number, deltaY: number): Promise<void> {
    const box = await this.canvas.boundingBox();
    if (!box) {
      throw new Error('Canvas not found');
    }

    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.wheel(deltaX, deltaY);
  }

  /**
   * Perform ctrl+wheel zoom on canvas
   */
  async ctrlWheel(deltaY: number): Promise<void> {
    const box = await this.canvas.boundingBox();
    if (!box) {
      throw new Error('Canvas not found');
    }

    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.keyboard.down('Control');
    await this.page.mouse.wheel(0, deltaY);
    await this.page.keyboard.up('Control');
  }
}

// Legacy functions for backward compatibility
// These are kept for existing tests

/**
 * Get pixel color at specific canvas coordinates
 */
export async function getCanvasPixelColor(
  page: Page,
  x: number,
  y: number
): Promise<{ r: number; g: number; b: number; a: number }> {
  return await page.evaluate(
    ({ px, py }) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found');

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2d context');

      const imageData = ctx.getImageData(px, py, 1, 1);
      const [r, g, b, a] = imageData.data;

      return { r, g, b, a };
    },
    { px: x, py: y }
  );
}

/**
 * Check if a grid cell is filled at the given grid coordinates
 */
export async function isCellFilled(
  page: Page,
  gridX: number,
  gridY: number,
  cellSize: number = 20
): Promise<boolean> {
  const centerX = gridX * cellSize + cellSize / 2;
  const centerY = gridY * cellSize + cellSize / 2;

  const pixel = await getCanvasPixelColor(page, centerX, centerY);
  // Consider filled if alpha is significant
  return pixel.a > 128;
}

/**
 * Draw a line of cells on the canvas
 */
export async function drawCellLine(
  page: Page,
  startGridX: number,
  startGridY: number,
  endGridX: number,
  endGridY: number,
  cellSize: number = 20
): Promise<void> {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  const startX = startGridX * cellSize + cellSize / 2;
  const startY = startGridY * cellSize + cellSize / 2;
  const endX = endGridX * cellSize + cellSize / 2;
  const endY = endGridY * cellSize + cellSize / 2;

  await page.mouse.move(box.x + startX, box.y + startY);
  await page.mouse.down();
  await page.mouse.move(box.x + endX, box.y + endY, { steps: 10 });
  await page.mouse.up();
}

/**
 * Click on a specific grid cell
 */
export async function clickGridCell(
  page: Page,
  gridX: number,
  gridY: number,
  cellSize: number = 20
): Promise<void> {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  const centerX = gridX * cellSize + cellSize / 2;
  const centerY = gridY * cellSize + cellSize / 2;

  await page.mouse.click(box.x + centerX, box.y + centerY);
}

/**
 * Get the count of filled cells on canvas
 */
export async function getFilledCellCount(
  page: Page,
  cellSize: number = 20,
  gridWidth: number = 50,
  gridHeight: number = 50
): Promise<number> {
  return await page.evaluate(
    ({ cs, gw, gh }) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return 0;

      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;

      let count = 0;
      for (let gx = 0; gx < gw; gx++) {
        for (let gy = 0; gy < gh; gy++) {
          const centerX = gx * cs + cs / 2;
          const centerY = gy * cs + cs / 2;

          if (centerX < canvas.width && centerY < canvas.height) {
            const imageData = ctx.getImageData(centerX, centerY, 1, 1);
            if (imageData.data[3] > 128) {
              count++;
            }
          }
        }
      }
      return count;
    },
    { cs: cellSize, gw: gridWidth, gh: gridHeight }
  );
}
