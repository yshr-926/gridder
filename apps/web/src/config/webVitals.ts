import type { Metric } from 'web-vitals';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import * as Sentry from '@sentry/react';
import { isSentryInitialized } from './sentry';

/**
 * Web Vitals metric data structure
 */
export interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

/**
 * Web Vitals thresholds based on Google's recommendations
 * Values in milliseconds (except CLS which is unitless)
 */
export const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  CLS: { good: 0.1, poor: 0.25 }, // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte
  INP: { good: 200, poor: 500 }, // Interaction to Next Paint
} as const;

/**
 * Store for collected Web Vitals metrics
 */
const collectedMetrics: Map<string, WebVitalsMetric> = new Map();

/**
 * Handle Web Vitals metric collection
 * Logs to console in development and sends to Sentry
 */
const handleMetric = (metric: Metric): void => {
  const webVitalMetric: WebVitalsMetric = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
  };

  // Store metric for later retrieval
  collectedMetrics.set(metric.name, webVitalMetric);

  // Log to console in development
  if (import.meta.env.DEV) {
    const color = getMetricColor(metric.rating);
    console.log(
      `%c[Web Vitals] ${metric.name}: ${formatMetricValue(metric.name, metric.value)} (${metric.rating})`,
      `color: ${color}; font-weight: bold;`
    );
  }

  // Send to Sentry if initialized
  if (isSentryInitialized()) {
    const unit = metric.name === 'CLS' ? '' : 'millisecond';
    Sentry.setMeasurement(metric.name, metric.value, unit);
  }
};

/**
 * Format metric value for display
 */
const formatMetricValue = (name: string, value: number): string => {
  if (name === 'CLS') {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
};

/**
 * Get color based on metric rating
 */
const getMetricColor = (rating: 'good' | 'needs-improvement' | 'poor'): string => {
  switch (rating) {
    case 'good':
      return '#22c55e'; // green-500
    case 'needs-improvement':
      return '#eab308'; // yellow-500
    case 'poor':
      return '#ef4444'; // red-500
  }
};

/**
 * Initialize Web Vitals monitoring
 * Registers callbacks for all Core Web Vitals and other metrics
 */
export const initWebVitals = (): void => {
  // Core Web Vitals
  onLCP(handleMetric);
  onCLS(handleMetric);
  onINP(handleMetric);

  // Other Web Vitals
  onFCP(handleMetric);
  onTTFB(handleMetric);

  if (import.meta.env.DEV) {
    console.info('[Web Vitals] Monitoring initialized');
  }
};

/**
 * Get all collected Web Vitals metrics
 */
export const getCollectedMetrics = (): Record<string, WebVitalsMetric | null> => {
  return {
    LCP: collectedMetrics.get('LCP') ?? null,
    CLS: collectedMetrics.get('CLS') ?? null,
    FCP: collectedMetrics.get('FCP') ?? null,
    TTFB: collectedMetrics.get('TTFB') ?? null,
    INP: collectedMetrics.get('INP') ?? null,
  };
};

/**
 * Get rating for a specific metric value
 */
export const getMetricRating = (
  name: keyof typeof WEB_VITALS_THRESHOLDS,
  value: number
): 'good' | 'needs-improvement' | 'poor' => {
  const threshold = WEB_VITALS_THRESHOLDS[name];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
};

/**
 * Check if all Core Web Vitals are in "good" range
 */
export const areWebVitalsGood = (): boolean => {
  const metrics = getCollectedMetrics();
  const coreVitals = ['LCP', 'CLS', 'INP'] as const;

  for (const name of coreVitals) {
    const metric = metrics[name];
    if (metric && metric.rating !== 'good') {
      return false;
    }
  }

  return true;
};
