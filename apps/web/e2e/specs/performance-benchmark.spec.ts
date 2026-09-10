import { test, expect, type Page } from '@playwright/test';
import {
  FRAME_PROBE_GLOBAL,
  formatFrameProbeSummary,
  installFrameProbe,
  summarizeFrameProbe,
  type FrameProbeHandle,
  type FrameProbeSamples,
  type FrameProbeSummary,
} from '../../src/features/benchmark/frameProbe';

/**
 * Issue #57 / #61 — frame-time measurement against the benchmark fixture
 * (spec §14: ~500 shapes / ~50,000 cells) under *sustained* real gestures.
 *
 * This complements, not replaces, the manual DevTools Performance
 * measurement in `docs/performance.md` §5; it is not run in CI (§6). Its
 * job is a repeatable early-warning number for the four spec §14 gestures —
 * pan, zoom, shape move, rectangle resize — each driven continuously for a
 * fixed wall-clock duration, the way a user holds a drag, rather than for a
 * fixed number of pointer steps.
 *
 * Frame time is measured *inside the page* by `installFrameProbe`
 * (`src/features/benchmark/frameProbe.ts`): a `requestAnimationFrame` loop
 * whose callback interval is the frame time the user perceives. The earlier
 * version of this test read the compositor's `BeginFrame` trace events over
 * CDP, which tick at vsync even while the main thread is stalled and
 * therefore reported ~10 ms p95 for a page that was, in practice, too slow
 * to profile (issue #61).
 *
 * Requires the Vite dev server (the `?benchmark` fixture loader is
 * `import.meta.env.DEV`-only) — run via:
 *
 *   pnpm --filter @gridder/web exec playwright test \
 *     --config=playwright.benchmark.config.ts --project=chromium --grep "@issue-57"
 */

const GRID_SIZE = 20; // gridSettingsStore.basePixelSize default

/** How long each gesture is held, in ms. */
const GESTURE_DURATION_MS = Number(process.env.BENCH_GESTURE_MS ?? 2500);

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GridPointLike {
  x: number;
  y: number;
}

const waitForBenchmarkFixture = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () =>
      ((window as unknown as { __GRIDDER_EDITOR_SESSION__?: { shapeCount: number } })
        .__GRIDDER_EDITOR_SESSION__?.shapeCount ?? 0) > 0,
    undefined,
    { timeout: 60000 }
  );
};

/**
 * Wait until the page has produced `consecutive` back-to-back frames shorter
 * than `maxFrameMs`, so a gesture is measured on a settled page rather than
 * on the tail of the fixture's first render (which, before issue #61, could
 * stall the compositor for several seconds).
 */
const waitForSteadyFrames = async (
  page: Page,
  consecutive = 10,
  maxFrameMs = 50,
  timeoutMs = 30000
): Promise<void> => {
  await page.evaluate(
    ({ consecutive, maxFrameMs, timeoutMs }) =>
      new Promise<void>((resolve, reject) => {
        const startedAt = performance.now();
        let last = 0;
        let streak = 0;
        const tick = (): void => {
          const now = performance.now();
          if (last > 0) {
            streak = now - last < maxFrameMs ? streak + 1 : 0;
          }
          last = now;
          if (streak >= consecutive) {
            resolve();
            return;
          }
          if (now - startedAt > timeoutMs) {
            reject(new Error(`page never settled to ${consecutive} frames < ${maxFrameMs}ms`));
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { consecutive, maxFrameMs, timeoutMs }
  );
};

const resetViewport = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    (
      window as unknown as {
        __GRIDDER_VIEWPORT_STORE__: { getState: () => { resetViewport: () => void } };
      }
    ).__GRIDDER_VIEWPORT_STORE__
      .getState()
      .resetViewport();
  });
};

const clearSelection = async (page: Page): Promise<void> => {
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    (
      window as unknown as {
        __GRIDDER_SELECTION_STORE__?: { getState: () => { clear?: () => void } };
      }
    ).__GRIDDER_SELECTION_STORE__
      ?.getState()
      .clear?.();
  });
};

