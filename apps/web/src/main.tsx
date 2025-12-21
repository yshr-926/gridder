import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSentry, isSentryInitialized } from './config/sentry';
import { initWebVitals, getCollectedMetrics } from './config/webVitals';
import { AnalyticsEvents } from './config/analytics';
import { env } from './config/env';

/**
 * Debug interface for development environment
 */
interface DebugFunctions {
  testSentry: () => void;
  getWebVitals: () => ReturnType<typeof getCollectedMetrics>;
  testAnalytics: () => void;
  getEnvConfig: () => typeof env;
}

/**
 * Track initialization errors
 */
const initErrors: string[] = [];

/**
 * Initialize application monitoring and analytics
 * Order: Sentry (first for error catching) -> Web Vitals -> Analytics
 */
const initializeApp = (): void => {
  // 1. Sentry initialization (first to catch errors in subsequent init)
  try {
    initSentry();
    if (isSentryInitialized()) {
      console.info('[Init] Sentry initialized');
    } else {
      console.info('[Init] Sentry skipped (not configured or localhost)');
    }
  } catch (error) {
    initErrors.push('Sentry');
    console.error('[Init] Failed to initialize Sentry:', error);
  }

  // 2. Web Vitals collection
  try {
    initWebVitals();
    console.info('[Init] Web Vitals collection started');
  } catch (error) {
    initErrors.push('Web Vitals');
    console.error('[Init] Failed to initialize Web Vitals:', error);
  }

  // 3. Analytics (Plausible) - loaded via script tag in index.html if configured
  try {
    // Track session start when analytics is available
    if (typeof window.plausible === 'function') {
      AnalyticsEvents.sessionStarted();
      console.info('[Init] Analytics (Plausible) initialized');
    } else {
      console.info('[Init] Analytics skipped (not configured)');
    }
  } catch (error) {
    initErrors.push('Analytics');
    console.error('[Init] Failed to initialize Analytics:', error);
  }

  // Report initialization status
  if (initErrors.length > 0) {
    console.warn(`[Init] Failed to initialize: ${initErrors.join(', ')}`);
    console.warn('[Init] App will continue without these features');
  } else {
    console.info('[Init] All monitoring features initialized successfully');
  }
};

/**
 * Setup development environment debug functions
 */
const setupDevTools = (): void => {
  if (!import.meta.env.DEV) return;

  const debug: DebugFunctions = {
    // Test Sentry error reporting
    testSentry: () => {
      throw new Error('Test Sentry Error from debug.testSentry()');
    },

    // Get current Web Vitals metrics
    getWebVitals: () => {
      const metrics = getCollectedMetrics();
      console.table(metrics);
      return metrics;
    },

    // Test analytics event
    testAnalytics: () => {
      AnalyticsEvents.featureUsed('debug_test');
      console.info('[Debug] Analytics test event sent');
    },

    // Get current environment config
    getEnvConfig: () => {
      console.table(env);
      return env;
    },
  };

  // Expose debug functions globally
  (window as unknown as { debug: DebugFunctions }).debug = debug;

  console.info('[Debug] Debug functions available at window.debug');
  console.info('[Debug] Available commands: testSentry(), getWebVitals(), testAnalytics(), getEnvConfig()');
};

// Initialize application
initializeApp();

// Setup development tools
setupDevTools();

// Mount React application
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found. Cannot mount React application.');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

// Development environment information
if (import.meta.env.DEV) {
  console.info('[Gridder] Running in development mode');
  console.info('[Gridder] Version:', env.appVersion);
  console.info('[Gridder] Environment:', env.appEnv);
}
