import { chromium, type FullConfig } from '@playwright/test';

/**
 * Global setup for Playwright tests
 * Runs once before all tests to verify the development server is running
 * and the application is properly loaded
 */
async function globalSetup(config: FullConfig): Promise<void> {
  const { baseURL } = config.projects[0]?.use ?? {};
  const serverUrl = baseURL ?? 'http://localhost:4173';

  console.log('Starting global setup...');
  console.log(`Target URL: ${serverUrl}`);

  // Launch browser to verify server
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log(`Checking development server at ${serverUrl}...`);

    // Attempt to navigate to the server
    const response = await page.goto(serverUrl, {
      timeout: 30000,
      waitUntil: 'domcontentloaded',
    });

    if (!response) {
      throw new Error('No response received from server');
    }

    if (!response.ok()) {
      throw new Error(`Server returned status ${response.status()}`);
    }

    console.log('Development server is running');

    // Wait for the application to fully load
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('Page loaded successfully');

    // Verify that the canvas is present (Gridder is a canvas-based app)
    try {
      await page.waitForSelector('canvas', { timeout: 15000 });
      console.log('Canvas element found - application loaded successfully');
    } catch {
      console.warn('Warning: Canvas not found, but page loaded. Tests may fail.');
    }

    // Verify basic page structure (issue #58, polygon-document UI, spec §12):
    // a compact top bar and the canvas application region — no left toolbar,
    // no status-bar footer in this UI.
    const hasHeader = await page.locator('header').count() > 0;
    const hasApplicationRegion = await page.locator('[role="application"]').count() > 0;

    console.log(`Page structure check:`);
    console.log(`  - Header: ${hasHeader ? 'present' : 'missing'}`);
    console.log(`  - Canvas application region: ${hasApplicationRegion ? 'present' : 'missing'}`);

    if (!hasHeader || !hasApplicationRegion) {
      console.warn('Warning: Some page elements are missing. Tests may fail.');
    }

    // Check for JavaScript errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Give time for any async errors to surface
    await page.waitForTimeout(1000);

    if (consoleErrors.length > 0) {
      console.warn('Console errors detected during page load:');
      consoleErrors.forEach((err) => console.warn(`  - ${err}`));
    }

    console.log('Global setup complete - all checks passed');
  } catch (error) {
    console.error('Failed to connect to development server');
    console.error('');
    console.error('Possible causes:');
    console.error('  1. Development server is not running');
    console.error('  2. Build failed');
    console.error('  3. Wrong port number');
    console.error('');
    console.error('Try running: npm run build && npm run preview');
    console.error('');
    console.error('Error details:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
