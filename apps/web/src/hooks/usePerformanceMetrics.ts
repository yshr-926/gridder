import { useRef, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import { isSentryInitialized } from '@/config/sentry';

/**
 * Performance measurement markers
 */
export const PERF_MARKERS = {
  CANVAS_RENDER: 'canvas-render',
  OBJECT_CREATE: 'object-create',
  OBJECT_UPDATE: 'object-update',
  EXPORT_IMAGE: 'export-image',
  EXPORT_JSON: 'export-json',
  IMPORT_JSON: 'import-json',
  UNDO: 'undo',
  REDO: 'redo',
} as const;

export type PerfMarker = (typeof PERF_MARKERS)[keyof typeof PERF_MARKERS];

/**
 * Performance threshold for warning (16.67ms = 60fps)
 */
const FRAME_BUDGET_MS = 16.67;

/**
 * Hook for measuring custom performance metrics
 */
export const usePerformanceMetrics = () => {
  const metricsRef = useRef<Map<string, number>>(new Map());

  /**
   * Start a performance measurement
   */
  const startMeasure = useCallback((name: string): void => {
    performance.mark(`${name}-start`);
    metricsRef.current.set(name, performance.now());
  }, []);

  /**
   * End a performance measurement and return duration
   */
  const endMeasure = useCallback((name: string): number | null => {
    const startTime = metricsRef.current.get(name);
    if (startTime === undefined) return null;

    performance.mark(`${name}-end`);

    try {
      performance.measure(name, `${name}-start`, `${name}-end`);
      const entries = performance.getEntriesByName(name);
      const duration = entries[entries.length - 1]?.duration ?? 0;

      // Send to Sentry if initialized
      if (isSentryInitialized()) {
        Sentry.setMeasurement(name, duration, 'millisecond');
      }

      // Log in development
      if (import.meta.env.DEV) {
        const color = duration > FRAME_BUDGET_MS ? '#ef4444' : '#22c55e';
        console.log(
          `%c[Perf] ${name}: ${duration.toFixed(2)}ms`,
          `color: ${color}; font-weight: bold;`
        );
      }

      // Cleanup
      performance.clearMarks(`${name}-start`);
      performance.clearMarks(`${name}-end`);
      performance.clearMeasures(name);
      metricsRef.current.delete(name);

      return duration;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Performance measurement error:', error);
      }
      return null;
    }
  }, []);

  /**
   * Measure frame rate over a duration
   */
  const measureFrameRate = useCallback((duration: number = 1000): Promise<number> => {
    return new Promise((resolve) => {
      let frameCount = 0;
      const startTime = performance.now();

      const countFrame = (): void => {
        frameCount++;
        if (performance.now() - startTime < duration) {
          requestAnimationFrame(countFrame);
        } else {
          const fps = (frameCount / duration) * 1000;

          if (import.meta.env.DEV) {
            const color = fps >= 55 ? '#22c55e' : fps >= 30 ? '#eab308' : '#ef4444';
            console.log(`%c[Perf] FPS: ${fps.toFixed(1)}`, `color: ${color}; font-weight: bold;`);
          }

          resolve(fps);
        }
      };

      requestAnimationFrame(countFrame);
    });
  }, []);

  return {
    startMeasure,
    endMeasure,
    measureFrameRate,
  };
};

/**
 * Performance data for canvas rendering
 */
interface CanvasPerformanceData {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
}

/**
 * Hook specifically for Canvas rendering performance monitoring
 */
export const useCanvasPerformance = () => {
  const { startMeasure, endMeasure, measureFrameRate } = usePerformanceMetrics();
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(0);
  const renderTimesRef = useRef<number[]>([]);
  const maxSamplesRef = useRef(100);

  /**
   * Mark the start of a canvas render
   */
  const markRenderStart = useCallback((): void => {
    startMeasure(PERF_MARKERS.CANVAS_RENDER);
  }, [startMeasure]);

  /**
   * Mark the end of a canvas render
   */
  const markRenderEnd = useCallback((): void => {
    const duration = endMeasure(PERF_MARKERS.CANVAS_RENDER);
    if (duration !== null) {
      renderCountRef.current++;
      lastRenderTimeRef.current = duration;

      // Keep a rolling window of render times for average calculation
      renderTimesRef.current.push(duration);
      if (renderTimesRef.current.length > maxSamplesRef.current) {
        renderTimesRef.current.shift();
      }

      // Warn if render time exceeds frame budget
      if (duration > FRAME_BUDGET_MS && import.meta.env.DEV) {
        console.warn(`[Perf] Slow render detected: ${duration.toFixed(2)}ms (budget: ${FRAME_BUDGET_MS}ms)`);
      }
    }
  }, [endMeasure]);

  /**
   * Get performance summary
   */
  const getPerformanceSummary = useCallback((): CanvasPerformanceData => {
    const times = renderTimesRef.current;
    const average = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

    return {
      renderCount: renderCountRef.current,
      lastRenderTime: lastRenderTimeRef.current,
      averageRenderTime: average,
    };
  }, []);

  /**
   * Reset performance counters
   */
  const resetCounters = useCallback((): void => {
    renderCountRef.current = 0;
    lastRenderTimeRef.current = 0;
    renderTimesRef.current = [];
  }, []);

  /**
   * Check if rendering is maintaining 60fps
   */
  const isPerformanceGood = useCallback((): boolean => {
    const summary = getPerformanceSummary();
    return summary.averageRenderTime <= FRAME_BUDGET_MS;
  }, [getPerformanceSummary]);

  return {
    markRenderStart,
    markRenderEnd,
    measureFrameRate,
    getPerformanceSummary,
    resetCounters,
    isPerformanceGood,
  };
};

/**
 * Get memory usage (Chrome only)
 */
export const getMemoryUsage = (): number | null => {
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  if (memory) {
    return Math.round(memory.usedJSHeapSize / 1024 / 1024);
  }
  return null;
};