/**
 * Screen position of a grid vertex at the *current* viewport (the probe
 * gestures start from a reset viewport, so scale is 1 and offset is 0).
 */
const gridToScreen = (box: Box, point: GridPointLike): { x: number; y: number } => ({
  x: box.x + point.x * GRID_SIZE,
  y: box.y + point.y * GRID_SIZE,
});

/**
 * The first axis-aligned rectangle in z-order whose bounds fit on screen at
 * scale 1, so the resize gesture has a corner handle to grab.
 */
const findVisibleRect = async (
  page: Page,
  box: Box
): Promise<{ id: string; min: GridPointLike; max: GridPointLike }> => {
  const maxGridX = Math.floor(box.width / GRID_SIZE) - 2;
  const maxGridY = Math.floor(box.height / GRID_SIZE) - 2;
  const rect = await page.evaluate(
    ({ maxGridX, maxGridY }) => {
      type Ring = ReadonlyArray<{ x: number; y: number }>;
      const session = (
        window as unknown as {
          __GRIDDER_EDITOR_SESSION__: {
            getDocument: () => {
              zOrder: readonly string[];
              shapes: Record<
                string,
                { id: string; polygon: { outerRing: Ring; innerRings: readonly Ring[] } }
              >;
            };
          };
        }
      ).__GRIDDER_EDITOR_SESSION__;
      const document = session.getDocument();
      for (const id of document.zOrder) {
        const shape = document.shapes[id];
        if (shape === undefined || shape.polygon.innerRings.length > 0) {
          continue;
        }
        const ring = shape.polygon.outerRing;
        if (ring.length !== 4) {
          continue;
        }
        const xs = ring.map((p) => p.x);
        const ys = ring.map((p) => p.y);
        const min = { x: Math.min(...xs), y: Math.min(...ys) };
        const max = { x: Math.max(...xs), y: Math.max(...ys) };
        const isAxisAligned = ring.every(
          (p) => (p.x === min.x || p.x === max.x) && (p.y === min.y || p.y === max.y)
        );
        if (!isAxisAligned || min.x < 1 || min.y < 1 || max.x > maxGridX || max.y > maxGridY) {
          continue;
        }
        return { id, min, max };
      }
      return null;
    },
    { maxGridX, maxGridY }
  );
  if (rect === null) {
    throw new Error('benchmark fixture has no on-screen axis-aligned rectangle to resize');
  }
  return rect;
};

const probe = (page: Page) => ({
  start: () =>
    page.evaluate((key) => {
      (window as unknown as Record<string, FrameProbeHandle>)[key].start();
    }, FRAME_PROBE_GLOBAL),
  stop: () =>
    page.evaluate(
      (key) => (window as unknown as Record<string, FrameProbeHandle>)[key].stop(),
      FRAME_PROBE_GLOBAL
    ) as Promise<FrameProbeSamples>,
});

/** Run `gesture` under the probe, log its summary, and return it. */
const measure = async (
  page: Page,
  label: string,
  gesture: () => Promise<void>
): Promise<FrameProbeSummary> => {
  const frameProbe = probe(page);
  await frameProbe.start();
  await gesture();
  const samples = await frameProbe.stop();
  const summary = summarizeFrameProbe(samples);
  // eslint-disable-next-line no-console -- deliberate: this is the measurement's primary output.
  console.log(formatFrameProbeSummary(label, summary));
  return summary;
};

/**
 * Drag from `start`, sweeping the pointer back and forth by `amplitude`
 * pixels in `step`-pixel increments, until `durationMs` has elapsed. Each
 * `mouse.move` resolves once the renderer has processed the event, so a
 * stalled main thread shows up as fewer moves per second *and* as long
 * frames in the probe — the same way a real mouse's coalesced moves would.
 */
const sweepPointer = async (
  page: Page,
  start: { x: number; y: number },
  amplitude: { x: number; y: number },
  step: number,
  durationMs: number
): Promise<void> => {
  const startedAt = Date.now();
  let progress = 0;
  let direction = 1;
  const length = Math.hypot(amplitude.x, amplitude.y);
  while (Date.now() - startedAt < durationMs) {
    progress += (direction * step) / length;
    if (progress >= 1) {
      progress = 1;
      direction = -1;
    } else if (progress <= 0) {
      progress = 0;
      direction = 1;
    }
    await page.mouse.move(start.x + amplitude.x * progress, start.y + amplitude.y * progress);
  }
};

