import { z } from "zod";

export const CANONICAL_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Moradia",
  "Saúde",
  "Lazer",
  "Educação",
  "Receita",
  "Outros",
  "Não Categorizado",
] as const;

export const CategoryEnum = z.enum(CANONICAL_CATEGORIES);
export type Category = z.infer<typeof CategoryEnum>;

export const TRANSACTION_SOURCES = ["OFX", "CSV", "SEED"] as const;
export const TransactionSourceEnum = z.enum(TRANSACTION_SOURCES);
export type TransactionSource = z.infer<typeof TransactionSourceEnum>;

export const ACCOUNT_TYPES = [
  "CHECKING",
  "CREDIT_CARD",
  "INVESTMENT",
  "CASH",
  "OTHER",
] as const;
export const AccountTypeEnum = z.enum(ACCOUNT_TYPES);
export type AccountType = z.infer<typeof AccountTypeEnum>;

export const DEFAULT_ACCOUNT_NAME = "Conta Principal";

export const SYSTEM_DEFAULTS = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_CHAT_HISTORY_MESSAGES: 20,
  DEFAULT_CATEGORY: "Não Categorizado" as Category,
  GEMINI_MODEL: "gemini-3.8-flash",
} as const;
