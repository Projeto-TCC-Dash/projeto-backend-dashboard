import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.plugin.js';
import {
  BudgetOverviewResponseSchema,
  MonthParamSchema,
  SetBudgetBodySchema,
} from '../schemas/budget.schemas.js';
import { BudgetNotFoundError, BudgetService } from '../services/budget.service.js';

export const budgetRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /api/budgets/:month
  fastify.get(
    '/api/budgets/:month',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Consulta do orçamento mensal configurado e do consumo em tempo real por categoria',
        tags: ['Orçamentos (Budgets)'],
        security: [{ bearerAuth: [] }],
        params: MonthParamSchema,
        response: {
          200: BudgetOverviewResponseSchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          404: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const overview = await BudgetService.getBudgetOverview(
          request.user.id,
          request.params.month
        );
        return reply.status(200).send(overview);
      } catch (err) {
        if (err instanceof BudgetNotFoundError) {
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

  // PUT /api/budgets/:month
  fastify.put(
    '/api/budgets/:month',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Define ou atualiza os tetos de gastos do orçamento do mês',
        tags: ['Orçamentos (Budgets)'],
        security: [{ bearerAuth: [] }],
        params: MonthParamSchema,
        body: SetBudgetBodySchema,
        response: {
          200: BudgetOverviewResponseSchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const updated = await BudgetService.upsertBudgetPlan(
        request.user.id,
        request.params.month,
        request.body
      );

      return reply.status(200).send(updated);
    }
  );
};
