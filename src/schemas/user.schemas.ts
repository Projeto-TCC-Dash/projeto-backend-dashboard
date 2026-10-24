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

export const UserSecuritySettingsSchema = z.object({
  twoFactorEnabled: z.boolean().default(false),
  hasLocalPassword: z.boolean().default(true),
  googleLinked: z.boolean().default(false),
  googleEmail: z.string().email().optional(),
  googleLinkedAt: z.coerce.date().optional(),
});
export type UserSecuritySettings = z.infer<typeof UserSecuritySettingsSchema>;

export const UpdateUserProfileRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome deve ter no mínimo 2 caracteres')
    .max(100, 'O nome deve ter no máximo 100 caracteres')
    .optional(),
});
export type UpdateUserProfileRequest = z.infer<typeof UpdateUserProfileRequestSchema>;

export const UserAvatarResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  avatarUrl: z.string().nullable(),
});
export type UserAvatarResponse = z.infer<typeof UserAvatarResponseSchema>;

export const UserProfileResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
  hasAiKey: z.boolean(),
  security: UserSecuritySettingsSchema.optional(),
  financialProfile: FinancialProfileSchema.optional(),
  createdAt: z.coerce.date().optional(),
});
export type UserProfileResponse = z.infer<typeof UserProfileResponseSchema>;
