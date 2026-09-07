import { describe, expect, it } from 'vitest';
import {
  formatFrameProbeSummary,
  percentile95,
  summarizeFrameProbe,
  type FrameProbeSamples,
} from './frameProbe';

const samples = (overrides: Partial<FrameProbeSamples> = {}): FrameProbeSamples => ({
  frameIntervalsMs: [],
  inputToFrameMs: [],
  longTasksMs: [],
  inputEventCount: 0,
  elapsedMs: 0,
  ...overrides,
});

describe('percentile95', () => {
  it('test_percentile95_emptyArray_returnsNaN', () => {
    expect(Number.isNaN(percentile95([]))).toBe(true);
  });

  it('test_percentile95_singleValue_returnsThatValue', () => {
    expect(percentile95([42])).toBe(42);
  });

  it('test_percentile95_sortedInput_matchesNearestRankExpectation', () => {
    // 20 values 1..20: ceil(0.95 * 20) - 1 = 18 (0-indexed) -> value 19.
    const values = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(percentile95(values)).toBe(19);
  });

  it('test_percentile95_unsortedInput_sortsBeforeComputing', () => {
    // n=5: ceil(0.95*5)-1 = 4 (0-indexed) -> max value.
    expect(percentile95([5, 1, 4, 2, 3])).toBe(5);
  });
});

describe('summarizeFrameProbe', () => {
  it('test_summarizeFrameProbe_noSamples_reportsNaNAndZeroCounts', () => {
    const summary = summarizeFrameProbe(samples());
    expect(summary.frameCount).toBe(0);
    expect(Number.isNaN(summary.frameP95Ms)).toBe(true);
    expect(Number.isNaN(summary.frameMaxMs)).toBe(true);
    expect(summary.longTaskCount).toBe(0);
    expect(summary.longTaskMaxMs).toBe(0);
    expect(summary.inputEventsPerSecond).toBe(0);
  });

  it('test_summarizeFrameProbe_frames_reportsP95AndMax', () => {
    const summary = summarizeFrameProbe(
      samples({ frameIntervalsMs: [16, 17, 16, 250, 16, 16, 16, 16, 16, 16] })
    );
    expect(summary.frameCount).toBe(10);
    // n=10: ceil(9.5)-1 = 9 -> the largest value.
    expect(summary.frameP95Ms).toBe(250);
    expect(summary.frameMaxMs).toBe(250);
  });

  it('test_summarizeFrameProbe_inputs_reportsLatencyAndRate', () => {
    const summary = summarizeFrameProbe(
      samples({
        inputToFrameMs: [5, 80, 10],
        longTasksMs: [60, 120],
        inputEventCount: 90,
        elapsedMs: 3000,
      })
    );
    expect(summary.inputToFrameP95Ms).toBe(80);
    expect(summary.inputToFrameMaxMs).toBe(80);
    expect(summary.longTaskCount).toBe(2);
    expect(summary.longTaskMaxMs).toBe(120);
    expect(summary.inputEventsPerSecond).toBe(30);
  });
});

describe('formatFrameProbeSummary', () => {
  it('test_formatFrameProbeSummary_rendersLabelAndNaNAsNa', () => {
    const line = formatFrameProbeSummary('pan', summarizeFrameProbe(samples()));
    expect(line).toContain('[benchmark] pan:');
    expect(line).toContain('frame p95=n/a');
  });
});
