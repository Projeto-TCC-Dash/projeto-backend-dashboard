import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.plugin.js';
import {
  AccountIdParamSchema,
  AccountResponseItemSchema,
  CreateAccountBodySchema,
  DeleteAccountQuerySchema,
  ListAccountsResponseSchema,
  UpdateAccountBodySchema,
} from '../schemas/account.schemas.js';
import {
  AccountBadRequestError,
  AccountConflictError,
  AccountNotFoundError,
  AccountService,
} from '../services/account.service.js';

export const accountsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /api/accounts - Listar contas com saldo consolidado
  fastify.get(
    '/api/accounts',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Lista todas as contas financeiras do usuário com saldo consolidado e contagem de transações',
        tags: ['Accounts'],
        security: [{ bearerAuth: [] }],
        response: {
          200: ListAccountsResponseSchema,
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const result = await AccountService.listAccountsWithBalances(request.user.id);
      return reply.status(200).send(result);
    }
  );

  // POST /api/accounts - Criar nova conta
  fastify.post(
    '/api/accounts',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Cria uma nova conta financeira para o usuário',
        tags: ['Accounts'],
        security: [{ bearerAuth: [] }],
        body: CreateAccountBodySchema,
        response: {
          201: AccountResponseItemSchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          409: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const created = await AccountService.createAccount(request.user.id, request.body);
        return reply.status(201).send(created);
      } catch (err) {
        if (err instanceof AccountConflictError) {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: err.message,
          });
        }
        throw err;
      }
    }
  );

  // PATCH /api/accounts/:id - Atualizar conta existente
  fastify.patch(
    '/api/accounts/:id',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Atualiza parcialmente propriedades de uma conta bancária ou cartão',
        tags: ['Accounts'],
        security: [{ bearerAuth: [] }],
        params: AccountIdParamSchema,
        body: UpdateAccountBodySchema,
        response: {
          200: AccountResponseItemSchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          404: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          409: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const updated = await AccountService.updateAccount(
          request.user.id,
          request.params.id,
          request.body
        );
        return reply.status(200).send(updated);
      } catch (err) {
        if (err instanceof AccountNotFoundError) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: err.message,
          });
        }
        if (err instanceof AccountConflictError) {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: err.message,
          });
        }
        throw err;
      }
    }
  );

  // DELETE /api/accounts/:id - Excluir conta
  fastify.delete(
    '/api/accounts/:id',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Exclui uma conta com política de segurança (bloqueio 409 vs cascata e proteção da conta única)',
        tags: ['Accounts'],
        security: [{ bearerAuth: [] }],
        params: AccountIdParamSchema,
        querystring: DeleteAccountQuerySchema,
        response: {
          200: z.object({ deletedCount: z.number(), transactionsDeleted: z.number() }),
          204: z.null().describe('Conta excluída sem transações vinculadas'),
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          404: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          409: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const cascade = request.query.cascade === 'true';
        const result = await AccountService.deleteAccount(
          request.user.id,
          request.params.id,
          cascade
        );

        if (cascade || result.transactionsDeleted > 0) {
          return reply.status(200).send(result);
        }

        return reply.status(204).send();
      } catch (err) {
        if (err instanceof AccountNotFoundError) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: err.message,
          });
        }
        if (err instanceof AccountBadRequestError) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: err.message,
          });
        }
        if (err instanceof AccountConflictError) {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: err.message,
          });
        }
        throw err;
      }
    }
  );
};
