import fs from 'node:fs';
import path from 'node:path';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { FISCAL_PROOF_CONFIG } from '../config/constants.js';
import { FiscalProofDocumentModel } from '../models/fiscal-proof.model.js';
import { requireAiKey, requireAuth } from '../plugins/auth.plugin.js';
import {
  FiscalAnnualSummaryResponseSchema,
  FiscalOcrResponseSchema,
  FiscalSummaryQuerySchema,
  UpdateTransactionFiscalBodySchema,
} from '../schemas/fiscal.schemas.js';
import { TransactionIdParamSchema } from '../schemas/transaction.schemas.js';
import { AuthService } from '../services/auth.service.js';
import { FiscalOcrService } from '../services/fiscal-ocr.service.js';
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

  // POST /api/fiscal/ocr
  fastify.post(
    '/api/fiscal/ocr',
    {
      preHandler: [requireAuth, requireAiKey],
      schema: {
        description: 'Upload de comprovante fiscal com leitura inteligente (OCR) via Gemini Vision e chave BYOK',
        tags: ['Fiscal'],
        security: [{ bearerAuth: [] }],
        response: {
          200: FiscalOcrResponseSchema,
          400: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          401: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
          403: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }),
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

      const allowedMimes = FISCAL_PROOF_CONFIG.ALLOWED_MIME_TYPES as readonly string[];
      if (!allowedMimes.includes(data.mimetype)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Formato de arquivo não suportado. Formatos aceitos: JPG, PNG, WebP e PDF.',
        });
      }

      const buffer = await data.toBuffer();
      if (buffer.length > FISCAL_PROOF_CONFIG.MAX_SIZE_BYTES) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'O arquivo excede o limite máximo permitido de 10MB.',
        });
      }

      // Salvar arquivo no diretório de comprovantes
      const uploadDir = path.join(process.cwd(), FISCAL_PROOF_CONFIG.UPLOAD_DIR);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const safeFilename = path.basename(data.filename).replace(/\s+/g, '_');
      const storedFilename = `${request.user.id}-${Date.now()}-${safeFilename}`;
      const targetPath = path.join(uploadDir, storedFilename);
      await fs.promises.writeFile(targetPath, buffer);

      // Descriptografar chave BYOK efemeramente
      const apiKey = await AuthService.getDecryptedApiKey(request.user.id);

      // Executar OCR estruturado com Gemini Vision
      const extracted = await FiscalOcrService.extractReceiptData(
        apiKey,
        buffer,
        data.mimetype
      );

      // Persistir documento na coleção fiscal_proofs
      const proofDoc = await FiscalProofDocumentModel.create({
        userId: request.user.id,
        originalFilename: data.filename,
        storedFilename,
        mimeType: data.mimetype,
        sizeBytes: buffer.length,
        extractedData: {
          providerDocument: extracted.providerDocument,
          providerName: extracted.providerName,
          totalAmount: extracted.totalAmount,
          issueDate: extracted.issueDate ? new Date(extracted.issueDate) : undefined,
          description: extracted.description,
        },
      });

      // Buscar transações de débito bancário compatíveis
      const suggestedMatches = await FiscalService.findSuggestedMatches(
        request.user.id,
        extracted.totalAmount,
        extracted.issueDate
      );

      return reply.status(200).send({
        proofDocumentId: proofDoc._id.toString(),
        originalFilename: data.filename,
        extractedData: extracted,
        suggestedMatches,
      });
    }
  );
};
