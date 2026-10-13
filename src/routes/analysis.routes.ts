import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAiKey, requireAuth } from '../plugins/auth.plugin.js';
import {
  AnalysisParamsSchema,
  AnalysisQuerySchema,
  FinancialAnalysisResponseSchema,
} from '../schemas/analysis.schemas.js';
import { AnalysisService } from '../services/analysis.service.js';

export const analysisRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/api/analysis/:month',
    {
      preHandler: [requireAuth, requireAiKey],
      schema: {
        description:
          'Consulta e geração de diagnóstico financeiro mensal com cache de 24h e invalidação por hash de transações',
        tags: ['Análise Financeira'],
        security: [{ bearerAuth: [] }],
        params: AnalysisParamsSchema,
        querystring: AnalysisQuerySchema,
        response: {
          200: FinancialAnalysisResponseSchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          403: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { month } = request.params;
      const { forceRefresh } = request.query;
      const userId = request.user.id;

      try {
        const result = await AnalysisService.getAnalysis(userId, month, forceRefresh);
        return reply.status(200).send(result);
      } catch (err: any) {
        if (err.statusCode === 400 || (err.message && err.message.includes('Nenhuma transação'))) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: err.message,
          });
        }
        throw err;
      }
    }
  );
};
