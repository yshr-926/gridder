/**
 * Plausible Analytics configuration
 * Privacy-first analytics solution (no cookies, GDPR compliant)
 */

import { isDevelopment } from './env';

/**
 * Plausible configuration interface
 */
export interface PlausibleConfig {
  /** Domain registered in Plausible */
  domain: string;
  /** Custom API host for self-hosted Plausible */
  apiHost?: string;
}

/**
 * Get Plausible configuration from environment variables
 * Returns null if domain is not configured or in development mode
 */
export const getPlausibleConfig = (): PlausibleConfig | null => {
  // Disable analytics in development
  if (isDevelopment) {
    console.info('Plausible Analytics disabled in development mode.');
    return null;
  }

  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN;

  if (!domain) {
    console.info('Plausible domain not configured. Analytics disabled.');
    return null;
  }

  return {
    domain,
    apiHost: import.meta.env.VITE_PLAUSIBLE_API_HOST,
  };
};

/**
 * Plausible event interface
 */
interface PlausibleEvent {
  /** Event name */
  name: string;
  /** Optional event properties */
  props?: Record<string, string | number | boolean>;
}

/**
 * Extend Window interface for Plausible
 */
declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: { props?: Record<string, string | number | boolean> }
    ) => void;
  }
}

/**
 * Check if analytics tracking is enabled
 */
export const isAnalyticsEnabled = (): boolean => {
  return typeof window.plausible === 'function' && !isDevelopment;
};

/**
 * Track a custom event with Plausible
 * @param event - Event to track
 */
export const trackEvent = (event: PlausibleEvent): void => {
  // Skip tracking in development
  if (isDevelopment) {
    console.debug('[Analytics] Event skipped (dev mode):', event.name, event.props);
    return;
  }

  if (typeof window.plausible === 'function') {
    window.plausible(event.name, { props: event.props });
  }
};

/**
 * Pre-defined analytics events for consistent tracking
 */
export const AnalyticsEvents = {
  // Project operations
  projectCreated: () => trackEvent({ name: 'Project Created' }),
  projectSaved: (format: 'json' | 'png' | 'jpeg') =>
    trackEvent({ name: 'Project Saved', props: { format } }),
  projectLoaded: () => trackEvent({ name: 'Project Loaded' }),

  // Drawing operations
  objectCreated: (cellCount: number) =>
    trackEvent({ name: 'Object Created', props: { cellCount } }),
  objectDeleted: () => trackEvent({ name: 'Object Deleted' }),
  objectDuplicated: () => trackEvent({ name: 'Object Duplicated' }),
  objectMoved: () => trackEvent({ name: 'Object Moved' }),
  objectRotated: () => trackEvent({ name: 'Object Rotated' }),

  // Tool usage
  toolChanged: (tool: string) =>
    trackEvent({ name: 'Tool Changed', props: { tool } }),

  // Grid settings changes
  gridSettingsChanged: (setting: string) =>
    trackEvent({ name: 'Grid Settings Changed', props: { setting } }),
  scaleChanged: (scale: number) =>
    trackEvent({ name: 'Scale Changed', props: { scale } }),

  // Canvas operations
  canvasZoomed: (zoomLevel: number) =>
    trackEvent({ name: 'Canvas Zoomed', props: { zoomLevel } }),
  canvasPanned: () => trackEvent({ name: 'Canvas Panned' }),

  // Export/Import
  exportStarted: (format: string) =>
    trackEvent({ name: 'Export Started', props: { format } }),
  exportCompleted: (format: string) =>
    trackEvent({ name: 'Export Completed', props: { format } }),
  importStarted: () => trackEvent({ name: 'Import Started' }),
  importCompleted: () => trackEvent({ name: 'Import Completed' }),

  // Errors
  errorOccurred: (errorType: string) =>
    trackEvent({ name: 'Error Occurred', props: { errorType } }),

  // User engagement
  sessionStarted: () => trackEvent({ name: 'Session Started' }),
  featureUsed: (feature: string) =>
    trackEvent({ name: 'Feature Used', props: { feature } }),
} as const;

/**
 * Track a custom event (alias for trackEvent)
 * @param eventName - Name of the event
 * @param props - Optional event properties
 */
export const trackCustomEvent = (
  eventName: string,
  props?: Record<string, string | number | boolean>
): void => {
  trackEvent({ name: eventName, props });
};
