import { z } from 'zod';
import { CategoryEnum } from '../config/constants.js';

export const CategorizeResponseSchema = z.object({
  uniqueMerchantsAnalyzed: z.number(),
  transactionsUpdated: z.number(),
});
export type CategorizeResponse = z.infer<typeof CategorizeResponseSchema>;

export const MerchantCategorizationItemSchema = z.object({
  merchant: z.string(),
  category: CategoryEnum,
});
export type MerchantCategorizationItem = z.infer<typeof MerchantCategorizationItemSchema>;
