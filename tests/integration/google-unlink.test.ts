import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import {
  AuthService,
  CannotUnlinkGoogleWithoutPasswordError,
  GoogleAccountNotLinkedError,
} from '../../src/services/auth.service.js';
import { SessionService } from '../../src/services/session.service.js';

describe('User Story 2: Google Account Unlinking (DELETE /api/auth/google/unlink)', () => {
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
      method: 'DELETE',
      url: '/api/auth/google/unlink',
    });
    expect(res.statusCode).toBe(401);
  });

  it('deve retornar 400 se o usuário não possuir conta Google vinculada', async () => {
    vi.spyOn(AuthService, 'unlinkGoogleAccount').mockRejectedValueOnce(
      new GoogleAccountNotLinkedError('Nenhuma conta Google vinculada a este perfil.')
    );

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/google/unlink',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Nenhuma conta Google vinculada');
  });

  it('deve retornar 400 se o usuário tentar desvincular sem possuir senha local (guarda prevent lock-out)', async () => {
    vi.spyOn(AuthService, 'unlinkGoogleAccount').mockRejectedValueOnce(
      new CannotUnlinkGoogleWithoutPasswordError(
        'Não é possível desvincular a conta Google pois ela é o único método de autenticação da conta. Cadastre uma senha antes de desvincular.'
      )
    );

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/google/unlink',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('único método de autenticação');
  });

  it('deve retornar 200 com mensagem de sucesso quando a conta Google for desvinculada', async () => {
    vi.spyOn(AuthService, 'unlinkGoogleAccount').mockResolvedValueOnce({
      success: true,
      message: 'Conta Google desvinculada com sucesso.',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/google/unlink',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Conta Google desvinculada com sucesso.');
  });
});
