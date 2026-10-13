import { describe, expect, it, vi } from 'vitest';
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
      expect(parsed.userMessage).toContain('alta demanda temporária');
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
      expect(parsed.userMessage).toContain('chave de API fornecida é inválida');
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

    it('deve classificar erro inesperado como UNKNOWN_ERROR com status 500', () => {
      const err = new Error('Random unexpected internal bug');

      const parsed = GeminiErrorParser.parse(err);
      expect(parsed.type).toBe('UNKNOWN_ERROR');
      expect(parsed.statusCode).toBe(500);
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
});
