import { env } from '../config/env.js';

export class InvalidGoogleTokenError extends Error {
  public statusCode = 400;

  constructor(message = 'Token do Google inválido ou expirado.') {
    super(message);
    this.name = 'InvalidGoogleTokenError';
  }
}

export interface GoogleTokenPayload {
  googleId: string;
  googleEmail: string;
  name?: string;
  picture?: string;
}

export type GoogleTokenVerifier = (idToken: string) => Promise<GoogleTokenPayload>;

export class GoogleOAuthService {
  private static customVerifier: GoogleTokenVerifier | null = null;

  /**
   * Permite configurar um verificador customizado (útil para testes unitários e de integração)
   */
  public static setCustomVerifier(verifier: GoogleTokenVerifier | null): void {
    GoogleOAuthService.customVerifier = verifier;
  }

  /**
   * Valida o idToken do Google e retorna os dados de identidade (googleId, googleEmail, etc)
   */
  public static async verifyIdToken(idToken: string): Promise<GoogleTokenPayload> {
    if (!idToken || typeof idToken !== 'string' || idToken.trim().length < 10) {
      throw new InvalidGoogleTokenError('Token do Google inválido ou não fornecido.');
    }

    if (GoogleOAuthService.customVerifier) {
      return await GoogleOAuthService.customVerifier(idToken);
    }

    try {
      // 1. Tenta validar primariamente como ID Token (padrão Google Identity Services)
      const idTokenUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
      const response = await fetch(idTokenUrl);

      if (response.ok) {
        const data = (await response.json()) as Record<string, any>;

        const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
        if (!data.iss || !validIssuers.includes(data.iss)) {
          throw new InvalidGoogleTokenError('Emissor do token do Google inválido.');
        }

        if (data.email_verified !== 'true' && data.email_verified !== true) {
          throw new InvalidGoogleTokenError('O e-mail da conta Google não está verificado.');
        }

        if (env.GOOGLE_CLIENT_ID && data.aud && data.aud !== env.GOOGLE_CLIENT_ID) {
          throw new InvalidGoogleTokenError('Audiência do token do Google incompatível.');
        }

        if (!data.sub || !data.email) {
          throw new InvalidGoogleTokenError('Payload do token do Google incompleto.');
        }

        return {
          googleId: String(data.sub),
          googleEmail: String(data.email).toLowerCase().trim(),
          name: data.name,
          picture: data.picture,
        };
      }

      // 2. Se a chamada por id_token falhou (ex: frontend enviou access_token), tenta como access_token via userinfo
      const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (userinfoResponse.ok) {
        const data = (await userinfoResponse.json()) as Record<string, any>;
        if (data.sub && data.email) {
          if (data.email_verified === false || data.email_verified === 'false') {
            throw new InvalidGoogleTokenError('O e-mail da conta Google não está verificado.');
          }
          return {
            googleId: String(data.sub),
            googleEmail: String(data.email).toLowerCase().trim(),
            name: data.name,
            picture: data.picture,
          };
        }
      }

      throw new InvalidGoogleTokenError('Token do Google inválido ou expirado.');
    } catch (err: any) {
      if (err instanceof InvalidGoogleTokenError) {
        throw err;
      }
      throw new InvalidGoogleTokenError('Falha na validação do token junto ao provedor Google.');
    }
  }
}
