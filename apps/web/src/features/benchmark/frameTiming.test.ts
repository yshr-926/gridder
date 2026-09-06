import { describe, expect, it } from 'vitest';
import { frameDurationsMs, percentile95, type TraceEvent } from './frameTiming';

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
    const values = [5, 1, 4, 2, 3];
    // n=5: ceil(0.95*5)-1 = 4 (0-indexed) -> max value.
    expect(percentile95(values)).toBe(5);
  });

  it('test_percentile95_allEqualValues_returnsThatValue', () => {
    expect(percentile95([10, 10, 10, 10])).toBe(10);
  });
});

describe('frameDurationsMs', () => {
  const beginFrame = (ts: number): TraceEvent => ({ name: 'BeginFrame', ts });

  it('test_frameDurationsMs_noEvents_returnsEmptyArray', () => {
    expect(frameDurationsMs([])).toEqual([]);
  });

  it('test_frameDurationsMs_singleFrame_returnsEmptyArray', () => {
    expect(frameDurationsMs([beginFrame(1000)])).toEqual([]);
  });

  it('test_frameDurationsMs_multipleFrames_convertsMicrosecondGapsToMilliseconds', () => {
    // 16000us and 20000us gaps -> 16ms and 20ms.
    const events = [beginFrame(0), beginFrame(16000), beginFrame(36000)];
    expect(frameDurationsMs(events)).toEqual([16, 20]);
  });

  it('test_frameDurationsMs_defaultsToBeginFrame_ignoringOtherEventNames', () => {
    const events: TraceEvent[] = [
      beginFrame(0),
      { name: 'DrawFrame', ts: 5000 },
      { name: 'RunTask', ts: 8000 },
      beginFrame(16000),
    ];
    expect(frameDurationsMs(events)).toEqual([16]);
  });

  it('test_frameDurationsMs_outOfOrderEvents_sortsByTimestampFirst', () => {
    const events = [beginFrame(32000), beginFrame(0), beginFrame(16000)];
    expect(frameDurationsMs(events)).toEqual([16, 16]);
  });

  it('test_frameDurationsMs_customFrameEventName_filtersByThatNameInstead', () => {
    const events: TraceEvent[] = [
      { name: 'DrawFrame', ts: 0 },
      { name: 'DrawFrame', ts: 20000 },
      beginFrame(5000), // must be ignored when filtering for 'DrawFrame'
    ];
    expect(frameDurationsMs(events, 'DrawFrame')).toEqual([20]);
  });
});
