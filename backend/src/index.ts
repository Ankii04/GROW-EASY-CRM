import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`GrowEasy CSV Importer API listening on http://localhost:${env.PORT}`);
  console.log(`AI provider: ${env.AI_PROVIDER}`);
});

// Graceful shutdown for container platforms (Railway, Render, Docker).
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down…`);
    server.close(() => process.exit(0));
  });
}
