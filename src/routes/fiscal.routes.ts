import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.plugin.js';
import {
  FiscalAnnualSummaryResponseSchema,
  FiscalSummaryQuerySchema,
  UpdateTransactionFiscalBodySchema,
} from '../schemas/fiscal.schemas.js';
import { TransactionIdParamSchema } from '../schemas/transaction.schemas.js';
import { FiscalService } from '../services/fiscal.service.js';

export const fiscalRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // PATCH /api/transactions/:id/fiscal
  fastify.patch(
    '/api/transactions/:id/fiscal',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Atualização de classificação e metadados fiscais de uma transação',
        tags: ['Fiscal'],
        security: [{ bearerAuth: [] }],
        params: TransactionIdParamSchema,
        body: UpdateTransactionFiscalBodySchema,
        response: {
          200: z.object({
            id: z.string(),
            amount: z.number(),
            cleanDescription: z.string(),
            fiscal: z.object({
              isTaxDeductible: z.boolean(),
              taxCategory: z.string().optional(),
              providerDocument: z.string().optional(),
              providerName: z.string().optional(),
              deductibleAmount: z.number().optional(),
              status: z.string(),
              notes: z.string().optional(),
            }),
          }),
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          404: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const updated = await FiscalService.updateTransactionFiscal(
        request.user.id,
        request.params.id,
        request.body
      );

      if (!updated) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Transação não encontrada ou acesso não autorizado.',
        });
      }

      return reply.status(200).send({
        id: updated._id.toString(),
        amount: updated.amount,
        cleanDescription: updated.cleanDescription,
        fiscal: {
          isTaxDeductible: Boolean(updated.fiscal?.isTaxDeductible),
          taxCategory: updated.fiscal?.taxCategory,
          providerDocument: updated.fiscal?.providerDocument,
          providerName: updated.fiscal?.providerName,
          deductibleAmount: updated.fiscal?.deductibleAmount,
          status: updated.fiscal?.status || 'PENDING',
          notes: updated.fiscal?.notes,
        },
      });
    }
  );

  // GET /api/fiscal/summary
  fastify.get(
    '/api/fiscal/summary',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Consolidado anual de despesas dedutíveis e métricas de faturamento PJ/Autônomo',
        tags: ['Fiscal'],
        security: [{ bearerAuth: [] }],
        querystring: FiscalSummaryQuerySchema,
        response: {
          200: FiscalAnnualSummaryResponseSchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const summary = await FiscalService.getAnnualSummary(
        request.user.id,
        request.query.year
      );

      return reply.status(200).send(summary);
    }
  );
};
