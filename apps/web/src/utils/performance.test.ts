import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FPSMeter,
  DragLatencyMeter,
  throttle,
  throttleMouseMove,
  debounce,
  debounceResize,
  debounceAutoSave,
  memoize,
} from './performance';

describe('performance utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('FPSMeter', () => {
    it('should start with 60fps', () => {
      const meter = new FPSMeter();
      expect(meter.getFPS()).toBe(60);
    });

    it('should calculate FPS after 1 second', () => {
      const meter = new FPSMeter();

      // Simulate 60 frames over 1 second
      for (let i = 0; i < 60; i++) {
        vi.advanceTimersByTime(16);
        meter.update();
      }

      // After ~1 second with 60 frames, FPS should be close to 60
      const fps = meter.getFPS();
      expect(fps).toBeGreaterThanOrEqual(55);
      expect(fps).toBeLessThanOrEqual(65);
    });

    it('should reset correctly', () => {
      const meter = new FPSMeter();

      // Advance time and update
      vi.advanceTimersByTime(1000);
      meter.update();

      // Reset
      meter.reset();
      expect(meter.getFPS()).toBe(60);
    });
  });

  describe('DragLatencyMeter', () => {
    it('should start with 0 average latency', () => {
      const meter = new DragLatencyMeter();
      expect(meter.getAverageLatency()).toBe(0);
      expect(meter.getSampleCount()).toBe(0);
    });

    it('should record latency between start and end', () => {
      const meter = new DragLatencyMeter();

      meter.start();
      vi.advanceTimersByTime(10);
      meter.end();

      expect(meter.getSampleCount()).toBe(1);
      expect(meter.getAverageLatency()).toBeCloseTo(10, 0);
    });

    it('should calculate average of multiple samples', () => {
      const meter = new DragLatencyMeter();

      // Record 10ms latency
      meter.start();
      vi.advanceTimersByTime(10);
      meter.end();

      // Record 20ms latency
      meter.start();
      vi.advanceTimersByTime(20);
      meter.end();

      expect(meter.getSampleCount()).toBe(2);
      expect(meter.getAverageLatency()).toBeCloseTo(15, 0);
    });

    it('should track min and max latency', () => {
      const meter = new DragLatencyMeter();

      meter.start();
      vi.advanceTimersByTime(5);
      meter.end();

      meter.start();
      vi.advanceTimersByTime(25);
      meter.end();

      meter.start();
      vi.advanceTimersByTime(15);
      meter.end();

      expect(meter.getMinLatency()).toBeCloseTo(5, 0);
      expect(meter.getMaxLatency()).toBeCloseTo(25, 0);
    });

    it('should respect maxSamples limit', () => {
      const meter = new DragLatencyMeter(3);

      for (let i = 0; i < 5; i++) {
        meter.start();
        vi.advanceTimersByTime(10 * (i + 1));
        meter.end();
      }

      expect(meter.getSampleCount()).toBe(3);
    });

    it('should reset correctly', () => {
      const meter = new DragLatencyMeter();

      meter.start();
      vi.advanceTimersByTime(10);
      meter.end();

      meter.reset();

      expect(meter.getSampleCount()).toBe(0);
      expect(meter.getAverageLatency()).toBe(0);
    });

    it('should ignore end without start', () => {
      const meter = new DragLatencyMeter();

      meter.end();

      expect(meter.getSampleCount()).toBe(0);
    });
  });

  describe('throttle', () => {
    it('should execute function immediately on first call', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not execute function again within limit', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should execute function again after limit has passed', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      vi.advanceTimersByTime(101);
      throttled();

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to the function', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('arg1', 'arg2');

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should execute trailing call after limit', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('first');
      // First call executes immediately
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('first');

      // These calls are within the limit, so they queue a trailing call
      throttled('second');
      expect(fn).toHaveBeenCalledTimes(1);

      // Advance time to trigger the trailing call
      vi.advanceTimersByTime(101);

      // The last queued call ('second') should execute
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('second');
    });
  });

  describe('throttleMouseMove', () => {
    it('should throttle at 60fps (16ms)', () => {
      const fn = vi.fn();
      const throttled = throttleMouseMove(fn);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(17);
      throttled();

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('debounce', () => {
    it('should not execute function immediately', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();

      expect(fn).not.toHaveBeenCalled();
    });

    it('should execute function after wait time', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      vi.advanceTimersByTime(101);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on subsequent calls', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      vi.advanceTimersByTime(50);
      debounced();
      vi.advanceTimersByTime(50);
      debounced();
      vi.advanceTimersByTime(101);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the function', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1', 'arg2');
      vi.advanceTimersByTime(101);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should have a cancel method', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced.cancel();
      vi.advanceTimersByTime(101);

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('debounceResize', () => {
    it('should debounce at 150ms', () => {
      const fn = vi.fn();
      const debounced = debounceResize(fn);

      debounced();
      vi.advanceTimersByTime(100);

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(51);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('debounceAutoSave', () => {
    it('should debounce at 1000ms', () => {
      const fn = vi.fn();
      const debounced = debounceAutoSave(fn);

      debounced();
      vi.advanceTimersByTime(500);

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(501);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('memoize', () => {
    it('should return cached result for same arguments', () => {
      const fn = vi.fn((a: number, b: number) => a + b);
      const memoized = memoize(fn);

      const result1 = memoized(1, 2);
      const result2 = memoized(1, 2);

      expect(result1).toBe(3);
      expect(result2).toBe(3);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should compute new result for different arguments', () => {
      const fn = vi.fn((a: number, b: number) => a + b);
      const memoized = memoize(fn);

      const result1 = memoized(1, 2);
      const result2 = memoized(3, 4);

      expect(result1).toBe(3);
      expect(result2).toBe(7);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use custom key function', () => {
      const fn = vi.fn((obj: { id: number }) => obj.id * 2);
      const memoized = memoize(fn, (obj) => String(obj.id));

      const result1 = memoized({ id: 1 });
      const result2 = memoized({ id: 1 });

      expect(result1).toBe(2);
      expect(result2).toBe(2);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
