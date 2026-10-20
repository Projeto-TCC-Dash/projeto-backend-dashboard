import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.plugin.js';
import {
  UpdateFinancialProfileRequestSchema,
  UserProfileResponseSchema,
} from '../schemas/user.schemas.js';
import { UserNotFoundError, UserService } from '../services/user.service.js';

export const userRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /api/user/profile - Obter perfil cadastral e financeiro
  fastify.get(
    '/api/user/profile',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Obter perfil do usuário autenticado',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
        response: {
          200: UserProfileResponseSchema,
          401: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
          404: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { id: string }).id;
        const profile = await UserService.getProfile(userId);
        return reply.status(200).send(profile);
      } catch (err) {
        if (err instanceof UserNotFoundError) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: err.message,
          });
        }
        throw err;
      }
    }
  );

  // PUT /api/user/profile - Atualizar perfil financeiro voluntário
  fastify.put(
    '/api/user/profile',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Atualizar perfil financeiro voluntário do usuário autenticado',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
        body: UpdateFinancialProfileRequestSchema,
        response: {
          200: UserProfileResponseSchema,
          400: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
          401: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
          404: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = (request.user as { id: string }).id;
        const updated = await UserService.updateFinancialProfile(userId, request.body);
        return reply.status(200).send(updated);
      } catch (err) {
        if (err instanceof UserNotFoundError) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: err.message,
          });
        }
        throw err;
      }
    }
  );
};
