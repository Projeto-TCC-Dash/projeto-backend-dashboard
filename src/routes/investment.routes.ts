import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.plugin.js';
import {
  InvestmentPortfolioSummarySchema,
  UpsertInvestmentHoldingBodySchema,
} from '../schemas/investment.schemas.js';
import { InvestmentService } from '../services/investment.service.js';

export const investmentRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /api/investments/holdings
  fastify.get(
    '/api/investments/holdings',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Consulta da carteira de investimentos consolidada por macroclasses com diagnóstico de perfil de risco',
        tags: ['Investimentos'],
        security: [{ bearerAuth: [] }],
        response: {
          200: InvestmentPortfolioSummarySchema,
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const summary = await InvestmentService.getPortfolioSummary(request.user.id);
      return reply.status(200).send(summary);
    }
  );

  // PUT /api/investments/holdings
  fastify.put(
    '/api/investments/holdings',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Atualiza ou cadastra uma posição em macroclasse de ativo em uma conta de investimentos',
        tags: ['Investimentos'],
        security: [{ bearerAuth: [] }],
        body: UpsertInvestmentHoldingBodySchema,
        response: {
          200: InvestmentPortfolioSummarySchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          404: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const updated = await InvestmentService.upsertHolding(
        request.user.id,
        request.body
      );

      if (!updated) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Conta de investimentos informada não foi encontrada ou não pertence ao usuário.',
        });
      }

      return reply.status(200).send(updated);
    }
  );
};
