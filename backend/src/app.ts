import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';
import { importRouter } from './routes/import.routes.js';

export function createApp() {
  const app = express();

  const origins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(cors({ origin: origins.includes('*') ? true : origins }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', provider: env.AI_PROVIDER, uptime: process.uptime() });
  });

  app.use('/api', importRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
