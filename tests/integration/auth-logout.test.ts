import { afterAll, beforeAll, describe, expect, it, vi, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { SessionService } from '../../src/services/session.service.js';

describe('User Story 2: Secure Logout & Session Revocation Routes', () => {
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
  });

  it('1. POST /api/auth/logout rejeita requisição não autenticada com 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    expect(res.statusCode).toBe(401);
  });

  it('2. POST /api/auth/logout encerra a sessão ativa do dispositivo com 200', async () => {
    const revokeSpy = vi.spyOn(SessionService, 'revokeSession').mockResolvedValueOnce(true);
    vi.spyOn(SessionService, 'isSessionActive').mockResolvedValueOnce(true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Sessão encerrada com sucesso.');
    expect(revokeSpy).toHaveBeenCalledWith(testSessionId);
  });

  it('3. POST /api/auth/logout com allDevices=true revoga todas as sessões do usuário', async () => {
    const revokeAllSpy = vi
      .spyOn(SessionService, 'revokeAllUserSessions')
      .mockResolvedValueOnce(3);
    vi.spyOn(SessionService, 'isSessionActive').mockResolvedValueOnce(true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        allDevices: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(revokeAllSpy).toHaveBeenCalledWith(testUserId);
  });

  it('4. Requisição com token de sessão já revogada é sumariamente bloqueada com 401', async () => {
    // Simula que a sessão foi revogada no banco
    vi.spyOn(SessionService, 'isSessionActive').mockResolvedValueOnce(false);

    const res = await app.inject({
      method: 'GET',
      url: '/api/user/profile',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Sessão expirada ou revogada');
  });
});
