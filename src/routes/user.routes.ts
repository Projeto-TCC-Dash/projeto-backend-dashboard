import fs from 'node:fs';
import path from 'node:path';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AVATAR_CONFIG } from '../config/constants.js';
import { requireAuth } from '../plugins/auth.plugin.js';
import {
  UpdateFinancialProfileRequestSchema,
  UpdateUserProfileRequestSchema,
  UserAvatarResponseSchema,
  UserProfileResponseSchema,
} from '../schemas/user.schemas.js';
import {
  InvalidAvatarFileError,
  UserNotFoundError,
  UserService,
} from '../services/user.service.js';

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

  // PATCH /api/user/profile - Atualizar dados cadastrais (nome)
  fastify.patch(
    '/api/user/profile',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Atualizar dados cadastrais do usuário autenticado (ex: nome)',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
        body: UpdateUserProfileRequestSchema,
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
        const updated = await UserService.updateProfileName(userId, request.body.name);
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

  // POST /api/user/avatar - Upload de foto de perfil
  fastify.post(
    '/api/user/avatar',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Upload multipart de foto de perfil (avatar)',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
        response: {
          200: UserAvatarResponseSchema,
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
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Nenhum arquivo enviado no payload multipart.',
        });
      }

      try {
        const userId = (request.user as { id: string }).id;
        const buffer = await data.toBuffer();
        const result = await UserService.uploadAvatar(userId, {
          buffer,
          mimetype: data.mimetype,
          filename: data.filename,
        });
        return reply.status(200).send(result);
      } catch (err) {
        if (err instanceof InvalidAvatarFileError) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: err.message,
          });
        }
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

  // DELETE /api/user/avatar - Excluir foto de perfil
  fastify.delete(
    '/api/user/avatar',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Excluir foto de perfil do usuário',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
        response: {
          200: UserAvatarResponseSchema,
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
        const result = await UserService.deleteAvatar(userId);
        return reply.status(200).send(result);
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

  // GET /uploads/avatars/:filename - Servir avatar estático
  fastify.get(
    '/uploads/avatars/:filename',
    {
      schema: {
        description: 'Servir imagem de avatar de usuário',
        tags: ['User'],
        params: z.object({
          filename: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const safeFilename = path.basename(request.params.filename);
      const filePath = path.join(process.cwd(), AVATAR_CONFIG.UPLOAD_DIR, safeFilename);

      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Imagem de avatar não encontrada.',
        });
      }

      const ext = path.extname(safeFilename).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.jpg' || ext === '.jpeg') {
        contentType = 'image/jpeg';
      } else if (ext === '.png') {
        contentType = 'image/png';
      } else if (ext === '.webp') {
        contentType = 'image/webp';
      }

      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(fs.createReadStream(filePath));
    }
  );
};
