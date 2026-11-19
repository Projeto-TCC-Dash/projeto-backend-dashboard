import { z } from 'zod';
import {
  BUDGET_CONSUMPTION_STATUSES,
  BudgetConsumptionStatusEnum,
  CategoryEnum,
} from '../config/constants.js';

export const MonthParamSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mês deve ser YYYY-MM (ex: 2026-11)'),
});
export type MonthParam = z.infer<typeof MonthParamSchema>;

export const CategoryBudgetSchema = z.object({
  category: CategoryEnum,
  limitAmount: z.number().positive('O teto orçamentário da categoria deve ser maior que zero'),
});
export type CategoryBudget = z.infer<typeof CategoryBudgetSchema>;

export const SetBudgetBodySchema = z.object({
  totalLimitAmount: z.number().positive('O teto global do mês deve ser maior que zero'),
  categoryBudgets: z.array(CategoryBudgetSchema).min(1, 'Defina ao menos um teto de categoria'),
});
export type SetBudgetBody = z.infer<typeof SetBudgetBodySchema>;

export const BudgetConsumptionItemSchema = z.object({
  category: CategoryEnum,
  limitAmount: z.number(),
  spentAmount: z.number(),
  remainingAmount: z.number(),
  percentConsumed: z.number(),
  status: BudgetConsumptionStatusEnum,
});
export type BudgetConsumptionItem = z.infer<typeof BudgetConsumptionItemSchema>;

export const BudgetOverviewResponseSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  totalLimitAmount: z.number(),
  totalSpentAmount: z.number(),
  totalRemainingAmount: z.number(),
  globalPercentConsumed: z.number(),
  globalStatus: BudgetConsumptionStatusEnum,
  categories: z.array(BudgetConsumptionItemSchema),
});
export type BudgetOverviewResponse = z.infer<typeof BudgetOverviewResponseSchema>;
