import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/financial_db'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve possuir pelo menos 32 caracteres.'),
  ENCRYPTION_KEY: z.string().refine((val) => {
    // Aceita 32 caracteres brutos ou 64 caracteres hexadecimais (32 bytes)
    return val.length === 32 || (val.length === 64 && /^[0-9a-fA-F]+$/.test(val));
  }, 'ENCRYPTION_KEY deve ter 32 bytes (32 caracteres ASCII ou 64 caracteres em hexadecimal).'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.8-flash'),
  CORS_ORIGINS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Falha na validação das variáveis de ambiente:');
  console.error(parsed.error.format());
  throw new Error('Configuração de ambiente inválida. Verifique o arquivo .env.');
}

export const env = parsed.data;

/**
 * Checks whether a request Origin is allowed by CORS_ORIGINS (or known frontend origins).
 */
export function isCorsOriginAllowed(origin?: string): boolean {
  if (!origin) return true;
  const normalizedOrigin = origin.trim().replace(/\/+$/, '');
  const raw = env.CORS_ORIGINS?.trim().replace(/^["']|["']$/g, '');
  if (raw === '*') return true;

  const allowed = raw
    ? raw
        .split(',')
        .map((o) => o.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, ''))
        .filter(Boolean)
    : env.NODE_ENV === 'production'
      ? [
          'https://projeto-frontend-dashboard-debgoulart-projects.vercel.app',
          'https://projeto-frontend-dashboard-git-develop-debgoulart-projects.vercel.app',
        ]
      : ['http://localhost:3001', 'http://127.0.0.1:3001'];

  return allowed.includes(normalizedOrigin);
}
