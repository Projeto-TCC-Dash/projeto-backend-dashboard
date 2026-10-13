import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.plugin.js';
import {
  AuthResponseSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  SetApiKeyRequestSchema,
  SetApiKeyResponseSchema,
} from '../schemas/auth.schemas.js';
import { AuthService } from '../services/auth.service.js';

export const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // POST /api/auth/register
  fastify.post(
    '/api/auth/register',
    {
      schema: {
        description: 'Registro de novo usuário',
        tags: ['Auth'],
        body: RegisterRequestSchema,
        response: {
          201: AuthResponseSchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await AuthService.register(request.body, (payload) =>
          fastify.jwt.sign(payload)
        );
        return reply.status(201).send(result);
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err?.message || 'Erro ao registrar usuário.',
        });
      }
    }
  );

  // POST /api/auth/login
  fastify.post(
    '/api/auth/login',
    {
      schema: {
        description: 'Login de usuário e emissão de JWT',
        tags: ['Auth'],
        body: LoginRequestSchema,
        response: {
          200: AuthResponseSchema,
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await AuthService.login(request.body, (payload) =>
          fastify.jwt.sign(payload)
        );
        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: err?.message || 'Credenciais inválidas.',
        });
      }
    }
  );

  // PUT /api/user/ai-key
  fastify.put(
    '/api/user/ai-key',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Configuração e validação ativa de chave de IA (BYOK)',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
        body: SetApiKeyRequestSchema,
        response: {
          200: SetApiKeyResponseSchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await AuthService.setApiKey(request.user.id, request.body.apiKey);
        return reply.status(200).send({
          success: true,
          message: result.message,
          status: result.status,
        });
      } catch (err: any) {
        const statusCode = err?.statusCode || 400;
        const errorTitle = statusCode === 400 ? 'Bad Request' : 'Error';
        return reply.status(statusCode).send({
          statusCode,
          error: errorTitle,
          message: err?.message || 'Falha ao validar ou salvar a chave de IA.',
        });
      }
    }
  );
};
