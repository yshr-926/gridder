import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import { securityHeadersPlugin } from './vite-plugin-security-headers';

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
    // Bundle splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          konva: ['konva', 'react-konva'],
          zustand: ['zustand'],
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