test.describe('@issue-57 benchmark frame-time measurement', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (dialog) => {
      void dialog.dismiss();
    });
  });

  test('sustained pan, zoom, move, and resize on the 500-shape fixture', async ({ page }) => {
    await page.goto('/?benchmark=500');
    const canvas = page.locator('[data-testid="grid-canvas-container"] canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 60000 });
    await waitForBenchmarkFixture(page);
    await page.evaluate(installFrameProbe);

    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error('canvas has no bounding box');
    }
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    // Let the initial render settle before the first gesture.
    await waitForSteadyFrames(page);

    // 1. Pan: middle-button drag, sweeping horizontally across half the canvas.
    await resetViewport(page);
    const pan = await measure(page, 'pan', async () => {
      await page.mouse.move(centre.x, centre.y);
      await page.mouse.down({ button: 'middle' });
      await sweepPointer(
        page,
        centre,
        { x: box.width / 2, y: box.height / 6 },
        8,
        GESTURE_DURATION_MS
      );
      await page.mouse.up({ button: 'middle' });
    });

    // 2. Zoom: wheel in and out over the canvas centre.
    await resetViewport(page);
    await waitForSteadyFrames(page);
    const zoom = await measure(page, 'zoom', async () => {
      await page.mouse.move(centre.x, centre.y);
      const startedAt = Date.now();
      let direction = -1;
      let ticks = 0;
      while (Date.now() - startedAt < GESTURE_DURATION_MS) {
        await page.mouse.wheel(0, direction * 100);
        ticks += 1;
        if (ticks % 12 === 0) {
          direction = -direction;
        }
      }
    });

    // 3. Move: drag a rectangle by its interior, sweeping diagonally.
    await resetViewport(page);
    await clearSelection(page);
    await waitForSteadyFrames(page);
    const rect = await findVisibleRect(page, box);
    const rectCentre = gridToScreen(box, {
      x: (rect.min.x + rect.max.x) / 2,
      y: (rect.min.y + rect.max.y) / 2,
    });
    const move = await measure(page, 'move', async () => {
      await page.mouse.move(rectCentre.x, rectCentre.y);
      await page.mouse.down();
      await sweepPointer(
        page,
        rectCentre,
        { x: 8 * GRID_SIZE, y: 6 * GRID_SIZE },
        6,
        GESTURE_DURATION_MS
      );
      await page.mouse.up();
    });
    await page.keyboard.press('Control+z');

    // 4. Resize: select the same rectangle, then drag its bottom-right handle.
    await resetViewport(page);
    await clearSelection(page);
    await page.mouse.click(rectCentre.x, rectCentre.y);
    await waitForSteadyFrames(page);
    const corner = gridToScreen(box, rect.max);
    const resize = await measure(page, 'resize', async () => {
      await page.mouse.move(corner.x, corner.y);
      await page.mouse.down();
      await sweepPointer(
        page,
        corner,
        { x: 5 * GRID_SIZE, y: 4 * GRID_SIZE },
        6,
        GESTURE_DURATION_MS
      );
      await page.mouse.up();
    });
    await page.keyboard.press('Control+z');

    for (const summary of [pan, zoom, move, resize]) {
      expect(summary.frameCount).toBeGreaterThan(0);
    }
    // Sanity ceilings, not the docs/performance.md §4 pass bar (16.7 ms /
    // 50 ms): fail only on a clear regression an order of magnitude past it,
    // so the test stays usable as an early warning without flaking on
    // ordinary machine variance. Read the logged summaries for the real numbers.
    const ceilingMs = Number(process.env.BENCH_FRAME_CEILING_MS ?? 160);
    for (const summary of [pan, zoom, move, resize]) {
      expect(summary.frameP95Ms).toBeLessThan(ceilingMs);
    }
  });
});
