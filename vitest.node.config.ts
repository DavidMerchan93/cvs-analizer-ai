/**
 * Vitest configuration for BACKEND tests only.
 *
 * Why a separate config from vitest.config.ts:
 * The backend uses NodeNext module resolution (`.js` extensions in imports,
 * `import type` guards) and has no DOM dependency. Running it inside the jsdom
 * environment would introduce globals like `window` that don't exist in Node
 * and can mask real bugs (e.g., code that accidentally reads `window.location`).
 *
 * The `node` environment also gives us access to real Node.js built-ins
 * (Buffer, process, etc.) which are required by supertest and the Express app.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/backend/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['backend/**'],
    },
  },
});
