import * as Sentry from '@sentry/react';

/**
 * Sentry configuration interface
 */
export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  sampleRate: number;
  tracesSampleRate: number;
}

/**
 * Get Sentry configuration from environment variables
 * Returns null if DSN is not configured
 */
export const getSentryConfig = (): SentryConfig | null => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.info('Sentry DSN not configured. Error tracking disabled.');
    return null;
  }

  return {
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION,
    sampleRate: 1.0, // Error sampling rate (100%)
    tracesSampleRate: 0.1, // Performance trace sampling rate (10%)
  };
};

/**
 * Initialize Sentry SDK
 * Should be called early in the application lifecycle
 */
export const initSentry = (): void => {
  const config = getSentryConfig();

  if (!config) return;

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    sampleRate: config.sampleRate,
    tracesSampleRate: config.tracesSampleRate,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      // Disable error sending on localhost
      if (window.location.hostname === 'localhost') {
        return null;
      }
      return event;
    },
  });
};

/**
 * Set custom context for Sentry events
 * @param name - Context name
 * @param context - Context data
 */
export const setSentryContext = (
  name: string,
  context: Record<string, unknown>
): void => {
  Sentry.setContext(name, context);
};

/**
 * Set user information for Sentry
 * @param userId - User identifier
 */
export const setSentryUser = (userId: string): void => {
  Sentry.setUser({ id: userId });
};

/**
 * Clear user information from Sentry
 */
export const clearSentryUser = (): void => {
  Sentry.setUser(null);
};

/**
 * Report an error to Sentry with optional context
 * @param error - Error to report
 * @param context - Additional context data
 */
export const reportError = (
  error: Error,
  context?: Record<string, unknown>
): void => {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
};

/**
 * Track a custom event/message in Sentry
 * @param message - Event message
 * @param level - Severity level
 * @param extra - Additional data
 */
export const trackEvent = (
  message: string,
  level: Sentry.SeverityLevel = 'info',
  extra?: Record<string, unknown>
): void => {
  Sentry.captureMessage(message, {
    level,
    extra,
  });
};

/**
 * Capture exception with event ID for user feedback
 * @param error - Error to capture
 * @param extra - Additional data
 * @returns Event ID for feedback dialog
 */
export const captureExceptionWithEventId = (
  error: Error,
  extra?: Record<string, unknown>
): string => {
  return Sentry.captureException(error, { extra });
};

/**
 * Show Sentry user feedback dialog
 * @param eventId - Event ID from captured exception
 */
export const showFeedbackDialog = (eventId: string): void => {
  Sentry.showReportDialog({ eventId });
};

/**
 * Check if Sentry is initialized
 */
export const isSentryInitialized = (): boolean => {
  return Sentry.getClient() !== undefined;
};
