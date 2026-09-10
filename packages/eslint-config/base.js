import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';

/** @type {import("eslint").Linter.Config[]} */
export default defineConfig([
  globalIgnores(['dist', 'coverage', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
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
