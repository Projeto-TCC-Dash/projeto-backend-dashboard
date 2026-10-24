import { z } from 'zod';
import { env } from '../config/env.js';
import { UserProfileResponseSchema } from './user.schemas.js';

export const RegisterRequestSchema = z.object({
  email: z.string().email('E-mail em formato inválido.').toLowerCase().trim(),
  password: z.string().min(8, 'A senha deve conter no mínimo 8 caracteres.'),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email('E-mail em formato inválido.').toLowerCase().trim(),
  password: z.string().min(1, 'Senha é obrigatória.'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    hasAiKey: z.boolean(),
    isTwoFactorEnabled: z.boolean().default(false),
  }),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const Login2FAResponseSchema = z.object({
  requires2FA: z.literal(true),
  challengeId: z.string(),
  message: z.string(),
});
export type Login2FAResponse = z.infer<typeof Login2FAResponseSchema>;

export const Verify2FARequestSchema = z.object({
  challengeId: z.string().min(24).max(24, 'ID do desafio de 2FA inválido.'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'O código de verificação deve conter exatamente 6 dígitos numéricos.'),
});
export type Verify2FARequest = z.infer<typeof Verify2FARequestSchema>;

export const Resend2FARequestSchema = z.object({
  challengeId: z.string().min(24).max(24, 'ID do desafio de 2FA inválido.'),
});
export type Resend2FARequest = z.infer<typeof Resend2FARequestSchema>;

export const Disable2FARequestSchema = z.object({
  password: z.string().min(1, 'Senha é obrigatória para desativar a autenticação em duas etapas.'),
});
export type Disable2FARequest = z.infer<typeof Disable2FARequestSchema>;

export const LogoutRequestSchema = z
  .object({
    allDevices: z.boolean().optional().default(false),
  })
  .nullable()
  .optional()
  .default({});
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

export const SetApiKeyRequestSchema = z.object({
  apiKey: z.string().min(10, 'Chave de API do Gemini inválida ou vazia.').trim(),
});
export type SetApiKeyRequest = z.infer<typeof SetApiKeyRequestSchema>;

export const SetApiKeyResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  status: z.enum(['ACTIVE_VERIFIED', 'ACTIVE_PROVISIONAL_DEMAND']).optional(),
});
export type SetApiKeyResponse = z.infer<typeof SetApiKeyResponseSchema>;

export const GoogleLinkRequestSchema = z
  .object({
    idToken: z
      .string()
      .trim()
      .min(10, 'Token do Google inválido.')
      .optional()
      .or(z.literal(''))
      .transform((val) => val || undefined),
    token: z
      .string()
      .trim()
      .min(10, 'Token do Google inválido.')
      .optional()
      .or(z.literal(''))
      .transform((val) => val || undefined),
    credential: z
      .string()
      .trim()
      .min(10, 'Token do Google inválido.')
      .optional()
      .or(z.literal(''))
      .transform((val) => val || undefined),
    id_token: z
      .string()
      .trim()
      .min(10, 'Token do Google inválido.')
      .optional()
      .or(z.literal(''))
      .transform((val) => val || undefined),
    accessToken: z
      .string()
      .trim()
      .min(10, 'Token do Google inválido.')
      .optional()
      .or(z.literal(''))
      .transform((val) => val || undefined),
    access_token: z
      .string()
      .trim()
      .min(10, 'Token do Google inválido.')
      .optional()
      .or(z.literal(''))
      .transform((val) => val || undefined),
    googleToken: z
      .string()
      .trim()
      .min(10, 'Token do Google inválido.')
      .optional()
      .or(z.literal(''))
      .transform((val) => val || undefined),
    google_token: z
      .string()
      .trim()
      .min(10, 'Token do Google inválido.')
      .optional()
      .or(z.literal(''))
      .transform((val) => val || undefined),
    code: z.string().optional(),
  })
  .passthrough()
  .nullable()
  .optional()
  .default({})
  .refine(
    (data) => {
      const isProd = (process.env.NODE_ENV ?? env.NODE_ENV) === 'production';
      if (!isProd) return true;
      return Boolean(
        data?.idToken ||
          data?.token ||
          data?.credential ||
          data?.id_token ||
          data?.accessToken ||
          data?.access_token ||
          data?.googleToken ||
          data?.google_token ||
          data?.code
      );
    },
    {
      message: 'O token do Google é obrigatório em ambiente de produção.',
      path: ['idToken'],
    }
  )
  .transform((data) => ({
    idToken:
      data?.idToken ||
      data?.credential ||
      data?.token ||
      data?.id_token ||
      data?.accessToken ||
      data?.access_token ||
      data?.googleToken ||
      data?.google_token ||
      data?.code ||
      undefined,
  }));
export type GoogleLinkRequest = z.infer<typeof GoogleLinkRequestSchema>;

export const GoogleLinkResponseSchema = UserProfileResponseSchema.partial()
  .extend({
    success: z.boolean().default(true),
    message: z.string().optional(),
    googleAccount: z
      .object({
        googleEmail: z.string().email(),
        linkedAt: z.coerce.date(),
      })
      .optional(),
  })
  .passthrough();
export type GoogleLinkResponse = z.infer<typeof GoogleLinkResponseSchema>;

export const GoogleUnlinkResponseSchema = UserProfileResponseSchema.partial()
  .extend({
    success: z.boolean().default(true),
    message: z.string().optional(),
  })
  .passthrough();
export type GoogleUnlinkResponse = z.infer<typeof GoogleUnlinkResponseSchema>;

export const GoogleLoginRequestSchema = z
  .object({
    idToken: z.string().min(10, 'Token do Google inválido.').optional(),
    token: z.string().min(10, 'Token do Google inválido.').optional(),
    credential: z.string().min(10, 'Token do Google inválido.').optional(),
    id_token: z.string().min(10, 'Token do Google inválido.').optional(),
    accessToken: z.string().min(10, 'Token do Google inválido.').optional(),
    access_token: z.string().min(10, 'Token do Google inválido.').optional(),
    googleToken: z.string().min(10, 'Token do Google inválido.').optional(),
    google_token: z.string().min(10, 'Token do Google inválido.').optional(),
  })
  .passthrough()
  .refine(
    (data) =>
      Boolean(
        data.idToken ||
          data.token ||
          data.credential ||
          data.id_token ||
          data.accessToken ||
          data.access_token ||
          data.googleToken ||
          data.google_token
      ),
    {
      message: 'O token do Google é obrigatório (idToken, credential, token ou accessToken).',
      path: ['idToken'],
    }
  )
  .transform((data) => ({
    idToken: (data.idToken ||
      data.credential ||
      data.token ||
      data.id_token ||
      data.accessToken ||
      data.access_token ||
      data.googleToken ||
      data.google_token)!,
  }));
export type GoogleLoginRequest = z.infer<typeof GoogleLoginRequestSchema>;
