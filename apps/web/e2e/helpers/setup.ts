import { test as base, expect } from '@playwright/test';
import { AppPage } from '../pages';
import { CanvasHelper } from './canvas';

/**
 * Custom test fixtures for Gridder E2E tests
 */
interface TestFixtures {
  /** AppPage instance for page object model */
  app: AppPage;
  /** Legacy appPage alias (for backward compatibility) */
  appPage: AppPage;
  /** CanvasHelper instance for grid operations */
  canvasHelper: CanvasHelper;
}

/**
 * Extended test with custom fixtures
 */
export const test = base.extend<TestFixtures>({
  app: async ({ page }, use) => {
    const app = new AppPage(page);
    await app.goto();
    await app.clearLocalStorage();
    await page.reload();
    // Wait for the page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    // Try to wait for canvas, but don't fail if it takes time
    try {
      await app.waitForCanvasReady();
    } catch {
      // Canvas might not be ready, continue anyway for basic tests
      console.warn('Canvas not ready, continuing with test');
    }
    await use(app);
  },

  appPage: async ({ page }, use) => {
    // Legacy alias for backward compatibility
    const appPage = new AppPage(page);
    await appPage.goto();
    // Wait for the page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    // Try to wait for canvas, but don't fail if it takes time
    try {
      await appPage.waitForCanvasReady();
    } catch {
      // Canvas might not be ready, continue anyway for basic tests
      console.warn('Canvas not ready, continuing with test');
    }
    await use(appPage);
  },

  canvasHelper: async ({ page }, use) => {
    const helper = new CanvasHelper(page);
    await use(helper);
  },
});

export { expect };

/**
 * Test data constants
 */
export const TEST_DATA = {
  defaultCellSize: 10,
  defaultUnit: 'cm',
  testColor: '#333333',
  alternateColor: '#555555',
  defaultGridSize: 20,
} as const;

/**
 * Common timeout values for tests
 */
export const TIMEOUTS = {
  /** Short wait for UI updates */
  short: 100,
  /** Medium wait for animations */
  medium: 500,
  /** Long wait for operations */
  long: 1000,
  /** Extended wait for slow operations */
  extended: 5000,
} as const;

/**
 * Wait for a specific duration (use sparingly)
 */
export const waitFor = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for animation frame
 */
export const waitForAnimationFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Retry a function until it succeeds or times out
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  predicate: (result: T) => boolean,
  options?: { timeout?: number; interval?: number }
): Promise<T> {
  const { timeout = 5000, interval = 100 } = options ?? {};
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await fn();
    if (predicate(result)) {
      return result;
    }
    await waitFor(interval);
  }

  throw new Error(`Retry timed out after ${timeout}ms`);
}
