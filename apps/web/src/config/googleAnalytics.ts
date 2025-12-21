/**
 * Google Analytics 4 configuration (Alternative to Plausible)
 * Note: GA4 requires cookie consent banner for GDPR compliance
 */

import { isDevelopment } from './env';

/**
 * GA4 configuration interface
 */
export interface GA4Config {
  /** GA4 Measurement ID (G-XXXXXXXXXX) */
  measurementId: string;
}

/**
 * Get GA4 configuration from environment variables
 * Returns null if measurement ID is not configured or in development mode
 */
export const getGA4Config = (): GA4Config | null => {
  // Disable analytics in development
  if (isDevelopment) {
    console.info('Google Analytics 4 disabled in development mode.');
    return null;
  }

  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;

  if (!measurementId) {
    console.info('GA4 Measurement ID not configured. Analytics disabled.');
    return null;
  }

  return { measurementId };
};

/**
 * Extend Window interface for gtag
 */
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Initialize Google Analytics 4
 * Dynamically loads the gtag.js script and configures GA4
 */
export const initGA4 = (): void => {
  const config = getGA4Config();
  if (!config) return;

  // Create and inject gtag.js script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${config.measurementId}`;
  document.head.appendChild(script);

  // Initialize dataLayer and gtag function
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  // Configure GA4
  window.gtag('js', new Date());
  window.gtag('config', config.measurementId, {
    send_page_view: true,
    // Respect user's Do Not Track preference
    anonymize_ip: true,
  });
};

/**
 * Check if GA4 is initialized
 */
export const isGA4Initialized = (): boolean => {
  return typeof window.gtag === 'function' && !isDevelopment;
};

/**
 * Track a GA4 event
 * @param eventName - Name of the event
 * @param params - Optional event parameters
 */
export const trackGA4Event = (
  eventName: string,
  params?: Record<string, string | number | boolean>
): void => {
  // Skip tracking in development
  if (isDevelopment) {
    console.debug('[GA4] Event skipped (dev mode):', eventName, params);
    return;
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
};

/**
 * Track a page view
 * @param pagePath - Optional custom page path
 * @param pageTitle - Optional custom page title
 */
export const trackGA4PageView = (pagePath?: string, pageTitle?: string): void => {
  if (isDevelopment) {
    console.debug('[GA4] Page view skipped (dev mode):', pagePath, pageTitle);
    return;
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: pagePath || window.location.pathname,
      page_title: pageTitle || document.title,
    });
  }
};

/**
 * Pre-defined GA4 events for consistent tracking
 * These map to the same events as Plausible for easy switching
 */
export const GA4Events = {
  // Project operations
  projectCreated: () => trackGA4Event('project_created'),
  projectSaved: (format: 'json' | 'png' | 'jpeg') =>
    trackGA4Event('project_saved', { format }),
  projectLoaded: () => trackGA4Event('project_loaded'),

  // Drawing operations
  objectCreated: (cellCount: number) =>
    trackGA4Event('object_created', { cell_count: cellCount }),
  objectDeleted: () => trackGA4Event('object_deleted'),
  objectDuplicated: () => trackGA4Event('object_duplicated'),
  objectMoved: () => trackGA4Event('object_moved'),
  objectRotated: () => trackGA4Event('object_rotated'),

  // Tool usage
  toolChanged: (tool: string) => trackGA4Event('tool_changed', { tool }),

  // Grid settings changes
  gridSettingsChanged: (setting: string) =>
    trackGA4Event('grid_settings_changed', { setting }),
  scaleChanged: (scale: number) => trackGA4Event('scale_changed', { scale }),

  // Canvas operations
  canvasZoomed: (zoomLevel: number) =>
    trackGA4Event('canvas_zoomed', { zoom_level: zoomLevel }),
  canvasPanned: () => trackGA4Event('canvas_panned'),

  // Export/Import
  exportStarted: (format: string) => trackGA4Event('export_started', { format }),
  exportCompleted: (format: string) =>
    trackGA4Event('export_completed', { format }),
  importStarted: () => trackGA4Event('import_started'),
  importCompleted: () => trackGA4Event('import_completed'),

  // Errors
  errorOccurred: (errorType: string) =>
    trackGA4Event('error_occurred', { error_type: errorType }),

  // User engagement
  sessionStarted: () => trackGA4Event('session_start'),
  featureUsed: (feature: string) =>
    trackGA4Event('feature_used', { feature }),
} as const;
