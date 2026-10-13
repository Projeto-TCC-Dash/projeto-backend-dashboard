import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { AuthService } from '../../src/services/auth.service.js';
import { GeminiApiError } from '../../src/utils/gemini-errors.js';

describe('Auth & Health Routes (HTTP Inject)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health deve responder com status de saúde', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    // Se o banco não estiver conectado durante o teste unitário, responde 503 com status degraded
    expect([200, 503]).toContain(res.statusCode);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('database');
  });

  it('POST /api/auth/register deve rejeitar senha curta (< 8 chars)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'teste@exemplo.com',
        password: '123',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('PUT /api/user/ai-key deve bloquear com 401 se não autenticado', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/user/ai-key',
      payload: {
        apiKey: 'AIzaSyFakeKeyForTest12345',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('PUT /api/user/ai-key deve aceitar e salvar a chave com 200 OK sob sucesso imediato (ACTIVE_VERIFIED)', async () => {
    const token = app.jwt.sign({ id: '507f1f77bcf86cd799439011', email: 'teste@exemplo.com' });
    vi.spyOn(AuthService, 'setApiKey').mockResolvedValueOnce({
      status: 'ACTIVE_VERIFIED',
      message: 'Chave BYOK do Google Gemini validada e armazenada com criptografia.',
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/user/ai-key',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        apiKey: 'AIzaSyExemploChaveValidaComMaisDeVinteCaracteres123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.status).toBe('ACTIVE_VERIFIED');
    expect(body.message).toContain('validada e armazenada');
  });

  it('PUT /api/user/ai-key deve aceitar e salvar a chave com 200 OK sob erro 503 do Google (ACTIVE_PROVISIONAL_DEMAND)', async () => {
    const token = app.jwt.sign({ id: '507f1f77bcf86cd799439011', email: 'teste@exemplo.com' });
    vi.spyOn(AuthService, 'setApiKey').mockResolvedValueOnce({
      status: 'ACTIVE_PROVISIONAL_DEMAND',
      message:
        'Chave de IA vinculada com sucesso! O Google AI Studio está com alta demanda temporária no momento, mas sua chave foi reconhecida e salva.',
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/user/ai-key',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        apiKey: 'AIzaSyChaveValidaSobAltaDemanda503DoGoogle123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.status).toBe('ACTIVE_PROVISIONAL_DEMAND');
    expect(body.message).toContain('alta demanda temporária');
  });

  it('PUT /api/user/ai-key deve rejeitar com 400 Bad Request se a chave for comprovadamente inválida (AUTH_ERROR)', async () => {
    const token = app.jwt.sign({ id: '507f1f77bcf86cd799439011', email: 'teste@exemplo.com' });
    vi.spyOn(AuthService, 'setApiKey').mockRejectedValueOnce(
      new GeminiApiError({
        type: 'AUTH_ERROR',
        statusCode: 400,
        userMessage: 'A chave de API fornecida é inválida ou foi revogada no Google AI Studio.',
        isTransient: false,
        originalMessage: 'API key not valid',
      })
    );

    const res = await app.inject({
      method: 'PUT',
      url: '/api/user/ai-key',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        apiKey: 'AIzaSyChaveFalsaTotalmenteInexistente12345',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Bad Request');
    expect(body.message).toContain('chave de API fornecida é inválida');
  });
});
