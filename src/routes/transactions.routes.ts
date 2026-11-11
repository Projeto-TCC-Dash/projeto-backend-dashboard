import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAiKey, requireAuth } from '../plugins/auth.plugin.js';
import {
  ListTransactionsQuerySchema,
  TransactionIdParamSchema,
  TransactionItemSchema,
  UpdateTransactionBodySchema,
  UploadTransactionsQuerySchema,
  UploadTransactionsResponseSchema,
} from '../schemas/transaction.schemas.js';
import { AccountNotFoundError } from '../services/account.service.js';
import { AuthService } from '../services/auth.service.js';
import { GeminiService } from '../services/gemini.service.js';
import { ParserService } from '../services/parser.service.js';
import { TransactionService } from '../services/transaction.service.js';

export const transactionRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // POST /api/transactions/upload
  fastify.post(
    '/api/transactions/upload',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Upload multipart de extratos bancários (.ofx e .csv)',
        tags: ['Transactions'],
        security: [{ bearerAuth: [] }],
        querystring: UploadTransactionsQuerySchema,
        response: {
          200: UploadTransactionsResponseSchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          404: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
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

      const filename = data.filename.toLowerCase();
      const buffer = await data.toBuffer();

      let extracted = [];
      if (filename.endsWith('.ofx')) {
        extracted = ParserService.parseOFX(buffer);
      } else if (filename.endsWith('.csv')) {
        extracted = ParserService.parseCSV(buffer);
      } else {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Formato de arquivo não suportado. Apenas extensões .ofx e .csv são aceitas.',
        });
      }

      if (extracted.length === 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Não foi possível extrair nenhuma transação válida do arquivo enviado.',
        });
      }

      try {
        const result = await TransactionService.importTransactions(
          request.user.id,
          extracted,
          request.query.accountId
        );
        return reply.status(200).send(result);
      } catch (err) {
        if (err instanceof AccountNotFoundError) {
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

  // GET /api/transactions
  fastify.get(
    '/api/transactions',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Listagem de transações com filtros por mês, categoria e origem',
        tags: ['Transactions'],
        security: [{ bearerAuth: [] }],
        querystring: ListTransactionsQuerySchema,
        response: {
          200: z.array(TransactionItemSchema),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const transactions = await TransactionService.listTransactions(
        request.user.id,
        request.query
      );

      return reply.status(200).send(
        transactions.map((t) => ({
          id: t._id.toString(),
          externalId: t.externalId,
          rawDescription: t.rawDescription,
          cleanDescription: t.cleanDescription,
          amount: t.amount,
          date: t.date,
          category: t.category,
          source: t.source,
        }))
      );
    }
  );

  // PATCH /api/transactions/:id
  fastify.patch(
    '/api/transactions/:id',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Atualização manual de transação (categoria e descrição limpa)',
        tags: ['Transactions'],
        security: [{ bearerAuth: [] }],
        params: TransactionIdParamSchema,
        body: UpdateTransactionBodySchema,
        response: {
          200: TransactionItemSchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          404: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const updated = await TransactionService.updateTransaction(
        request.user.id,
        request.params.id,
        request.body
      );

      if (!updated) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Transação não encontrada ou acesso não autorizado',
        });
      }

      return reply.status(200).send({
        id: updated._id.toString(),
        externalId: updated.externalId,
        rawDescription: updated.rawDescription,
        cleanDescription: updated.cleanDescription,
        amount: updated.amount,
        date: updated.date,
        category: updated.category,
        source: updated.source,
      });
    }
  );

  // DELETE /api/transactions/:id
  fastify.delete(
    '/api/transactions/:id',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Exclui permanentemente uma transação individual e invalida o cache de análises',
        tags: ['Transactions'],
        security: [{ bearerAuth: [] }],
        params: TransactionIdParamSchema,
        response: {
          204: z.null().describe('Transação excluída com sucesso'),
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          404: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const deleted = await TransactionService.deleteTransaction(
        request.user.id,
        request.params.id
      );

      if (!deleted) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Transação não encontrada ou acesso não autorizado',
        });
      }

      return reply.status(204).send();
    }
  );

  // POST /api/transactions/categorize (Protegida por requireAiKey - HTTP 403 se sem chave)
  fastify.post(
    '/api/transactions/categorize',
    {
      preHandler: [requireAuth, requireAiKey],
      schema: {
        description: 'Categorização inteligente de estabelecimentos pendentes via IA com chave BYOK',
        tags: ['Transactions'],
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            uniqueMerchantsAnalyzed: z.number(),
            transactionsUpdated: z.number(),
          }),
          403: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      // 1. Deduplicação em memória para obter apenas os nomes únicos de estabelecimentos
      const merchants = await TransactionService.getUniqueUncategorizedMerchants(request.user.id);

      if (merchants.length === 0) {
        return reply.status(200).send({
          uniqueMerchantsAnalyzed: 0,
          transactionsUpdated: 0,
        });
      }

      // 2. Descriptografa a chave BYOK efemeramente em memória
      const apiKey = await AuthService.getDecryptedApiKey(request.user.id);

      // 3. Chamada estruturada ao Gemini
      const categoryMap = await GeminiService.categorizeMerchants(apiKey, merchants);

      // 4. Reassociação local em lote no MongoDB
      const updatedCount = await TransactionService.reassociateCategories(
        request.user.id,
        categoryMap
      );

      return reply.status(200).send({
        uniqueMerchantsAnalyzed: merchants.length,
        transactionsUpdated: updatedCount,
      });
    }
  );
};
