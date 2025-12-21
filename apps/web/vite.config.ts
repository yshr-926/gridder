import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import { securityHeadersPlugin } from './vite-plugin-security-headers';

// Build Sentry plugin configuration
const getSentryPlugin = (): PluginOption | null => {
  if (!process.env.SENTRY_AUTH_TOKEN) {
    return null;
  }

  return sentryVitePlugin({
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    sourcemaps: {
      assets: './dist/**',
    },
    release: {
      name: process.env.VITE_APP_VERSION,
    },
  });
};

// Build visualizer plugin configuration (only in analyze mode)
const getVisualizerPlugin = (mode: string): PluginOption | null => {
  if (mode !== 'analyze') {
    return null;
  }

  return visualizer({
    filename: 'dist/stats.html',
    open: true,
    gzipSize: true,
    brotliSize: true,
  });
};

// Build plugins array
const buildPlugins = (mode: string): PluginOption[] => {
  const plugins: PluginOption[] = [react(), securityHeadersPlugin()];

  const sentryPlugin = getSentryPlugin();
  if (sentryPlugin) {
    plugins.push(sentryPlugin);
  }

  const visualizerPlugin = getVisualizerPlugin(mode);
  if (visualizerPlugin) {
    plugins.push(visualizerPlugin);
  }

  return plugins;
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: buildPlugins(mode),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Enable sourcemaps for Sentry error tracking
    sourcemap: true,
    // Bundle splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          konva: ['konva', 'react-konva'],
          zustand: ['zustand'],
          sentry: ['@sentry/react'],
        },
      },
    },
    // Use esbuild for minification (default, faster than terser)
    minify: 'esbuild',
    // Target modern browsers
    target: 'es2020',
    // Report compressed size
    reportCompressedSize: true,
    // Chunk size warning limit (500KB)
    chunkSizeWarningLimit: 500,
  },
  esbuild: {
    // Remove console.log and debugger in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
}));
