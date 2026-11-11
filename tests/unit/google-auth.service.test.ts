import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GoogleOAuthService,
  InvalidGoogleTokenError,
} from '../../src/services/google-auth.service.js';
import { env } from '../../src/config/env.js';

describe('GoogleOAuthService Unit Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    GoogleOAuthService.setCustomVerifier(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    GoogleOAuthService.setCustomVerifier(null);
    vi.restoreAllMocks();
  });

  it('deve rejeitar tokens vazios, nulos ou muito curtos', async () => {
    await expect(GoogleOAuthService.verifyIdToken('')).rejects.toThrow(InvalidGoogleTokenError);
    await expect(GoogleOAuthService.verifyIdToken('short')).rejects.toThrow(InvalidGoogleTokenError);
    await expect(GoogleOAuthService.verifyIdToken(null as any)).rejects.toThrow(
      InvalidGoogleTokenError
    );
  });

  it('deve validar e retornar payload correto quando o tokeninfo do Google responder 200', async () => {
    const mockPayload = {
      iss: 'https://accounts.google.com',
      sub: 'google_123456789',
      email: 'usuario.teste@gmail.com',
      email_verified: 'true',
      name: 'Usuário Teste',
      picture: 'https://lh3.googleusercontent.com/avatar.jpg',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    } as any);

    const result = await GoogleOAuthService.verifyIdToken('valid_google_id_token_12345');

    expect(result).toEqual({
      googleId: 'google_123456789',
      googleEmail: 'usuario.teste@gmail.com',
      name: 'Usuário Teste',
      picture: 'https://lh3.googleusercontent.com/avatar.jpg',
    });
  });

  it('deve rejeitar quando a API do Google retornar erro (ex: 400 token expirado)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_token' }),
    } as any);

    await expect(
      GoogleOAuthService.verifyIdToken('expired_or_invalid_google_token')
    ).rejects.toThrow(InvalidGoogleTokenError);
  });

  it('deve rejeitar se o emissor (iss) não for do Google', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iss: 'https://fake-issuer.com',
        sub: 'fake_123',
        email: 'user@fake.com',
        email_verified: 'true',
      }),
    } as any);

    await expect(
      GoogleOAuthService.verifyIdToken('fake_issuer_token_123456789')
    ).rejects.toThrow('Emissor do token do Google inválido.');
  });

  it('deve rejeitar se o e-mail não estiver verificado', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iss: 'accounts.google.com',
        sub: 'unverified_123',
        email: 'user@gmail.com',
        email_verified: 'false',
      }),
    } as any);

    await expect(
      GoogleOAuthService.verifyIdToken('unverified_email_token_123456')
    ).rejects.toThrow('O e-mail da conta Google não está verificado.');
  });

  it('deve utilizar o customVerifier quando configurado', async () => {
    GoogleOAuthService.setCustomVerifier(async (token) => {
      if (token === 'custom-mock-token') {
        return {
          googleId: 'mocked_id_999',
          googleEmail: 'mocked@domain.com',
        };
      }
      throw new InvalidGoogleTokenError('Custom token error');
    });

    const result = await GoogleOAuthService.verifyIdToken('custom-mock-token');
    expect(result.googleId).toBe('mocked_id_999');
    expect(result.googleEmail).toBe('mocked@domain.com');

    await expect(GoogleOAuthService.verifyIdToken('other-token-123456')).rejects.toThrow(
      'Custom token error'
    );
  });

  it('deve validar com sucesso via userinfo quando for um access_token (id_token retorna 400)', async () => {
    // 1ª chamada (tokeninfo?id_token) falha com 400
    // 2ª chamada (userinfo) tem sucesso com 200
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_token' }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          sub: 'access_sub_888',
          email: 'access.user@gmail.com',
          email_verified: true,
          name: 'Access User',
        }),
      } as any);

    const result = await GoogleOAuthService.verifyIdToken('ya29.access_token_12345');
    expect(result.googleId).toBe('access_sub_888');
    expect(result.googleEmail).toBe('access.user@gmail.com');
  });
});
