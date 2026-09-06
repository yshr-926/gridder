import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { env } from './config/env';

/**
 * Debug interface for development environment
 */
interface DebugFunctions {
  getEnvConfig: () => typeof env;
}

/**
 * Setup development environment debug functions
 */
const setupDevTools = (): void => {
  if (!import.meta.env.DEV) return;

  const debug: DebugFunctions = {
    // Get current environment config
    getEnvConfig: () => {
      console.table(env);
      return env;
    },
  };

  // Expose debug functions globally
  (window as unknown as { debug: DebugFunctions }).debug = debug;

  console.info('[Debug] Debug functions available at window.debug');
  console.info('[Debug] Available commands: getEnvConfig()');
};

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
