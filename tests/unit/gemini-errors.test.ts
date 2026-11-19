import { describe, expect, it, vi } from 'vitest';
import { GeminiService } from '../../src/services/gemini.service.js';
import {
  GeminiApiError,
  GeminiErrorParser,
  withGeminiRetry,
} from '../../src/utils/gemini-errors.js';

describe('GeminiErrorParser & withGeminiRetry Unit Tests', () => {
  describe('GeminiErrorParser.parse', () => {
    it('deve identificar erro 503 com alta demanda como UPSTREAM_UNAVAILABLE', () => {
      const err = new Error(
        JSON.stringify({
          error: {
            code: 503,
            message:
              'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
            status: 'UNAVAILABLE',
          },
        })
      );

      const parsed = GeminiErrorParser.parse(err);
      expect(parsed.type).toBe('UPSTREAM_UNAVAILABLE');
      expect(parsed.statusCode).toBe(503);
      expect(parsed.isTransient).toBe(true);
      expect(parsed.userMessage).toContain('alta demanda no momento');
    });

    it('deve identificar erro 429 de quota/rate limit como RATE_LIMIT_ERROR', () => {
      const err = {
        status: 429,
        message: 'Resource has been exhausted (e.g. check quota). RESOURCE_EXHAUSTED',
      };

      const parsed = GeminiErrorParser.parse(err);
      expect(parsed.type).toBe('RATE_LIMIT_ERROR');
      expect(parsed.statusCode).toBe(429);
      expect(parsed.isTransient).toBe(true);
      expect(parsed.userMessage).toContain('cota');
    });

    it('deve identificar erro de chave inválida ou revogada como AUTH_ERROR', () => {
      const err = new Error('API key not valid. Please pass a valid API key. (400)');

      const parsed = GeminiErrorParser.parse(err);
      expect(parsed.type).toBe('AUTH_ERROR');
      expect(parsed.statusCode).toBe(400);
      expect(parsed.isTransient).toBe(false);
      expect(parsed.userMessage).toContain('chave da API Gemini parece inválida');
    });

    it('deve identificar erro de PERMISSION_DENIED (403) como AUTH_ERROR', () => {
      const err = {
        code: 403,
        status: 'PERMISSION_DENIED',
        message: 'Caller does not have permission to access project',
      };

      const parsed = GeminiErrorParser.parse(err);
      expect(parsed.type).toBe('AUTH_ERROR');
      expect(parsed.statusCode).toBe(400);
      expect(parsed.isTransient).toBe(false);
    });

    it('deve identificar erro de timeout/rede como NETWORK_ERROR com status 503', () => {
      const err = new Error('fetch failed: connect ETIMEDOUT 142.250.190.42:443');

      const parsed = GeminiErrorParser.parse(err);
      expect(parsed.type).toBe('NETWORK_ERROR');
      expect(parsed.statusCode).toBe(503);
      expect(parsed.isTransient).toBe(true);
    });

    it('deve identificar AbortError / request timeout como NETWORK_ERROR com status 503', () => {
      const err = new Error('The operation was aborted due to timeout');

      const parsed = GeminiErrorParser.parse(err);
      expect(parsed.type).toBe('NETWORK_ERROR');
      expect(parsed.statusCode).toBe(503);
      expect(parsed.isTransient).toBe(true);
    });

    it('deve identificar erro 404 de modelo não encontrado como MODEL_NOT_FOUND sem retentativa', () => {
      const err = {
        status: 404,
        message: 'models/gemini-3.8-flash is not found for API version v1beta',
      };

      const parsed = GeminiErrorParser.parse(err);
      expect(parsed.type).toBe('MODEL_NOT_FOUND');
      expect(parsed.statusCode).toBe(503);
      expect(parsed.isTransient).toBe(false);
    });

    it('deve classificar erro inesperado como UNKNOWN_ERROR com status 503', () => {
      const err = new Error('Random unexpected internal bug');

      const parsed = GeminiErrorParser.parse(err);
      expect(parsed.type).toBe('UNKNOWN_ERROR');
      expect(parsed.statusCode).toBe(503);
      expect(parsed.isTransient).toBe(false);
    });
  });

  describe('withGeminiRetry', () => {
    it('deve retornar o resultado imediatamente se a operação for bem-sucedida', async () => {
      const operation = vi.fn().mockResolvedValue('resultado-ok');
      const result = await withGeminiRetry(operation, 2, 10);

      expect(result).toBe('resultado-ok');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('deve retentar sob erro transitório 503 e ter sucesso na segunda tentativa', async () => {
      const transientError = new Error('503 UNAVAILABLE - High demand');
      const operation = vi
        .fn()
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce('sucesso-na-tentativa-2');

      const result = await withGeminiRetry(operation, 2, 10);

      expect(result).toBe('sucesso-na-tentativa-2');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('não deve retentar sob erro de AUTH_ERROR (400), falhando imediatamente', async () => {
      const authError = new Error('API key not valid');
      const operation = vi.fn().mockRejectedValue(authError);

      await expect(withGeminiRetry(operation, 2, 10)).rejects.toThrow(GeminiApiError);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('deve esgotar as tentativas e lançar GeminiApiError com status 503 se persistir', async () => {
      const persistentError = new Error('503 UNAVAILABLE');
      const operation = vi.fn().mockRejectedValue(persistentError);

      try {
        await withGeminiRetry(operation, 2, 10);
        expect.unreachable('Deveria ter lançado GeminiApiError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(GeminiApiError);
        expect(err.statusCode).toBe(503);
        expect(err.type).toBe('UPSTREAM_UNAVAILABLE');
      }
      expect(operation).toHaveBeenCalledTimes(3); // 1 inicial + 2 retries
    });
  });

  describe('GeminiService.validateApiKey', () => {
    it('não deve aceitar chave provisoriamente quando ocorrer NETWORK_ERROR e deve preservar originalMessage com cause', async () => {
      const rootCause = Object.assign(new TypeError('Undici globalDispatcher is not available'), {
        code: 'ERR_UNDICI',
      });
      const networkErr = new TypeError('fetch failed', { cause: rootCause });

      vi.spyOn(GeminiService as any, 'createClient').mockReturnValue({
        models: {
          generateContent: vi.fn().mockRejectedValue(networkErr),
        },
      });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await expect(
          GeminiService.validateApiKey('AIzaSyDummyKeyWithMoreThan20Chars')
        ).rejects.toMatchObject({
          statusCode: 503,
          type: 'NETWORK_ERROR',
          originalMessage: expect.stringContaining('Undici globalDispatcher is not available'),
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '❌ Falha na validação ativa da API Key no Gemini:',
          expect.stringContaining('Undici globalDispatcher is not available')
        );
      } finally {
        consoleErrorSpy.mockRestore();
        vi.restoreAllMocks();
      }
    });
  });

  describe('GeminiErrorParser cause extraction', () => {
    it('deve extrair detalhes de error.cause em TypeError fetch failed', () => {
      const err = new TypeError('fetch failed', {
        cause: Object.assign(new Error('connect ETIMEDOUT 142.250.0.1:443'), {
          code: 'ETIMEDOUT',
        }),
      });

      const parsed = GeminiErrorParser.parse(err);
      expect(parsed.type).toBe('NETWORK_ERROR');
      expect(parsed.originalMessage).toContain('fetch failed');
      expect(parsed.originalMessage).toContain('ETIMEDOUT');
    });
  });
});
