import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';

/** @type {import("eslint").Linter.Config[]} */
export default defineConfig([
  globalIgnores(['dist', 'coverage', 'e2e', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // any 禁止
      '@typescript-eslint/no-explicit-any': 'error',
      // 未使用変数
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Last: reports Prettier differences as lint errors and switches off the
  // stylistic rules that would fight it. Without this, formatting drift is
  // invisible to `pnpm lint` (it went unnoticed across 137 files once).
  prettierRecommended,
]);
