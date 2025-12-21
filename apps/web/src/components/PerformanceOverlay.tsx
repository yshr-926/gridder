import { useState, useEffect, useCallback } from 'react';
import { useCanvasPerformance, getMemoryUsage } from '@/hooks/usePerformanceMetrics';
import { getCollectedMetrics } from '@/config/webVitals';

/**
 * Performance data displayed in the overlay
 */
interface PerformanceData {
  fps: number;
  renderTime: number;
  averageRenderTime: number;
  renderCount: number;
  memoryUsage: number | null;
}

/**
 * Get color class based on FPS value
 */
const getFPSColorClass = (fps: number): string => {
  if (fps >= 55) return 'text-green-400';
  if (fps >= 30) return 'text-yellow-400';
  return 'text-red-400';
};

/**
 * Get color class based on render time
 */
const getRenderTimeColorClass = (time: number): string => {
  if (time <= 16.67) return 'text-green-400';
  if (time <= 33.33) return 'text-yellow-400';
  return 'text-red-400';
};

/**
 * Get color class based on Web Vitals rating
 */
const getRatingColorClass = (rating: 'good' | 'needs-improvement' | 'poor' | null): string => {
  switch (rating) {
    case 'good':
      return 'text-green-400';
    case 'needs-improvement':
      return 'text-yellow-400';
    case 'poor':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

/**
 * Format Web Vitals value for display
 */
const formatVitalValue = (name: string, value: number | null): string => {
  if (value === null) return '-';
  if (name === 'CLS') return value.toFixed(3);
  return `${Math.round(value)}ms`;
};

/**
 * Development-only performance overlay component
 * Toggle visibility with Ctrl+Shift+D (Debug)
 */
export const PerformanceOverlay = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [data, setData] = useState<PerformanceData>({
    fps: 0,
    renderTime: 0,
    averageRenderTime: 0,
    renderCount: 0,
    memoryUsage: null,
  });

  const { measureFrameRate, getPerformanceSummary } = useCanvasPerformance();

  // Update performance data periodically
  const updatePerformanceData = useCallback(async () => {
    const fps = await measureFrameRate(500);
    const summary = getPerformanceSummary();
    const memory = getMemoryUsage();

    setData({
      fps: Math.round(fps),
      renderTime: summary.lastRenderTime,
      averageRenderTime: summary.averageRenderTime,
      renderCount: summary.renderCount,
      memoryUsage: memory,
    });
  }, [measureFrameRate, getPerformanceSummary]);

  // Set up periodic updates when visible
  useEffect(() => {
    if (!isVisible || !import.meta.env.DEV) return;

    const interval = setInterval(updatePerformanceData, 1000);
    return () => clearInterval(interval);
  }, [isVisible, updatePerformanceData]);

  // Handle keyboard shortcut (Ctrl+Shift+D for Debug)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible((v) => !v);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Only render in development mode
  if (!import.meta.env.DEV || !isVisible) return null;

  const webVitals = getCollectedMetrics();

  return (
    <div className="fixed bottom-4 left-4 bg-black/90 text-white text-xs font-mono p-3 rounded-lg z-50 min-w-48 shadow-lg border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
        <span className="font-bold text-gray-300">Performance</span>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Close performance overlay"
        >
          x
        </button>
      </div>

      {/* Runtime Metrics */}
      <div className="space-y-1 mb-3">
        <div className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">Runtime</div>
        <div className="flex justify-between">
          <span className="text-gray-400">FPS:</span>
          <span className={getFPSColorClass(data.fps)}>{data.fps}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Render:</span>
          <span className={getRenderTimeColorClass(data.renderTime)}>
            {data.renderTime.toFixed(2)}ms
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Avg Render:</span>
          <span className={getRenderTimeColorClass(data.averageRenderTime)}>
            {data.averageRenderTime.toFixed(2)}ms
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Renders:</span>
          <span className="text-gray-200">{data.renderCount}</span>
        </div>
        {data.memoryUsage !== null && (
          <div className="flex justify-between">
            <span className="text-gray-400">Memory:</span>
            <span className="text-gray-200">{data.memoryUsage}MB</span>
          </div>
        )}
      </div>

      {/* Web Vitals */}
      <div className="space-y-1">
        <div className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">Web Vitals</div>
        {Object.entries(webVitals).map(([name, metric]) => (
          <div key={name} className="flex justify-between">
            <span className="text-gray-400">{name}:</span>
            <span className={getRatingColorClass(metric?.rating ?? null)}>
              {formatVitalValue(name, metric?.value ?? null)}
            </span>
          </div>
        ))}
      </div>

      {/* Thresholds Legend */}
      <div className="mt-3 pt-2 border-t border-gray-700 text-[10px]">
        <div className="text-gray-500">Ctrl+Shift+D to toggle</div>
        <div className="flex gap-3 mt-1">
          <span className="text-green-400">Good</span>
          <span className="text-yellow-400">Needs Work</span>
          <span className="text-red-400">Poor</span>
        </div>
      </div>
    </div>
  );
};
