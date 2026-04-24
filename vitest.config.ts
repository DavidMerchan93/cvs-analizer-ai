/**
 * Vitest configuration for FRONTEND tests only.
 *
 * Why jsdom: React components need a browser-like DOM environment.
 * jsdom is the lightest option that satisfies @testing-library/react's
 * requirements without spinning up a real browser.
 *
 * Why a separate config for backend: the backend uses NodeNext module
 * resolution and runs in Node.js (no DOM), so mixing environments in one
 * config would require per-file overrides or cause confusing failures
 * (e.g., `window` being undefined in backend tests).
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Keep the same @ alias as vite.config.ts so imports resolve identically
      '@': path.resolve(__dirname, 'frontend'),
    },
  },
  test: {
    // jsdom simulates a browser environment for React component rendering
    environment: 'jsdom',
    globals: true,
    // setupFiles run once per test file, before the test suite.
    // We use it to import @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/frontend/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Only measure coverage for files we actually own — exclude node_modules
      // and the backend (covered separately by vitest.node.config.ts)
      include: ['frontend/src/**'],
    },
  },
});
