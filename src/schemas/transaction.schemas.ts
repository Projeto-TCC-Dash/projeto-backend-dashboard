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

export const TransactionIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'O id da transação deve ser um ObjectId hexadecimal válido de 24 caracteres'),
});
export type TransactionIdParam = z.infer<typeof TransactionIdParamSchema>;

export const UpdateTransactionBodySchema = z
  .object({
    category: CategoryEnum.optional(),
    cleanDescription: z
      .string({ invalid_type_error: 'A descrição deve ser um texto' })
      .trim()
      .min(1, 'A descrição não pode estar vazia')
      .max(255, 'A descrição não pode exceder 255 caracteres')
      .optional(),
  })
  .refine(
    (data) => data.category !== undefined || data.cleanDescription !== undefined,
    {
      message: 'Ao menos um dos campos (category ou cleanDescription) deve ser informado para atualização',
    }
  );
export type UpdateTransactionBody = z.infer<typeof UpdateTransactionBodySchema>;

