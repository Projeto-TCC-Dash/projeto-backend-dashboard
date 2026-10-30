import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.plugin.js';
import { ExportTransactionsQuerySchema } from '../schemas/export.schemas.js';
import { CsvExportService } from '../services/csv-export.service.js';
import { AccountAccessDeniedError, ExportService } from '../services/export.service.js';
import { PdfExportService } from '../services/pdf-export.service.js';
import { XlsxExportService } from '../services/xlsx-export.service.js';

export const exportRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/api/transactions/export',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Exporta lançamentos financeiros em formatos CSV, XLSX ou PDF com filtros contextuais',
        tags: ['Transactions'],
        security: [{ bearerAuth: [] }],
        querystring: ExportTransactionsQuerySchema,
        response: {
          200: z.any(),
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          404: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const { format } = request.query;
        const exportData = await ExportService.getExportData(request.user.id, request.query);

        if (format === 'csv') {
          const buffer = CsvExportService.generate(exportData.records);
          return reply
            .header('Content-Type', 'text/csv; charset=utf-8')
            .header('Content-Disposition', `attachment; filename="extrato-${exportData.filenamePeriod}.csv"`)
            .status(200)
            .send(buffer);
        }

        if (format === 'xlsx') {
          const buffer = await XlsxExportService.generate(exportData.records, exportData.metrics);
          return reply
            .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            .header('Content-Disposition', `attachment; filename="extrato-${exportData.filenamePeriod}.xlsx"`)
            .status(200)
            .send(buffer);
        }

        if (format === 'pdf') {
          const buffer = await PdfExportService.generate(exportData.user, exportData.records, exportData.metrics);
          return reply
            .header('Content-Type', 'application/pdf')
            .header('Content-Disposition', `attachment; filename="relatorio-financeiro-${exportData.filenamePeriod}.pdf"`)
            .status(200)
            .send(buffer);
        }

        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Formato de exportação inválido.',
        });
      } catch (err: any) {
        if (err instanceof AccountAccessDeniedError) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: err.message,
          });
        }
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err?.message || 'Erro ao processar exportação.',
        });
      }
    }
  );
};
