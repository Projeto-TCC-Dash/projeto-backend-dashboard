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
  }),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const SetApiKeyRequestSchema = z.object({
  apiKey: z.string().min(10, 'Chave de API do Gemini inválida ou vazia.').trim(),
});
export type SetApiKeyRequest = z.infer<typeof SetApiKeyRequestSchema>;

export const SetApiKeyResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type SetApiKeyResponse = z.infer<typeof SetApiKeyResponseSchema>;
