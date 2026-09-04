/**
 * Performance utilities for optimizing canvas operations
 * @module utils/performance
 */

/**
 * FPS計測クラス
 * Canvas操作のフレームレートを測定する
 */
export class FPSMeter {
  private frames = 0;
  private lastTime = performance.now();
  private fps = 60;

  /**
   * フレームを更新し、FPSを計算
   * requestAnimationFrame のコールバック内で呼び出す
   * @returns 現在のFPS値
   */
  public update(): number {
    this.frames++;
    const currentTime = performance.now();
    const elapsed = currentTime - this.lastTime;

    if (elapsed >= 1000) {
      this.fps = Math.round((this.frames * 1000) / elapsed);
      this.frames = 0;
      this.lastTime = currentTime;
    }

    return this.fps;
  }

  /**
   * 現在のFPS値を取得
   * @returns 現在のFPS値
   */
  public getFPS(): number {
    return this.fps;
  }

  /**
   * 計測をリセット
   */
  public reset(): void {
    this.frames = 0;
    this.lastTime = performance.now();
    this.fps = 60;
  }
}

/**
 * ドラッグレイテンシ計測クラス
 * マウスイベントから描画までの遅延を測定する
 */
export class DragLatencyMeter {
  private startTime: number | null = null;
  private latencies: number[] = [];
  private maxSamples: number;

  /**
   * @param maxSamples 保持するサンプル数の上限（デフォルト: 100）
   */
  constructor(maxSamples: number = 100) {
    this.maxSamples = maxSamples;
  }

  /**
   * 計測を開始
   */
  public start(): void {
    this.startTime = performance.now();
  }

  /**
   * 計測を終了し、レイテンシを記録
   */
  public end(): void {
    if (this.startTime !== null) {
      const latency = performance.now() - this.startTime;
      this.latencies.push(latency);

      // サンプル数の上限を超えたら古いものを削除
      if (this.latencies.length > this.maxSamples) {
        this.latencies.shift();
      }

      this.startTime = null;
    }
  }

  /**
   * 平均レイテンシを取得
   * @returns 平均レイテンシ（ミリ秒）
   */
  public getAverageLatency(): number {
    if (this.latencies.length === 0) return 0;
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    return sum / this.latencies.length;
  }

  /**
   * 最大レイテンシを取得
   * @returns 最大レイテンシ（ミリ秒）
   */
  public getMaxLatency(): number {
    if (this.latencies.length === 0) return 0;
    return Math.max(...this.latencies);
  }

  /**
   * 最小レイテンシを取得
   * @returns 最小レイテンシ（ミリ秒）
   */
  public getMinLatency(): number {
    if (this.latencies.length === 0) return 0;
    return Math.min(...this.latencies);
  }

  /**
   * サンプル数を取得
   * @returns サンプル数
   */
  public getSampleCount(): number {
    return this.latencies.length;
  }

  /**
   * 計測をリセット
   */
  public reset(): void {
    this.latencies = [];
    this.startTime = null;
  }
}

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
