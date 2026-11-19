import { z } from 'zod';
import {
  ASSET_MACRO_CLASSES,
  AssetMacroClassEnum,
} from '../config/constants.js';

export const UpsertInvestmentHoldingBodySchema = z.object({
  accountId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de conta inválido'),
  macroClass: AssetMacroClassEnum,
  amount: z.number().nonnegative('Montante deve ser zero ou positivo'),
  notes: z.string().max(200).optional(),
});
export type UpsertInvestmentHoldingBody = z.infer<typeof UpsertInvestmentHoldingBodySchema>;

export const InvestmentHoldingItemSchema = z.object({
  macroClass: AssetMacroClassEnum,
  amount: z.number(),
  percentage: z.number(),
});
export type InvestmentHoldingItem = z.infer<typeof InvestmentHoldingItemSchema>;

export const InvestmentPortfolioSummarySchema = z.object({
  totalInvested: z.number(),
  riskProfile: z.string().optional(),
  holdings: z.array(InvestmentHoldingItemSchema),
  allocationDiagnosis: z.object({
    adherentToRiskProfile: z.boolean(),
    recommendations: z.array(z.string()),
  }),
});
export type InvestmentPortfolioSummary = z.infer<typeof InvestmentPortfolioSummarySchema>;
