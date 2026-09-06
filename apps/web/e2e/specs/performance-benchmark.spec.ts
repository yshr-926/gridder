import { test, expect, type Page, type CDPSession } from '@playwright/test';
import { frameDurationsMs, percentile95, type TraceEvent } from '../../src/features/benchmark/frameTiming';

/**
 * Issue #57 — automated frame-time smoke measurement against the benchmark
 * fixture (spec §14: ~500 shapes / ~50,000 cells).
 *
 * This does not replace the manual DevTools Performance measurement in
 * `docs/performance.md` — it is not gated on the same pass/fail bar and is
 * not run in CI (see `docs/performance.md` §6). Its purpose is an early,
 * repeatable signal: if frame time regresses badly, this test's console
 * output (and its loose upper-bound assertions) should say so well before
 * someone runs the full manual measurement.
 *
 * It uses the Chrome DevTools Protocol's `Tracing` domain directly (not
 * Playwright's own `page.tracing`, which does not expose per-frame timing)
 * to capture `BeginFrame` / `DrawFrame` compositor events during a
 * sustained pan, zoom, move, and rectangle-resize gesture, matching spec
 * §14's "パン、ズーム、移動、矩形伸縮を継続的に操作できる".
 *
 * Requires the Vite dev server (the `?benchmark` fixture loader is
 * `import.meta.env.DEV`-only) — run via:
 *
 *   pnpm --filter @gridder/web exec playwright test \
 *     --config=playwright.benchmark.config.ts --project=chromium --grep "@issue-57"
 */

const GRID_SIZE = 20; // gridSettingsStore.basePixelSize default

/** Collects raw CDP trace events for the categories relevant to compositor frame timing. */
const captureTrace = async (
  cdp: CDPSession,
  during: () => Promise<void>
): Promise<readonly TraceEvent[]> => {
  const events: TraceEvent[] = [];
  // Playwright's CDPSession types `Tracing.dataCollected` payloads as loosely
  // as `{ value?: Record<string, string>[] }` (the raw protocol places no
  // stronger constraint on trace-event shape); every `DrawFrame` entry this
  // test cares about does carry `name` and `ts`, so a narrowing cast is safe
  // here without weakening `TraceEvent` itself to `unknown` fields.
  cdp.on('Tracing.dataCollected', (payload: { value?: readonly Record<string, unknown>[] }) => {
    if (Array.isArray(payload.value)) {
      events.push(...(payload.value as unknown as TraceEvent[]));
    }
  });

  const tracingComplete = new Promise<void>((resolve) => {
    cdp.once('Tracing.tracingComplete', () => resolve());
  });

  await cdp.send('Tracing.start', {
    categories: 'disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame',
    options: 'sampling-frequency=10000',
  });

  await during();

  await cdp.send('Tracing.end');
  await tracingComplete;

  return events;
};

const waitForBenchmarkFixture = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () =>
      Boolean(
        (window as unknown as { __GRIDDER_EDITOR_SESSION__?: { shapeCount: number } })
          .__GRIDDER_EDITOR_SESSION__?.shapeCount
      ),
    undefined,
    { timeout: 60000 }
  );
  await page.waitForFunction(
    () =>
      (
        window as unknown as { __GRIDDER_EDITOR_SESSION__: { shapeCount: number } }
      ).__GRIDDER_EDITOR_SESSION__.shapeCount > 0,
    undefined,
    { timeout: 60000 }
  );
};

test.describe('@issue-57 benchmark frame-time smoke', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (dialog) => {
      void dialog.dismiss();
    });
  });

  test('sustained pan, zoom, move, and resize stay within a loose frame-time bound', async ({
    page,
  }) => {
    await page.goto('/?benchmark=500');
    // The full 500-shape fixture (spec §14) takes noticeably longer to
    // generate and render on first load than a typical e2e page.
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 60000 });
    await waitForBenchmarkFixture(page);

    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error('canvas has no bounding box');
    }

    const cdp = await page.context().newCDPSession(page);

    const events = await captureTrace(cdp, async () => {
      // Pan: middle-drag across the canvas and back.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4, { steps: 10 });
      await page.mouse.move(box.x + (3 * box.width) / 4, box.y + (3 * box.height) / 4, { steps: 10 });
      await page.mouse.up({ button: 'middle' });

      // Zoom: wheel in and out over the canvas centre.
      for (let i = 0; i < 5; i += 1) {
        await page.mouse.wheel(0, -100);
      }
      for (let i = 0; i < 5; i += 1) {
        await page.mouse.wheel(0, 100);
      }

      // Move: drag one of the benchmark shapes (grid vertex (1,1) is inside
      // the first generated shape's bounding box regardless of shapeCount).
      const shapeX = box.x + 2 * GRID_SIZE;
      const shapeY = box.y + 2 * GRID_SIZE;
      await page.mouse.move(shapeX, shapeY);
      await page.mouse.down();
      await page.mouse.move(shapeX + 5 * GRID_SIZE, shapeY + 4 * GRID_SIZE, { steps: 15 });
      await page.mouse.up();

      // Rectangle resize: create a fresh rect, then drag its corner handle.
      const blankX = box.x + box.width - 4 * GRID_SIZE;
      const blankY = box.y + box.height - 4 * GRID_SIZE;
      await page.mouse.move(blankX, blankY);
      await page.mouse.down();
      await page.mouse.move(blankX + 3 * GRID_SIZE, blankY + 3 * GRID_SIZE, { steps: 8 });
      await page.mouse.up();
      await page.mouse.move(blankX + 3 * GRID_SIZE, blankY + 3 * GRID_SIZE);
      await page.mouse.down();
      await page.mouse.move(blankX + 6 * GRID_SIZE, blankY + 5 * GRID_SIZE, { steps: 10 });
      await page.mouse.up();
    });

    await cdp.detach();

    const durations = frameDurationsMs(events);
    const p95 = percentile95(durations);

    // eslint-disable-next-line no-console -- deliberate: this is the smoke
    // measurement's primary output, meant to be read from CI/local logs.
    console.log(
      `[issue-57] frames captured: ${durations.length}, p95 frame time: ${p95.toFixed(2)}ms ` +
        `(docs/performance.md pass bar: 16.7ms; this smoke test uses a looser bound — see file header)`
    );

    // A sanity floor, not the spec §14 pass bar: fail only on a clear
    // regression (no compositor frames captured at all, or frame time an
    // order of magnitude past the manual pass bar), so this stays usable as
    // an early warning without flaking on ordinary machine variance.
    expect(durations.length).toBeGreaterThan(0);
    expect(p95).toBeLessThan(160);
  });
});
