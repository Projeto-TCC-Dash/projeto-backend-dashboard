import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { TransactionModel } from '../../src/models/transaction.model.js';
import { UserModel } from '../../src/models/user.model.js';
import { AuthService } from '../../src/services/auth.service.js';
import { ChatService } from '../../src/services/chat.service.js';
import { GeminiService } from '../../src/services/gemini.service.js';
import { TransactionService } from '../../src/services/transaction.service.js';
import { GeminiApiError } from '../../src/utils/gemini-errors.js';

describe('AI Routes Semantic Error Handling (HTTP 503 / 429)', () => {
  const app = buildApp();
  const userId = '652d8e6a1f8b3c9a10000002';
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ id: userId, email: 'usuario.ai@exemplo.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/transactions/categorize', () => {
    it('deve retornar 503 Service Unavailable quando o Google Gemini falhar com 503', async () => {
      // Mock de usuário com chave BYOK
      vi.spyOn(UserModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: userId,
          email: 'usuario.ai@exemplo.com',
          hasAiKey: () => true,
        }),
      } as any);

      vi.spyOn(TransactionService, 'getUniqueUncategorizedMerchants').mockResolvedValueOnce([
        'PAO DE ACUCAR',
        'POSTO IPIRANGA',
      ]);

      vi.spyOn(AuthService, 'getDecryptedApiKey').mockResolvedValueOnce('AIzaSyValidKey1234567890');

      vi.spyOn(GeminiService, 'categorizeMerchants').mockRejectedValueOnce(
        new GeminiApiError({
          type: 'UPSTREAM_UNAVAILABLE',
          statusCode: 503,
          userMessage:
            'Os servidores do Google AI Studio estão com alta demanda temporária no momento. Por favor, tente novamente em instantes.',
          isTransient: true,
          originalMessage: 'This model is currently experiencing high demand',
        })
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/transactions/categorize',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.statusCode).toBe(503);
      expect(body.error).toBe('Service Unavailable');
      expect(body.message).toContain('alta demanda temporária');
    });

    it('deve retornar 429 Too Many Requests quando a cota da chave do usuário for atingida', async () => {
      vi.spyOn(UserModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: userId,
          email: 'usuario.ai@exemplo.com',
          hasAiKey: () => true,
        }),
      } as any);

      vi.spyOn(TransactionService, 'getUniqueUncategorizedMerchants').mockResolvedValueOnce([
        'DROGA RAIA',
      ]);

      vi.spyOn(AuthService, 'getDecryptedApiKey').mockResolvedValueOnce('AIzaSyValidKey1234567890');

      vi.spyOn(GeminiService, 'categorizeMerchants').mockRejectedValueOnce(
        new GeminiApiError({
          type: 'RATE_LIMIT_ERROR',
          statusCode: 429,
          userMessage:
            'O limite de requisições ou cota da sua chave no Google AI Studio foi atingido temporariamente.',
          isTransient: true,
          originalMessage: 'RESOURCE_EXHAUSTED',
        })
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/transactions/categorize',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(429);
      const body = JSON.parse(res.body);
      expect(body.statusCode).toBe(429);
      expect(body.error).toBe('Too Many Requests');
      expect(body.message).toContain('cota');
    });
  });

  describe('GET /api/analysis/:month', () => {
    it('deve retornar 503 Service Unavailable se a IA falhar sob alta demanda durante a análise', async () => {
      vi.spyOn(UserModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: userId,
          email: 'usuario.ai@exemplo.com',
          hasAiKey: () => true,
        }),
      } as any);

      // Simula transações presentes no mês
      vi.spyOn(TransactionModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([
            {
              amount: 5000,
              date: new Date('2026-10-05T10:00:00Z'),
              category: 'Outros',
              cleanDescription: 'SALARIO',
            },
          ]),
        }),
      } as any);

      vi.spyOn(AuthService, 'getDecryptedApiKey').mockResolvedValueOnce('AIzaSyValidKey1234567890');

      vi.spyOn(GeminiService, 'generateFinancialDiagnosis').mockRejectedValueOnce(
        new GeminiApiError({
          type: 'UPSTREAM_UNAVAILABLE',
          statusCode: 503,
          userMessage:
            'Os servidores do Google AI Studio estão com alta demanda temporária no momento. Por favor, tente novamente em instantes.',
          isTransient: true,
          originalMessage: '503 UNAVAILABLE',
        })
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/analysis/2026-10?forceRefresh=true',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.statusCode).toBe(503);
      expect(body.error).toBe('Service Unavailable');
      expect(body.message).toContain('alta demanda temporária');
    });
  });

  describe('POST /api/chat/stream', () => {
    it('deve emitir evento de erro SSE estruturado com código 503 sob falha do Google', async () => {
      vi.spyOn(UserModel, 'findById').mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: userId,
          email: 'usuario.ai@exemplo.com',
          hasAiKey: () => true,
        }),
      } as any);

      vi.spyOn(AuthService, 'getDecryptedApiKey').mockResolvedValueOnce('AIzaSyValidKey1234567890');

      vi.spyOn(ChatService, 'getOrCreateSession').mockResolvedValueOnce({
        _id: '652d8e6a1f8b3c9a10000003',
        userId,
        messages: [],
      } as any);

      vi.spyOn(ChatService, 'buildSystemInstruction').mockResolvedValueOnce(
        'Você é um assistente financeiro.'
      );

      // Simula gerador do stream lançando GeminiApiError
      async function* mockFailingStream(): AsyncIterable<string> {
        throw new GeminiApiError({
          type: 'UPSTREAM_UNAVAILABLE',
          statusCode: 503,
          userMessage:
            'Os servidores do Google AI Studio estão com alta demanda temporária no momento. Por favor, tente novamente em instantes.',
          isTransient: true,
          originalMessage: '503 UNAVAILABLE',
        });
      }

      vi.spyOn(GeminiService, 'streamFinancialAdvisor').mockImplementationOnce(mockFailingStream as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/stream',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          message: 'Como estão meus investimentos?',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.body).toContain('"statusCode":503');
      expect(res.body).toContain('"code":"UPSTREAM_UNAVAILABLE"');
      expect(res.body).toContain('alta demanda temporária');
    });
  });
});
