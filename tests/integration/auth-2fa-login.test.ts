import { afterAll, beforeAll, describe, expect, it, vi, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { AuthService } from '../../src/services/auth.service.js';

describe('User Story 1: 2FA Login Interception & Verification Routes', () => {
  const app = buildApp();
  const testEmail = 'investidor@exemplo.com';
  const testUserId = '507f1f77bcf86cd799439011';
  const testChallengeId = '507f1f77bcf86cd799439099';

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. POST /api/auth/login retorna token diretamente quando 2FA está desativado', async () => {
    vi.spyOn(AuthService, 'login').mockResolvedValueOnce({
      token: 'jwt-token-sem-2fa',
      user: {
        id: testUserId,
        email: testEmail,
        hasAiKey: false,
        isTwoFactorEnabled: false,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testEmail,
        password: 'SenhaForte123!',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('token');
    expect(body.user.email).toBe(testEmail);
    expect(body.user.isTwoFactorEnabled).toBe(false);
  });

  it('2. POST /api/auth/login intercepta com 200 e challengeId quando 2FA está ativado', async () => {
    vi.spyOn(AuthService, 'login').mockResolvedValueOnce({
      requires2FA: true,
      challengeId: testChallengeId,
      message: 'Código de verificação enviado para o seu e-mail cadastrado.',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testEmail,
        password: 'SenhaForte123!',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.requires2FA).toBe(true);
    expect(body.challengeId).toBe(testChallengeId);
    expect(body).not.toHaveProperty('token');
  });

  it('3. POST /api/auth/login retorna 401 para credenciais inválidas', async () => {
    vi.spyOn(AuthService, 'login').mockRejectedValueOnce(new Error('Credenciais inválidas.'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testEmail,
        password: 'SenhaErrada123!',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Credenciais inválidas.');
  });

  it('4. POST /api/auth/2fa/verify valida código de 6 dígitos com formato inválido com 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/verify',
      payload: {
        challengeId: testChallengeId,
        code: '123', // menos de 6 dígitos
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('5. POST /api/auth/2fa/verify retorna 400 sob código incorreto', async () => {
    vi.spyOn(AuthService, 'verify2FA').mockRejectedValueOnce(
      new Error('Código de verificação incorreto. Tentativas restantes: 4')
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/verify',
      payload: {
        challengeId: testChallengeId,
        code: '123456',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Tentativas restantes: 4');
  });

  it('6. POST /api/auth/2fa/verify retorna 404 sob desafio expirado', async () => {
    vi.spyOn(AuthService, 'verify2FA').mockRejectedValueOnce(
      new Error('Código de verificação expirado. Solicite um novo código.')
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/verify',
      payload: {
        challengeId: testChallengeId,
        code: '123456',
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('expirado');
  });

  it('7. POST /api/auth/2fa/verify entrega token e sessão sob código correto', async () => {
    vi.spyOn(AuthService, 'verify2FA').mockResolvedValueOnce({
      token: 'jwt-token-2fa-sucesso',
      user: {
        id: testUserId,
        email: testEmail,
        hasAiKey: true,
        isTwoFactorEnabled: true,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/2fa/verify',
      payload: {
        challengeId: testChallengeId,
        code: '654321',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBe('jwt-token-2fa-sucesso');
    expect(body.user.isTwoFactorEnabled).toBe(true);
  });
});
