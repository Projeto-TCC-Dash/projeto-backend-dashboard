import { z } from 'zod';

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

export const LogoutRequestSchema = z.object({
  allDevices: z.boolean().optional().default(false),
});
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
