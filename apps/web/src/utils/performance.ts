/**
 * Performance utilities for optimizing canvas operations
 * @module utils/performance
 */

/**
 * Creates a throttled version of a function that only executes at most once per specified interval
 * Optimized for 60fps (16ms) mouse move operations
 *
 * @param fn - Function to throttle
 * @param limit - Time limit in milliseconds (default: 16ms for 60fps)
 * @returns Throttled function
 */
export const throttle = <T extends (...args: Parameters<T>) => void>(
  fn: T,
  limit: number = 16
): T => {
  let lastCall = 0;
  let lastCallTimer: ReturnType<typeof setTimeout> | null = null;

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = limit - (now - lastCall);

    if (remaining <= 0) {
      if (lastCallTimer) {
        clearTimeout(lastCallTimer);
        lastCallTimer = null;
      }
      lastCall = now;
      fn(...args);
    } else if (!lastCallTimer) {
      lastCallTimer = setTimeout(() => {
        lastCall = Date.now();
        lastCallTimer = null;
        fn(...args);
      }, remaining);
    }
  };

  return throttled as T;
};

/**
 * Creates a throttled function specifically for mouse move events (60fps)
 *
 * @param fn - Mouse move handler function
 * @returns Throttled function running at 60fps
 */
export const throttleMouseMove = <T extends (...args: Parameters<T>) => void>(
  fn: T
): T => {
  return throttle(fn, 16); // 60fps = 1000ms / 60 = ~16ms
};

/**
 * Creates a debounced version of a function that delays execution until after
 * the specified wait time has elapsed since the last call
 *
 * @param fn - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function with cancel method
 */
export const debounce = <T extends (...args: Parameters<T>) => void>(
  fn: T,
  wait: number
): T & { cancel: () => void } => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced as T & { cancel: () => void };
};

/**
 * Creates a debounced function specifically for resize events
 * Default delay: 150ms
 *
 * @param fn - Resize handler function
 * @returns Debounced function
 */
export const debounceResize = <T extends (...args: Parameters<T>) => void>(
  fn: T
): T & { cancel: () => void } => {
  return debounce(fn, 150);
};

/**
 * Creates a debounced function specifically for auto-save operations
 * Default delay: 1000ms (1 second)
 *
 * @param fn - Auto-save handler function
 * @returns Debounced function
 */
export const debounceAutoSave = <T extends (...args: Parameters<T>) => void>(
  fn: T
): T & { cancel: () => void } => {
  return debounce(fn, 1000);
};

/**
 * Measures the execution time of a function
 * Useful for performance debugging
 *
 * @param name - Name to identify the measurement
 * @param fn - Function to measure
 * @returns Result of the function
 */
export const measurePerformance = <T>(name: string, fn: () => T): T => {
  const start = performance.now();
  const result = fn();
  const end = performance.now();

  if (import.meta.env.DEV) {
    console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
  }

  return result;
};

/**
 * Creates a memoized version of a function based on its arguments
 * Uses a simple cache with string keys
 *
 * @param fn - Function to memoize
 * @param keyFn - Function to generate cache key from arguments
 * @returns Memoized function
 */
export const memoize = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  keyFn: (...args: Parameters<T>) => string = (...args) => JSON.stringify(args)
): T => {
  const cache = new Map<string, ReturnType<T>>();

  const memoized = (...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn(...args);

    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };

  return memoized as T;
};

/**
 * Creates a function that batches multiple calls into a single execution
 * using requestAnimationFrame
 *
 * @param fn - Function to batch
 * @returns Batched function
 */
export const batchWithRAF = <T extends () => void>(fn: T): T => {
  let scheduled = false;

  const batched = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        fn();
      });
    }
  };

  return batched as T;
};
