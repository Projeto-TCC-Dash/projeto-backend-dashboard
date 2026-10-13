import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.plugin.js';
import {
  PluggySyncRequestSchema,
  PluggySyncResponseSchema,
} from '../schemas/pluggy.schemas.js';
import { PluggyService } from '../services/pluggy.service.js';

export const pluggyRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    '/api/integrations/pluggy/sync',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Sincronização de transações via Sandbox Open Finance da Pluggy',
        tags: ['Open Finance'],
        security: [{ bearerAuth: [] }],
        body: PluggySyncRequestSchema,
        response: {
          200: PluggySyncResponseSchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await PluggyService.syncItem(request.user.id, request.body.itemId);
        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err?.message || 'Falha ao sincronizar transações com o sandbox da Pluggy.',
        });
      }
    }
  );
};
