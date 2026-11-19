import { z } from 'zod';
import {
  FISCAL_VERIFICATION_STATUSES,
  FiscalVerificationStatusEnum,
  TAX_CATEGORIES,
  TaxCategoryEnum,
} from '../config/constants.js';

export const UpdateTransactionFiscalBodySchema = z.object({
  isTaxDeductible: z.boolean(),
  taxCategory: TaxCategoryEnum.optional(),
  providerDocument: z
    .string()
    .regex(/^\d{11}$|^\d{14}$/, 'Documento deve conter 11 (CPF) ou 14 (CNPJ) dígitos limpos')
    .optional(),
  providerName: z.string().min(2).max(120).optional(),
  deductibleAmount: z.number().positive('Valor dedutível deve ser maior que zero').optional(),
  status: FiscalVerificationStatusEnum.default('PENDING'),
  notes: z.string().max(250).optional(),
});
export type UpdateTransactionFiscalBody = z.infer<typeof UpdateTransactionFiscalBodySchema>;

export const FiscalSummaryQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/, 'Ano base inválido (formato YYYY, ex: 2026)'),
});
export type FiscalSummaryQuery = z.infer<typeof FiscalSummaryQuerySchema>;

export const FiscalAnnualSummaryResponseSchema = z.object({
  year: z.string(),
  totalDeductibleExpenses: z.number(),
  confirmedDeductibleExpenses: z.number(),
  pendingDocumentationExpenses: z.number(),
  byCategory: z.array(
    z.object({
      taxCategory: TaxCategoryEnum,
      totalAmount: z.number(),
      confirmedAmount: z.number(),
      pendingAmount: z.number(),
      count: z.number(),
    })
  ),
  pjSummary: z.object({
    applicable: z.boolean(),
    grossRevenueYearToDate: z.number(),
    annualLimit: z.number(),
    ceilingPercentage: z.number(),
    proLaboreTotal: z.number(),
    dividendsTotal: z.number(),
  }),
});
export type FiscalAnnualSummaryResponse = z.infer<typeof FiscalAnnualSummaryResponseSchema>;

export const FiscalOcrResponseSchema = z.object({
  proofDocumentId: z.string(),
  originalFilename: z.string(),
  extractedData: z.object({
    providerDocument: z.string().optional(),
    providerName: z.string().optional(),
    totalAmount: z.number().optional(),
    issueDate: z.string().optional(),
    description: z.string().optional(),
  }),
  suggestedMatches: z.array(
    z.object({
      transactionId: z.string(),
      date: z.date(),
      amount: z.number(),
      cleanDescription: z.string(),
      confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    })
  ),
});
export type FiscalOcrResponse = z.infer<typeof FiscalOcrResponseSchema>;

export const FiscalDossierQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/, 'Ano inválido (formato YYYY)'),
  format: z.enum(['pdf', 'xlsx']),
});
export type FiscalDossierQuery = z.infer<typeof FiscalDossierQuerySchema>;
