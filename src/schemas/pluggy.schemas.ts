import { z } from 'zod';
import { UploadTransactionsResponseSchema } from './transaction.schemas.js';

export const PluggySyncRequestSchema = z.object({
  itemId: z.string().min(1, 'itemId é obrigatório.'),
});
export type PluggySyncRequest = z.infer<typeof PluggySyncRequestSchema>;

export const PluggySyncResponseSchema = UploadTransactionsResponseSchema;
export type PluggySyncResponse = z.infer<typeof PluggySyncResponseSchema>;
