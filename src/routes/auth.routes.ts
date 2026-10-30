import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.plugin.js';
import {
  AuthResponseSchema,
  GoogleLinkRequestSchema,
  GoogleLinkResponseSchema,
  GoogleLoginRequestSchema,
  GoogleUnlinkResponseSchema,
  LoginRequestSchema,
  LogoutRequestSchema,
  RegisterRequestSchema,
  SetApiKeyRequestSchema,
  SetApiKeyResponseSchema,
} from '../schemas/auth.schemas.js';
import {
  AuthService,
  CannotUnlinkGoogleWithoutPasswordError,
  GoogleAccountConflictError,
  GoogleAccountNotLinkedError,
  GoogleUserNotFoundError,
} from '../services/auth.service.js';
import { InvalidGoogleTokenError } from '../services/google-auth.service.js';
import { SessionService } from '../services/session.service.js';

export const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // POST /api/auth/register - Registro de usuário
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
        const result = await AuthService.register(
          request.body,
          (payload) => fastify.jwt.sign(payload),
          {
            userAgent: request.headers['user-agent'],
            ip: request.ip,
          }
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

  // POST /api/auth/login - Login com e-mail e senha
  fastify.post(
    '/api/auth/login',
    {
      schema: {
        description: 'Login de usuário com e-mail e senha',
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
        const result = await AuthService.login(
          request.body,
          (payload) => fastify.jwt.sign(payload),
          {
            userAgent: request.headers['user-agent'],
            ip: request.ip,
          }
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

  // POST /api/auth/logout - Logout seguro com revogação no servidor
  fastify.post(
    '/api/auth/logout',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Encerramento seguro de sessão e revogação imediata no servidor',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        body: LogoutRequestSchema.optional(),
        response: {
          200: z.object({ success: z.boolean(), message: z.string() }),
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const allDevices = request.body?.allDevices ?? false;
        if (allDevices) {
          await SessionService.revokeAllUserSessions(request.user.id);
        } else if (request.user.sessionId) {
          await SessionService.revokeSession(request.user.sessionId);
        }
        return reply.status(200).send({
          success: true,
          message: 'Sessão encerrada com sucesso.',
        });
      } catch (err: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err?.message || 'Erro ao realizar logout.',
        });
      }
    }
  );

  // POST /api/auth/google/link - Vincular conta Google
  fastify.post(
    '/api/auth/google/link',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Vincula a conta Google ao perfil do usuário autenticado',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        body: GoogleLinkRequestSchema,
        response: {
          200: GoogleLinkResponseSchema,
          400: z
            .object({
              statusCode: z.number(),
              error: z.string(),
              message: z.string(),
              issues: z.array(z.any()).optional(),
            })
            .passthrough(),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          409: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await AuthService.linkGoogleAccount(
          request.user.id,
          request.body.idToken
        );
        return reply.status(200).send(result);
      } catch (err: any) {
        if (err instanceof GoogleAccountConflictError) {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: err.message,
          });
        }
        const statusCode = err?.statusCode || 400;
        return reply.status(statusCode).send({
          statusCode,
          error: statusCode === 400 ? 'Bad Request' : 'Error',
          message: err?.message || 'Erro ao vincular conta Google.',
        });
      }
    }
  );

  // DELETE /api/auth/google/unlink - Desvincular conta Google
  fastify.delete(
    '/api/auth/google/unlink',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Desvincula a conta Google do perfil do usuário autenticado',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: GoogleUnlinkResponseSchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await AuthService.unlinkGoogleAccount(request.user.id);
        return reply.status(200).send(result);
      } catch (err: any) {
        const statusCode = err?.statusCode || 400;
        return reply.status(statusCode).send({
          statusCode,
          error: 'Bad Request',
          message: err?.message || 'Erro ao desvincular conta Google.',
        });
      }
    }
  );

  // POST /api/auth/google - Login com conta Google
  fastify.post(
    '/api/auth/google',
    {
      schema: {
        description: 'Login no sistema utilizando a conta Google vinculada',
        tags: ['Auth'],
        body: GoogleLoginRequestSchema,
        response: {
          200: AuthResponseSchema,
          400: z
            .object({
              statusCode: z.number(),
              error: z.string(),
              message: z.string(),
              issues: z.array(z.any()).optional(),
            })
            .passthrough(),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await AuthService.loginWithGoogle(
          request.body.idToken,
          (payload) => fastify.jwt.sign(payload),
          {
            userAgent: request.headers['user-agent'],
            ip: request.ip,
          }
        );
        return reply.status(200).send(result);
      } catch (err: any) {
        if (err instanceof GoogleUserNotFoundError) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: err.message,
          });
        }
        const statusCode = err?.statusCode || 400;
        return reply.status(statusCode).send({
          statusCode,
          error: statusCode === 401 ? 'Unauthorized' : 'Bad Request',
          message: err?.message || 'Erro ao realizar login com o Google.',
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
