import type { Page, Locator } from '@playwright/test';

/** Live viewport transform read from `useViewportStore` (issue #58). */
interface ViewportSnapshot {
  scale: number;
  offset: { x: number; y: number };
}

const readViewport = (page: Page): Promise<ViewportSnapshot> =>
  page.evaluate(() => {
    const store = (
      window as unknown as {
        __GRIDDER_VIEWPORT_STORE__: {
          getState: () => { scale: number; offset: { x: number; y: number } };
        };
      }
    ).__GRIDDER_VIEWPORT_STORE__;
    const state = store.getState();
    return { scale: state.scale, offset: state.offset };
  });

/**
 * Grid-coordinate <-> screen-coordinate conversion for E2E tests on the
 * polygon document (issue #58). Grid vertices, not cells, are the unit —
 * shapes snap to grid vertices (spec §5) — so `gridToScreen(x, y)` returns
 * the pixel position of vertex `(x, y)`, and every helper here is built on
 * top of it.
 *
 * Every conversion reads the live `scale` / `offset` from
 * `window.__GRIDDER_VIEWPORT_STORE__` (exposed in E2E builds, see
 * `stores/viewportStore.ts`), so tests remain correct across zoom and pan —
 * unlike the retired cell-era helper, nothing here assumes `scale === 1`.
 */
/**
 * A pause longer than the browser's own double-click detection window.
 * Two clicks (or a drag's mouseup followed by another mousedown) landing
 * within that window fire a native `dblclick` — which this app's canvas
 * treats as "enter cell-editing / group mode" (spec §6.3, issue #52) —
 * regardless of how far apart their coordinates are. Without a pause between
 * unrelated gestures, one test's rect-drag mouseup and the next gesture's
 * mousedown can land inside that window and silently switch to
 * `editingShape`, so every gesture below waits this long once it has
 * released the mouse button.
 */
const DBLCLICK_CLEAR_MS = 500;

export class CanvasHelper {
  private readonly page: Page;
  private readonly canvas: Locator;

  constructor(page: Page) {
    this.page = page;
    // Scoped to `[data-testid="grid-canvas-container"]` (`GridCanvas.tsx`),
    // not a bare `page.locator('canvas').first()`: the off-screen
    // `ExportStage` Konva Stage (issue #56) mounts its own `<canvas>` the
    // moment a selection exists (a drawing range to export), and it can
    // outrank the real one in DOM order.
    this.canvas = page.locator('[data-testid="grid-canvas-container"] canvas').first();
  }

  /** The pixel size of one grid cell at zoom 1 (`gridSettingsStore.basePixelSize`). */
  static readonly BASE_GRID_SIZE = 20;

  /** Convert a grid-vertex coordinate to a page-relative pixel position. */
  async gridToScreen(gridX: number, gridY: number): Promise<{ x: number; y: number }> {
    const [box, viewport] = await Promise.all([
      this.canvas.boundingBox(),
      readViewport(this.page),
    ]);
    if (!box) {
      throw new Error('canvas has no bounding box');
    }
    const worldX = gridX * CanvasHelper.BASE_GRID_SIZE;
    const worldY = gridY * CanvasHelper.BASE_GRID_SIZE;
    return {
      x: box.x + worldX * viewport.scale + viewport.offset.x,
      y: box.y + worldY * viewport.scale + viewport.offset.y,
    };
  }

  /** Convert a page-relative pixel position back to grid-vertex space. */
  async screenToGrid(x: number, y: number): Promise<{ x: number; y: number }> {
    const [box, viewport] = await Promise.all([
      this.canvas.boundingBox(),
      readViewport(this.page),
    ]);
    if (!box) {
      throw new Error('canvas has no bounding box');
    }
    const worldX = (x - box.x - viewport.offset.x) / viewport.scale;
    const worldY = (y - box.y - viewport.offset.y) / viewport.scale;
    return { x: worldX / CanvasHelper.BASE_GRID_SIZE, y: worldY / CanvasHelper.BASE_GRID_SIZE };
  }

  /** Move the mouse to a grid vertex without pressing a button. */
  async hoverGrid(gridX: number, gridY: number): Promise<void> {
    const { x, y } = await this.gridToScreen(gridX, gridY);
    await this.page.mouse.move(x, y);
  }

