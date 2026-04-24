import { config } from 'dotenv';
config({ path: '.env.local' });

import express from 'express';
import { evaluateRouter } from './routes/evaluate.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '2mb' }));
app.use('/api', evaluateRouter);

// Export `app` so supertest can import it in tests without binding to a port.
// The server only listens when this module is the direct entry point, never
// when imported as a dependency (which would cause port conflicts in CI).
export { app };

// Guard: only start listening when Node executes this file directly (not when
// another module imports it, e.g. in tests via supertest).
// `import.meta.url` equals the `file://` URL of this file; argv[1] is the
// path passed to node/tsx. They match only for the entry-point invocation.
const isEntryPoint =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

// We check `!process.env.VITEST` as an additional guard — when Vitest imports
// this module it sets VITEST=true in the environment. This is the simplest
// cross-platform way to suppress listen() in the test runner.
if (!process.env.VITEST && (isEntryPoint || process.env.NODE_ENV !== 'test')) {
  app.listen(PORT, () => {
    console.log(`[backend] Running on http://localhost:${PORT}`);
  });
}
