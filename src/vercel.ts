import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from './app.js';
import { connectDatabase } from './config/database.js';

const app = buildApp();
let readyPromise: Promise<void> | null = null;

async function ensureAppReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = Promise.resolve(app.ready())
      .then(() => undefined)
      .catch((error) => {
        readyPromise = null;
        throw error;
      });
  }
  await readyPromise;
}

/**
 * Handler serverless para execução da API Fastify na Vercel.
 * Reutiliza a instância do Fastify e a conexão do Mongoose entre invocações quentes.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await connectDatabase();
  await ensureAppReady();
  app.server.emit('request', req, res);
}