  /** Click at a grid vertex. `modifiers` forwards to Playwright's `mouse.click`. */
  async clickGrid(
    gridX: number,
    gridY: number,
    options?: { modifiers?: ('Shift' | 'Control' | 'Alt' | 'Meta')[] }
  ): Promise<void> {
    const { x, y } = await this.gridToScreen(gridX, gridY);
    if (options?.modifiers) {
      for (const modifier of options.modifiers) {
        await this.page.keyboard.down(modifier);
      }
    }
    await this.page.mouse.click(x, y);
    if (options?.modifiers) {
      for (const modifier of options.modifiers) {
        await this.page.keyboard.up(modifier);
      }
    }
    await this.page.waitForTimeout(DBLCLICK_CLEAR_MS);
  }

  /** Double-click at a grid vertex (enters group / cell-editing mode). */
  async doubleClickGrid(gridX: number, gridY: number): Promise<void> {
    const { x, y } = await this.gridToScreen(gridX, gridY);
    await this.page.mouse.dblclick(x, y);
  }

  /**
   * Drag from one grid vertex to another with a real mouse-down/move/up
   * sequence, so the app's own drag-threshold and grid-snap logic runs.
   */
  async dragGrid(
    startGridX: number,
    startGridY: number,
    endGridX: number,
    endGridY: number,
    options?: { steps?: number; shiftKey?: boolean; altKey?: boolean }
  ): Promise<void> {
    const start = await this.gridToScreen(startGridX, startGridY);
    const end = await this.gridToScreen(endGridX, endGridY);

    if (options?.shiftKey) {
      await this.page.keyboard.down('Shift');
    }
    if (options?.altKey) {
      await this.page.keyboard.down('Alt');
    }
    await this.page.mouse.move(start.x, start.y);
    await this.page.mouse.down();
    await this.page.mouse.move(end.x, end.y, { steps: options?.steps ?? 10 });
    await this.page.mouse.up();
    if (options?.altKey) {
      await this.page.keyboard.up('Alt');
    }
    if (options?.shiftKey) {
      await this.page.keyboard.up('Shift');
    }
    await this.page.waitForTimeout(DBLCLICK_CLEAR_MS);
  }

  /** Perform a mouse wheel gesture centred on the canvas. */
  async wheelAtCenter(deltaY: number): Promise<void> {
    const box = await this.canvas.boundingBox();
    if (!box) {
      throw new Error('canvas has no bounding box');
    }
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.wheel(0, deltaY);
  }

  /** Cursor-centred zoom (spec §4): wheel with the pointer over a specific grid vertex. */
  async wheelAtGrid(gridX: number, gridY: number, deltaY: number): Promise<void> {
    const { x, y } = await this.gridToScreen(gridX, gridY);
    await this.page.mouse.move(x, y);
    await this.page.mouse.wheel(0, deltaY);
  }

  /** Middle-button drag pan (spec §4). */
  async middleDragPan(
    startX: number,
    startY: number,
    deltaX: number,
    deltaY: number
  ): Promise<void> {
    const box = await this.canvas.boundingBox();
    if (!box) {
      throw new Error('canvas has no bounding box');
    }
    await this.page.mouse.move(box.x + startX, box.y + startY);
    await this.page.mouse.down({ button: 'middle' });
    await this.page.mouse.move(box.x + startX + deltaX, box.y + startY + deltaY, { steps: 10 });
    await this.page.mouse.up({ button: 'middle' });
  }

  /** The current viewport transform (scale + offset). */
  async getViewport(): Promise<ViewportSnapshot> {
    return readViewport(this.page);
  }

  /** Wait until the canvas element is visible and has non-zero size. */
  async waitForCanvas(): Promise<void> {
    await this.canvas.waitFor({ state: 'visible', timeout: 30000 });
    await this.page.waitForFunction(
      () => {
        const canvas = document.querySelector('canvas');
        return canvas !== null && canvas.width > 0 && canvas.height > 0;
      },
      undefined,
      { timeout: 30000 }
    );
  }

  /** The canvas element's own Locator, for direct Playwright assertions. */
  getLocator(): Locator {
    return this.canvas;
  }
}
