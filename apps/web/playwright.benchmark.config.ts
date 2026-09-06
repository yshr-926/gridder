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
    baseURL: 'http://localhost:5199',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // A dedicated, unlikely-to-collide port: the default 5173 is commonly
    // held open by editor tooling (e.g. an IDE's own dev-server preview),
    // which `reuseExistingServer` would otherwise silently attach to.
    command: 'pnpm exec vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
});
