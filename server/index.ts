import { config } from 'dotenv';
config({ path: '.env.local' });

import express from 'express';
import { evaluateRouter } from './routes/evaluate.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '2mb' }));
app.use('/api', evaluateRouter);

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`);
});
