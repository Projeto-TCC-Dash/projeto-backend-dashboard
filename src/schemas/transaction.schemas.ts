import { z } from 'zod';
import { CategoryEnum, TransactionSourceEnum } from '../config/constants.js';

export const TransactionItemSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  rawDescription: z.string(),
  cleanDescription: z.string(),
  amount: z.number(),
  date: z.date(),
  category: CategoryEnum,
  source: TransactionSourceEnum,
});
export type TransactionItem = z.infer<typeof TransactionItemSchema>;

export const UploadTransactionsResponseSchema = z.object({
  totalExtracted: z.number(),
  imported: z.number(),
  duplicatesIgnored: z.number(),
});
export type UploadTransactionsResponse = z.infer<typeof UploadTransactionsResponseSchema>;

export const ListTransactionsQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Mês deve estar no formato YYYY-MM')
    .optional(),
  category: CategoryEnum.optional(),
  source: TransactionSourceEnum.optional(),
});
export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;
