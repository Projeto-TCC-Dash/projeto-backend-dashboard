import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

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
});
