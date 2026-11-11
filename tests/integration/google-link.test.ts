import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { AuthService, GoogleAccountConflictError } from '../../src/services/auth.service.js';
import { GoogleOAuthService, InvalidGoogleTokenError } from '../../src/services/google-auth.service.js';
import { SessionService } from '../../src/services/session.service.js';

describe('User Story 1: Google Account Linking (POST /api/auth/google/link)', () => {
  const app = buildApp();
  const testUserId = '507f1f77bcf86cd799439011';
  const testSessionId = '123e4567-e89b-12d3-a456-426614174000';
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({
      id: testUserId,
      email: 'investidor@exemplo.com',
      sessionId: testSessionId,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(SessionService, 'isSessionActive').mockResolvedValue(true);
  });

  it('deve retornar 401 se a requisição não contiver cabeçalho Authorization', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google/link',
      payload: { idToken: 'valid-google-id-token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('deve aceitar payload vazio {} em ambiente de desenvolvimento/teste e vincular com sucesso', async () => {
    const fakeLinkedAt = new Date('2026-10-24T18:00:00.000Z');
    vi.spyOn(AuthService, 'linkGoogleAccount').mockResolvedValueOnce({
      id: testUserId,
      email: 'investidor@exemplo.com',
      hasAiKey: false,
      security: {
        hasLocalPassword: true,
        googleLinked: true,
        googleEmail: 'investidor@exemplo.com',
        googleLinkedAt: fakeLinkedAt,
      },
      success: true,
      message: 'Conta Google vinculada com sucesso.',
      googleAccount: {
        googleEmail: 'investidor@exemplo.com',
        linkedAt: fakeLinkedAt,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google/link',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.security?.googleLinked).toBe(true);
  });

  it('deve retornar 400 se o corpo da requisição não contiver idToken em produção', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google/link',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('deve retornar 400 se o token do Google for inválido ou rejeitado pelo provedor', async () => {
    vi.spyOn(AuthService, 'linkGoogleAccount').mockRejectedValueOnce(
      new InvalidGoogleTokenError('Token do Google inválido ou expirado.')
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google/link',
      headers: { authorization: `Bearer ${token}` },
      payload: { idToken: 'invalid-expired-token' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Token do Google inválido');
  });

  it('deve retornar 409 Conflict se a conta Google já estiver vinculada a outro usuário', async () => {
    vi.spyOn(AuthService, 'linkGoogleAccount').mockRejectedValueOnce(
      new GoogleAccountConflictError(
        'Esta conta Google já está vinculada a outro perfil cadastrado.'
      )
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google/link',
      headers: { authorization: `Bearer ${token}` },
      payload: { idToken: 'already-linked-token' },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('já está vinculada a outro perfil');
  });

  it('deve retornar 200 com os dados de vínculo quando a vinculação for bem-sucedida', async () => {
    const fakeLinkedAt = new Date('2026-10-24T18:00:00.000Z');
    vi.spyOn(AuthService, 'linkGoogleAccount').mockResolvedValueOnce({
      success: true,
      message: 'Conta Google vinculada com sucesso.',
      googleAccount: {
        googleEmail: 'usuario.social@gmail.com',
        linkedAt: fakeLinkedAt,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google/link',
      headers: { authorization: `Bearer ${token}` },
      payload: { idToken: 'valid-google-id-token-12345' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Conta Google vinculada com sucesso.');
    expect(body.googleAccount.googleEmail).toBe('usuario.social@gmail.com');
  });

  it('deve aceitar campos alternativos no body como credential, token ou id_token', async () => {
    const fakeLinkedAt = new Date('2026-10-24T18:00:00.000Z');
    const spy = vi.spyOn(AuthService, 'linkGoogleAccount').mockResolvedValue({
      success: true,
      message: 'Conta Google vinculada com sucesso.',
      googleAccount: {
        googleEmail: 'usuario.social@gmail.com',
        linkedAt: fakeLinkedAt,
      },
    });

    // Testando com "credential" (formato padrão retornado pelo Google Identity Services)
    const resCredential = await app.inject({
      method: 'POST',
      url: '/api/auth/google/link',
      headers: { authorization: `Bearer ${token}` },
      payload: { credential: 'google-gis-credential-token-12345' },
    });
    expect(resCredential.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledWith(testUserId, 'google-gis-credential-token-12345');

    // Testando com "token"
    const resToken = await app.inject({
      method: 'POST',
      url: '/api/auth/google/link',
      headers: { authorization: `Bearer ${token}` },
      payload: { token: 'google-token-field-12345' },
    });
    expect(resToken.statusCode).toBe(200);
  });
});
