import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
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
