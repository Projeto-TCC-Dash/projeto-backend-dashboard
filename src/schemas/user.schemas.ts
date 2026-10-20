import { z } from 'zod';
import {
  FinancialGoalEnum,
  IncomeTypeEnum,
  RiskProfileEnum,
} from '../config/constants.js';

export const FinancialProfileSchema = z.object({
  incomeType: IncomeTypeEnum.optional(),
  declaredMonthlyIncome: z
    .number({ invalid_type_error: 'A renda declarada deve ser um número' })
    .min(0, 'A renda declarada deve ser maior ou igual a zero')
    .optional(),
  goals: z.array(FinancialGoalEnum).optional(),
  riskProfile: RiskProfileEnum.optional(),
  updatedAt: z.date().optional(),
});
export type FinancialProfile = z.infer<typeof FinancialProfileSchema>;

export const UpdateFinancialProfileRequestSchema = z.object({
  incomeType: IncomeTypeEnum.optional(),
  declaredMonthlyIncome: z
    .number({ invalid_type_error: 'A renda declarada deve ser um número' })
    .min(0, 'A renda declarada deve ser maior ou igual a zero')
    .optional(),
  goals: z.array(FinancialGoalEnum).optional(),
  riskProfile: RiskProfileEnum.optional(),
});
export type UpdateFinancialProfileRequest = z.infer<typeof UpdateFinancialProfileRequestSchema>;

export const UserProfileResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  hasAiKey: z.boolean(),
  financialProfile: FinancialProfileSchema.optional(),
});
export type UserProfileResponse = z.infer<typeof UserProfileResponseSchema>;
