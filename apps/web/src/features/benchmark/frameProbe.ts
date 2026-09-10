/**
 * In-page frame-time probe for the issue #57 / #61 benchmark measurement
 * (`apps/web/e2e/specs/performance-benchmark.spec.ts`).
 *
 * Why not the Chrome DevTools Protocol's `BeginFrame` trace events (the
 * approach this replaced, issue #61): the compositor emits one `BeginFrame`
 * per vsync whether or not the main thread produced a new frame, so a page
 * whose main thread is blocked for hundreds of milliseconds still reports a
 * ~16 ms `BeginFrame` cadence. That is how the earlier smoke test reported a
 * p95 of 10 ms for a page that was, on a real machine, too slow to profile.
 *
 * This probe instead runs a `requestAnimationFrame` loop *inside the page*:
 * a callback only fires when the main thread is free to run a frame, so the
 * interval between consecutive callbacks is the frame time the user actually
 * perceives (spec §14 "実機のフレーム時間"). It also records, per frame, the
 * age of the oldest pointer / wheel event that arrived since the previous
 * frame — a proxy for docs/performance.md §3.2's input latency ("pointer-down
 * から描画まで") — and any Long Tasks the browser reports.
 *
 * `installFrameProbe` runs in the browser via `page.evaluate`, so it must be
 * fully self-contained (no imports, no closures over module scope). The
 * aggregation (`summarizeFrameProbe`) is a pure function that runs in the
 * test process and gets ordinary Vitest coverage.
 */

/** Raw samples collected by the in-page probe between `start()` and `stop()`. */
export interface FrameProbeSamples {
  /** Consecutive `requestAnimationFrame` callback intervals, in ms. */
  readonly frameIntervalsMs: readonly number[];
  /**
   * For every frame that had at least one pointer / wheel event queued since
   * the previous frame: the elapsed time from the oldest such event's
   * `timeStamp` to that frame's callback, in ms.
   */
  readonly inputToFrameMs: readonly number[];
  /** Durations of Long Task entries (`PerformanceObserver`, ≥ 50 ms), in ms. */
  readonly longTasksMs: readonly number[];
  /** Number of pointer / wheel events seen while the probe was running. */
  readonly inputEventCount: number;
  /** Wall-clock span of the capture, in ms. */
  readonly elapsedMs: number;
}

/** What the probe exposes on `window.__GRIDDER_FRAME_PROBE__`. */
export interface FrameProbeHandle {
  start: () => void;
  stop: () => FrameProbeSamples;
}

export const FRAME_PROBE_GLOBAL = '__GRIDDER_FRAME_PROBE__';

/**
 * Install the probe on `window`. Self-contained so Playwright can serialise it
 * with `page.evaluate(installFrameProbe)`.
 */
export const installFrameProbe = (): void => {
  let rafId = 0;
  let lastFrameAt = 0;
  let startedAt = 0;
  let frameIntervalsMs: number[] = [];
  let inputToFrameMs: number[] = [];
  let longTasksMs: number[] = [];
  let pendingInputs: number[] = [];
  let inputEventCount = 0;
  let observer: PerformanceObserver | null = null;

  const onInput = (event: Event): void => {
    inputEventCount += 1;
    pendingInputs.push(event.timeStamp);
  };

  const tick = (): void => {
    const now = performance.now();
    if (lastFrameAt > 0) {
      frameIntervalsMs.push(now - lastFrameAt);
    }
    lastFrameAt = now;
    if (pendingInputs.length > 0) {
      let oldest = pendingInputs[0];
      for (const stamp of pendingInputs) {
        if (stamp < oldest) {
          oldest = stamp;
        }
      }
      inputToFrameMs.push(Math.max(0, now - oldest));
      pendingInputs = [];
    }
    rafId = requestAnimationFrame(tick);
  };

  const handle = {
    start: (): void => {
      frameIntervalsMs = [];
      inputToFrameMs = [];
      longTasksMs = [];
      pendingInputs = [];
      inputEventCount = 0;
      lastFrameAt = 0;
      startedAt = performance.now();
      window.addEventListener('pointermove', onInput, true);
      window.addEventListener('pointerdown', onInput, true);
      window.addEventListener('wheel', onInput, true);
      if (typeof PerformanceObserver !== 'undefined') {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            longTasksMs.push(entry.duration);
          }
        });
        try {
          observer.observe({ type: 'longtask', buffered: false });
        } catch {
          observer = null;
        }
      }
      rafId = requestAnimationFrame(tick);
    },
    stop: () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onInput, true);
      window.removeEventListener('pointerdown', onInput, true);
      window.removeEventListener('wheel', onInput, true);
      observer?.disconnect();
      observer = null;
      return {
        frameIntervalsMs,
        inputToFrameMs,
        longTasksMs,
        inputEventCount,
        elapsedMs: performance.now() - startedAt,
      };
    },
  };

  (window as unknown as Record<string, unknown>)['__GRIDDER_FRAME_PROBE__'] = handle;
};

/** Aggregated view of one gesture's samples. */
export interface FrameProbeSummary {
  readonly frameCount: number;
  readonly frameP95Ms: number;
  readonly frameMaxMs: number;
  readonly inputToFrameP95Ms: number;
  readonly inputToFrameMaxMs: number;
  readonly longTaskCount: number;
  readonly longTaskMaxMs: number;
  readonly inputEventCount: number;
  /** Input events processed per second — collapses when the main thread stalls. */
  readonly inputEventsPerSecond: number;
}

/**
 * p95 using the nearest-rank method (sort ascending, take the value at
 * `ceil(0.95 * n) - 1`). `NaN` for an empty input.
 */
export const percentile95 = (values: readonly number[]): number => {
  if (values.length === 0) {
    return NaN;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
};

const maxOf = (values: readonly number[]): number =>
  values.length === 0 ? NaN : values.reduce((best, value) => (value > best ? value : best));

export const summarizeFrameProbe = (samples: FrameProbeSamples): FrameProbeSummary => ({
  frameCount: samples.frameIntervalsMs.length,
  frameP95Ms: percentile95(samples.frameIntervalsMs),
  frameMaxMs: maxOf(samples.frameIntervalsMs),
  inputToFrameP95Ms: percentile95(samples.inputToFrameMs),
  inputToFrameMaxMs: maxOf(samples.inputToFrameMs),
  longTaskCount: samples.longTasksMs.length,
  longTaskMaxMs: samples.longTasksMs.length === 0 ? 0 : maxOf(samples.longTasksMs),
  inputEventCount: samples.inputEventCount,
  inputEventsPerSecond:
    samples.elapsedMs > 0 ? (samples.inputEventCount * 1000) / samples.elapsedMs : 0,
});

const fmt = (value: number): string => (Number.isNaN(value) ? 'n/a' : value.toFixed(1));

/** One-line, log-friendly rendering of a summary. */
export const formatFrameProbeSummary = (label: string, summary: FrameProbeSummary): string =>
  `[benchmark] ${label}: frames=${summary.frameCount} ` +
  `frame p95=${fmt(summary.frameP95Ms)}ms max=${fmt(summary.frameMaxMs)}ms | ` +
  `input→frame p95=${fmt(summary.inputToFrameP95Ms)}ms max=${fmt(summary.inputToFrameMaxMs)}ms | ` +
  `long tasks=${summary.longTaskCount} (max ${fmt(summary.longTaskMaxMs)}ms) | ` +
  `inputs=${summary.inputEventCount} (${summary.inputEventsPerSecond.toFixed(1)}/s)`;
