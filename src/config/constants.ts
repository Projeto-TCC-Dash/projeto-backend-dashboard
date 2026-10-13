import { z } from 'zod';

export const CANONICAL_CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Saúde',
  'Lazer',
  'Educação',
  'Outros',
] as const;

export const CategoryEnum = z.enum(CANONICAL_CATEGORIES);
export type Category = z.infer<typeof CategoryEnum>;

export const TRANSACTION_SOURCES = ['OFX', 'CSV', 'SEED'] as const;
export const TransactionSourceEnum = z.enum(TRANSACTION_SOURCES);
export type TransactionSource = z.infer<typeof TransactionSourceEnum>;

export const SYSTEM_DEFAULTS = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_CHAT_HISTORY_MESSAGES: 20,
  DEFAULT_CATEGORY: 'Outros' as Category,
  GEMINI_MODEL: 'gemini-2.5-flash',
} as const;
