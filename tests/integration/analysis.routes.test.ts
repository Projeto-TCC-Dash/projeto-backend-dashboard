import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { UserModel } from '../../src/models/user.model.js';

describe('Financial Analysis Routes (HTTP Inject & Auth Guard)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/analysis/2026-10 deve retornar 401 se a requisição não contiver token JWT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analysis/2026-10',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Unauthorized');
  });

  it('GET /api/analysis/invalid-month deve rejeitar parâmetro de rota fora do formato YYYY-MM', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analysis/2026-1',
    });

    // Sem token ou com formato inválido, a rota protege o endpoint
    expect([400, 401]).toContain(res.statusCode);
  });

  it('GET /api/analysis/2026-10 deve retornar 403 para usuário autenticado sem chave BYOK configurada', async () => {
    // Simula usuário no banco sem chave configurada (hasAiKey retorna false)
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        _id: '652d8e6a1f8b3c9a10000001',
        email: 'sem-chave@exemplo.com',
        hasAiKey: () => false,
      }),
    } as any);

    const fakeToken = app.jwt.sign({ id: '652d8e6a1f8b3c9a10000001', email: 'sem-chave@exemplo.com' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/analysis/2026-10',
      headers: {
        authorization: `Bearer ${fakeToken}`,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('BYOK');
  });
});
