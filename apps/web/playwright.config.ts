import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Gridder
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  // issue #57's frame-time smoke needs the Vite dev server (its `?benchmark`
  // fixture loader is `import.meta.env.DEV`-only, a no-op against this
  // config's production preview build) and runs only through its own
  // `playwright.benchmark.config.ts` — excluded here so the main suite
  // never picks it up and blocks on its `DEV`-only fixture.
  testIgnore: '**/performance-benchmark.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  globalSetup: './e2e/global-setup.ts',

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // 第一リリースの必須環境は Chromium 系デスクトップブラウザ（spec §2）。
  // Firefox / WebKit は後続対応（issue #58）: 設定は残すが、デフォルトの
  // `pnpm test:e2e` では実行しない — 個別に `--project=firefox` 等を指定する。
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    // CI環境ではビルド済みのため preview のみ、ローカルではビルドも実行。
    // VITE_E2E=true で window.__GRIDDER_* デバッグ公開を E2E ビルドだけに限定する（#45）。
    command: process.env.CI
      ? 'pnpm run preview'
      : 'VITE_E2E=true pnpm run build && pnpm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  },
});
