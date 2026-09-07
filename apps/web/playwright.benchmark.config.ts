import { defineConfig, devices } from '@playwright/test';

/**
 * Standalone Playwright config for issue #57's frame-time smoke measurement.
 *
 * The benchmark fixture loader (`?benchmark` query parameter) is restricted
 * to `import.meta.env.DEV` (`apps/web/src/features/benchmark/loadBenchmarkFromQuery.ts`)
 * so it never reaches a production bundle. The main `playwright.config.ts`
 * runs against a production preview build (`pnpm run preview`), where that
 * query parameter would be a no-op — so this config points at the Vite dev
 * server instead, and is otherwise unrelated to the main e2e suite (it does
 * not run in CI; see docs/performance.md §6).
 *
 * Usage:
 *   pnpm --filter @gridder/web exec playwright test \
 *     --config=playwright.benchmark.config.ts --project=chromium --grep "@issue-57"
 */
export default defineConfig({
  testDir: './e2e/specs',
  testMatch: 'performance-benchmark.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  // The full 500-shape fixture (spec §14) takes noticeably longer than a
  // typical e2e test to generate and render on first load; give this
  // single, non-CI smoke test generous headroom rather than tuning it away.
  timeout: 120_000,

  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:5299',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      // Measure in the installed Google Chrome, headed, to match the
      // docs/performance.md §1 target environment (DevTools-style numbers).
      // `BENCH_HEADLESS=1` switches to headless for unattended runs, and
      // `BENCH_BROWSER=chromium` falls back to Playwright's bundled Chromium
      // when Chrome is not installed.
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.BENCH_BROWSER === 'chromium' ? undefined : 'chrome',
        headless: process.env.BENCH_HEADLESS === '1',
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          // A headed window that ends up behind other windows is treated as
          // occluded by Chrome and its `requestAnimationFrame` stops firing,
          // which would read as "zero frames" rather than as slow frames.
          args: [
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-background-timer-throttling',
          ],
        },
      },
    },
  ],

  webServer: {
    // A dedicated, unlikely-to-collide port: the default 5173 is commonly
    // held open by editor tooling (e.g. an IDE's own dev-server preview),
    // which `reuseExistingServer` would otherwise silently attach to.
    //
    // `BENCH_TARGET=preview` measures a production-optimised bundle instead
    // of the Vite dev server (issue #61): the React development build's
    // per-element bookkeeping (`jsxDEV` owner stacks) dominated the React
    // share of a zoom frame in profiles, so dev-server numbers overstate
    // the React cost. The `?benchmark` loader is enabled for the
    // `VITE_E2E=true` build for exactly this purpose. Set
    // `BENCH_SKIP_BUILD=1` to reuse an existing `dist/`.
    command:
      process.env.BENCH_TARGET === 'preview'
        ? `${process.env.BENCH_SKIP_BUILD === '1' ? '' : 'VITE_E2E=true pnpm run build && '}pnpm exec vite preview --port 5299 --strictPort`
        : 'pnpm exec vite --port 5299 --strictPort',
    url: 'http://localhost:5299',
    reuseExistingServer: !process.env.CI,
    timeout: 240 * 1000,
  },
});
