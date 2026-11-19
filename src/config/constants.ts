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
  "Pagamento de Fatura",
  "Investimentos",
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

export const INCOME_TYPES = [
  'CLT',
  'PJ_AUTONOMO',
  'PUBLIC_SERVANT',
  'ENTREPRENEUR',
  'STUDENT',
  'RETIRED',
  'OTHER',
] as const;
export const IncomeTypeEnum = z.enum(INCOME_TYPES);
export type IncomeType = z.infer<typeof IncomeTypeEnum>;

export const FINANCIAL_GOALS = [
  'RESERVA_EMERGENCIA',
  'QUITAR_DIVIDAS',
  'COMPRAR_IMOVEL',
  'INVESTIR_LONGO_PRAZO',
  'CONTROLE_GASTOS',
] as const;
export const FinancialGoalEnum = z.enum(FINANCIAL_GOALS);
export type FinancialGoal = z.infer<typeof FinancialGoalEnum>;

export const RISK_PROFILES = [
  'CONSERVATIVE',
  'MODERATE',
  'AGGRESSIVE',
] as const;
export const RiskProfileEnum = z.enum(RISK_PROFILES);
export type RiskProfile = z.infer<typeof RiskProfileEnum>;

export const SYSTEM_DEFAULTS = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_CHAT_HISTORY_MESSAGES: 20,
  DEFAULT_CATEGORY: "Não Categorizado" as Category,
  GEMINI_MODEL: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
} as const;

export const AVATAR_CONFIG = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
  UPLOAD_DIR: 'uploads/avatars',
  URL_PREFIX: '/uploads/avatars',
} as const;

export const SESSION_CONFIG = {
  SESSION_TTL_MS: 7 * 24 * 60 * 60 * 1000, // 7 dias
  SESSION_TTL_SECONDS: 7 * 24 * 60 * 60, // 604800 segundos
} as const;

export const TAX_CATEGORIES = [
  'HEALTH',
  'EDUCATION',
  'PENSION_PGBL',
  'ALIMONY',
  'BUSINESS_EXPENSE_BOOK',
  'OTHER_DEDUCTIBLE',
] as const;
export const TaxCategoryEnum = z.enum(TAX_CATEGORIES);
export type TaxCategory = z.infer<typeof TaxCategoryEnum>;

export const FISCAL_VERIFICATION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'EXEMPT',
] as const;
export const FiscalVerificationStatusEnum = z.enum(FISCAL_VERIFICATION_STATUSES);
export type FiscalVerificationStatus = z.infer<typeof FiscalVerificationStatusEnum>;

export const ASSET_MACRO_CLASSES = [
  'FIXED_INCOME',
  'EQUITIES',
  'REAL_ESTATE',
  'INTERNATIONAL',
  'CRYPTO',
  'CASH_LIQUIDITY',
] as const;
export const AssetMacroClassEnum = z.enum(ASSET_MACRO_CLASSES);
export type AssetMacroClass = z.infer<typeof AssetMacroClassEnum>;

export const BUDGET_CONSUMPTION_STATUSES = [
  'REGULAR',
  'WARNING',
  'EXCEEDED',
] as const;
export const BudgetConsumptionStatusEnum = z.enum(BUDGET_CONSUMPTION_STATUSES);
export type BudgetConsumptionStatus = z.infer<typeof BudgetConsumptionStatusEnum>;

export const FISCAL_PROOF_CONFIG = {
  MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ] as const,
  UPLOAD_DIR: 'uploads/receipts',
  URL_PREFIX: '/uploads/receipts',
} as const;



