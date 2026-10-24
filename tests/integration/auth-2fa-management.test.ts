import { afterAll, beforeAll, describe, expect, it, vi, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { AuthService, ResendCooldownError } from '../../src/services/auth.service.js';
import { SessionService } from '../../src/services/session.service.js';

describe('User Story 3: 2FA Management (Enable, Confirm, Disable) & Resend Cooldown', () => {
  const app = buildApp();
  const testUserId = '507f1f77bcf86cd799439011';
  const testSessionId = '123e4567-e89b-12d3-a456-426614174000';
  const testChallengeId = '507f1f77bcf86cd799439099';
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

  describe('POST /api/auth/2fa/enable', () => {
    it('deve rejeitar com 401 se não autenticado', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/2fa/enable',
      });
      expect(res.statusCode).toBe(401);
    });

    it('deve iniciar ativação e retornar challengeId com 200', async () => {
      vi.spyOn(AuthService, 'initiateEnable2FA').mockResolvedValueOnce({
        challengeId: testChallengeId,
        message: 'Código de confirmação enviado para seu e-mail.',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/2fa/enable',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.challengeId).toBe(testChallengeId);
    });

    it('deve retornar 400 se 2FA já estiver ativado', async () => {
      vi.spyOn(AuthService, 'initiateEnable2FA').mockRejectedValueOnce(
        new Error('A autenticação em dois fatores já está ativada.')
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/2fa/enable',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('já está ativada');
    });
  });

  describe('POST /api/auth/2fa/confirm-enable', () => {
    it('deve retornar 400 se o código de confirmação for incorreto', async () => {
      vi.spyOn(AuthService, 'confirmEnable2FA').mockRejectedValueOnce(
        new Error('Código de verificação incorreto. Tentativas restantes: 4')
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/2fa/confirm-enable',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          challengeId: testChallengeId,
          code: '000000',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('deve confirmar ativação com 200 e isTwoFactorEnabled=true sob código válido', async () => {
      vi.spyOn(AuthService, 'confirmEnable2FA').mockResolvedValueOnce({
        success: true,
        isTwoFactorEnabled: true,
        message: 'Autenticação em dois fatores ativada com sucesso.',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/2fa/confirm-enable',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          challengeId: testChallengeId,
          code: '123456',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.isTwoFactorEnabled).toBe(true);
    });
  });

  describe('POST /api/auth/2fa/resend', () => {
    it('deve reenviar novo código com 200 sob chamada válida', async () => {
      vi.spyOn(AuthService, 'resendOtp').mockResolvedValueOnce({
        success: true,
        message: 'Novo código de verificação enviado com sucesso para o seu e-mail.',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/2fa/resend',
        payload: {
          challengeId: testChallengeId,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
    });

    it('deve retornar 429 Too Many Requests com retryAfterSeconds se em cooldown (<60s)', async () => {
      vi.spyOn(AuthService, 'resendOtp').mockRejectedValueOnce(
        new ResendCooldownError('Aguarde 45 segundos antes de solicitar um novo código.', 45)
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/2fa/resend',
        payload: {
          challengeId: testChallengeId,
        },
      });

      expect(res.statusCode).toBe(429);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Too Many Requests');
      expect(body.retryAfterSeconds).toBe(45);
      expect(body.message).toContain('45 segundos');
    });
  });

  describe('POST /api/auth/2fa/disable', () => {
    it('deve retornar 401 se a senha de confirmação estiver incorreta', async () => {
      vi.spyOn(AuthService, 'disable2FA').mockRejectedValueOnce(
        new Error('Senha incorreta. Não foi possível desativar o 2FA.')
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/2fa/disable',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          password: 'SenhaIncorreta',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('Senha incorreta');
    });

    it('deve desativar o 2FA com 200 e isTwoFactorEnabled=false quando senha estiver correta', async () => {
      vi.spyOn(AuthService, 'disable2FA').mockResolvedValueOnce({
        success: true,
        isTwoFactorEnabled: false,
        message: 'Autenticação em dois fatores desativada com sucesso.',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/2fa/disable',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          password: 'SenhaCorreta123!',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.isTwoFactorEnabled).toBe(false);
    });
  });
});
