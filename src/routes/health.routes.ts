import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { isDatabaseConnected } from '../config/database.js';

export const healthRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Verificação de saúde e prontidão da aplicação',
        tags: ['Health'],
        response: {
          200: z.object({
            status: z.string(),
            database: z.string(),
            timestamp: z.string(),
          }),
          503: z.object({
            status: z.string(),
            database: z.string(),
            timestamp: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const dbOk = isDatabaseConnected();
      const payload = {
        status: dbOk ? 'ok' : 'degraded',
        database: dbOk ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      };

      if (!dbOk) {
        return reply.status(503).send(payload);
      }

      return reply.status(200).send(payload);
    }
  );
};
