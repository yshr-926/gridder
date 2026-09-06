/**
 * Pure helpers for turning raw Chrome DevTools Protocol trace events into a
 * frame-time distribution (issue #57's automated smoke measurement,
 * `apps/web/e2e/specs/performance-benchmark.spec.ts`). Kept here, outside
 * `e2e/`, so they get ordinary Vitest coverage — the `e2e` directory is
 * excluded from both the Vitest and ESLint project config and only runs
 * under Playwright.
 */

export interface TraceEvent {
  readonly name: string;
  /** Trace timestamp in microseconds, as emitted by CDP's `Tracing` domain. */
  readonly ts: number;
  readonly cat?: string;
}

/**
 * p95 of a numeric array using the nearest-rank method: sort ascending and
 * take the value at `ceil(0.95 * n) - 1`. `NaN` for an empty input — the
 * caller decides whether that counts as a failure.
 */
export const percentile95 = (valuesMs: readonly number[]): number => {
  if (valuesMs.length === 0) {
    return NaN;
  }
  const sorted = [...valuesMs].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
};

/**
 * Frame-to-frame durations, in milliseconds, derived from compositor
 * `BeginFrame` trace events (Chrome's
 * `disabled-by-default-devtools.timeline.frame` category). Verified against
 * a real Chrome trace during this feature's development: the classic
 * `DrawFrame` event this was originally written against is no longer
 * emitted by current Chrome (it recorded `Graphics.Pipeline` /
 * `PipelineReporter` events instead), while `BeginFrame` — one event per
 * vsync-driven compositor frame — was present and matched the gesture
 * length exactly. Events are sorted by timestamp first since CDP's
 * `Tracing.dataCollected` payloads are not guaranteed to arrive in order.
 */
export const frameDurationsMs = (
  events: readonly TraceEvent[],
  frameEventName = 'BeginFrame'
): number[] => {
  const frameTimestamps = events
    .filter((event) => event.name === frameEventName)
    .map((event) => event.ts)
    .sort((a, b) => a - b);

  const durations: number[] = [];
  for (let i = 1; i < frameTimestamps.length; i += 1) {
    durations.push((frameTimestamps[i] - frameTimestamps[i - 1]) / 1000); // us -> ms
  }
  return durations;
};
