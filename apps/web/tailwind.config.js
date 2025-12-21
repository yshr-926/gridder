/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Gridder カラーパレット（モノクロ基調）
        gridder: {
          primary: '#1f2937', // ダークグレー
          secondary: '#6b7280', // ミディアムグレー
          accent: '#3b82f6', // アクセントブルー
          'bg-primary': '#ffffff',
          'bg-secondary': '#f9fafb',
          'bg-tertiary': '#f3f4f6',
          'text-primary': '#1f2937',
          'text-secondary': '#6b7280',
          'text-muted': '#9ca3af',
          border: '#e5e7eb',
          'border-hover': '#d1d5db',
          'grid-line': '#e5e7eb',
          'grid-cell-filled': '#333333',
          'grid-cell-hover': '#f3f4f6',
          selection: 'rgba(59, 130, 246, 0.3)',
          'selection-border': '#3b82f6',
        },
      },
    },
  },
  plugins: [],
};
