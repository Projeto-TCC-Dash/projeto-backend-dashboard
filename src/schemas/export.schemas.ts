import { z } from 'zod';
import { CategoryEnum } from '../config/constants.js';

export const ExportFormatEnum = z.enum(['csv', 'xlsx', 'pdf']);
export type ExportFormat = z.infer<typeof ExportFormatEnum>;

export const ExportTransactionsQuerySchema = z
  .object({
    format: ExportFormatEnum,
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'O mês deve estar no formato YYYY-MM.')
      .optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'A data inicial deve estar no formato YYYY-MM-DD.')
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'A data final deve estar no formato YYYY-MM-DD.')
      .optional(),
    accountId: z.string().min(24, 'ID de conta inválido.').max(24, 'ID de conta inválido.').optional(),
    category: CategoryEnum.optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'A data inicial (startDate) não pode ser posterior à data final (endDate).',
      path: ['startDate'],
    }
  );

export type ExportTransactionsQuery = z.infer<typeof ExportTransactionsQuerySchema>;
