import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import {
  AuthService,
  GoogleUserNotFoundError,
} from '../../src/services/auth.service.js';
import { InvalidGoogleTokenError } from '../../src/services/google-auth.service.js';
import { SessionService } from '../../src/services/session.service.js';
import { UserService } from '../../src/services/user.service.js';

describe('User Story 3: Google Login & Profile Social Metadata', () => {
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

  describe('POST /api/auth/google (Google Login)', () => {
    it('deve retornar 400 se o corpo da requisição não contiver idToken', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('deve retornar 400 se o idToken for rejeitado pela validação do Google', async () => {
      vi.spyOn(AuthService, 'loginWithGoogle').mockRejectedValueOnce(
        new InvalidGoogleTokenError('Token do Google inválido ou expirado.')
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: { idToken: 'invalid-token-12345' },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('Token do Google inválido');
    });

    it('deve retornar 401 se a conta Google não estiver vinculada a nenhum usuário cadastrado', async () => {
      vi.spyOn(AuthService, 'loginWithGoogle').mockRejectedValueOnce(
        new GoogleUserNotFoundError()
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: { idToken: 'unlinked-google-token' },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('Nenhuma conta vinculada a este perfil Google');
    });

    it('deve emitir token JWT diretamente quando 2FA estiver desativado', async () => {
      vi.spyOn(AuthService, 'loginWithGoogle').mockResolvedValueOnce({
        token: 'signed-session-jwt-token',
        user: {
          id: testUserId,
          email: 'usuario.social@gmail.com',
          hasAiKey: false,
          isTwoFactorEnabled: false,
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: { idToken: 'valid-google-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.token).toBe('signed-session-jwt-token');
      expect(body.user.email).toBe('usuario.social@gmail.com');
      expect(body.requires2FA).toBeUndefined();
    });

    it('deve retornar desafio de 2FA quando o usuário possuir autenticação em duas etapas ativada', async () => {
      const challengeId = '507f1f77bcf86cd799439099';
      vi.spyOn(AuthService, 'loginWithGoogle').mockResolvedValueOnce({
        requires2FA: true,
        challengeId,
        message: 'Código de verificação enviado para o seu e-mail cadastrado.',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: { idToken: 'valid-google-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.requires2FA).toBe(true);
      expect(body.challengeId).toBe(challengeId);
      expect(body.token).toBeUndefined();
    });

    it('deve aceitar login enviando { credential: "..." }', async () => {
      const spy = vi.spyOn(AuthService, 'loginWithGoogle').mockResolvedValueOnce({
        token: 'signed-credential-jwt',
        user: {
          id: testUserId,
          email: 'usuario.credential@gmail.com',
          hasAiKey: false,
          isTwoFactorEnabled: false,
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: { credential: 'google-gis-credential-token-12345' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.token).toBe('signed-credential-jwt');
      expect(spy).toHaveBeenCalledWith(
        'google-gis-credential-token-12345',
        expect.any(Function),
        expect.any(Object)
      );
    });
  });

  describe('GET /api/user/profile (Social Metadata)', () => {
    it('deve refletir o status de vínculo do Google no subobjeto security', async () => {
      const fakeLinkedAt = new Date('2026-10-24T18:00:00.000Z');
      vi.spyOn(UserService, 'getProfile').mockResolvedValueOnce({
        id: testUserId,
        email: 'investidor@exemplo.com',
        hasAiKey: false,
        security: {
          twoFactorEnabled: false,
          hasLocalPassword: true,
          googleLinked: true,
          googleEmail: 'investidor.social@gmail.com',
          googleLinkedAt: fakeLinkedAt,
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/user/profile',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.security.googleLinked).toBe(true);
      expect(body.security.googleEmail).toBe('investidor.social@gmail.com');
      expect(body.security.hasLocalPassword).toBe(true);
    });
  });
});
