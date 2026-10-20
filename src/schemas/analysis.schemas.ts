import { z } from 'zod';

export const CategoryMetricSchema = z.object({
  category: z.string(),
  amount: z.number(),
  percentage: z.number(),
});
export type CategoryMetric = z.infer<typeof CategoryMetricSchema>;

export const FinancialMetricsSchema = z.object({
  totalIncome: z.number(),
  totalExpenses: z.number(),
  invoiceSettlements: z.number().default(0),
  netBalance: z.number(),
  savingsRate: z.number(),
  topCategories: z.array(CategoryMetricSchema),
});
export type FinancialMetrics = z.infer<typeof FinancialMetricsSchema>;

export const FinancialAnalysisResponseSchema = z.object({
  cached: z.boolean(),
  month: z.string(),
  diagnosis: z.string(),
  recommendations: z.array(z.string()),
  metrics: FinancialMetricsSchema,
  generatedAt: z.date(),
  expiresAt: z.date(),
});
export type FinancialAnalysisResponse = z.infer<typeof FinancialAnalysisResponseSchema>;

export const AnalysisParamsSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Mês deve estar no formato YYYY-MM'),
});
export type AnalysisParams = z.infer<typeof AnalysisParamsSchema>;

export const AnalysisQuerySchema = z.object({
  forceRefresh: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});
export type AnalysisQuery = z.infer<typeof AnalysisQuerySchema>;
