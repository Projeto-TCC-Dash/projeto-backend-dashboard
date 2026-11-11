import { z } from 'zod';
import { AccountTypeEnum } from '../config/constants.js';

export const CreateAccountBodySchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(50, 'Nome deve ter no máximo 50 caracteres'),
  type: AccountTypeEnum,
  initialBalance: z.number().optional().default(0),
  institution: z.string().trim().max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar no formato hexadecimal (#RRGGBB)').optional(),
});

export type CreateAccountBody = z.infer<typeof CreateAccountBodySchema>;

export const UpdateAccountBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Nome não pode ser vazio').max(50, 'Nome deve ter no máximo 50 caracteres').optional(),
    type: AccountTypeEnum.optional(),
    initialBalance: z.number().optional(),
    institution: z.string().trim().max(100).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar no formato hexadecimal (#RRGGBB)').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Pelo menos um campo deve ser fornecido para atualização.',
  });

export type UpdateAccountBody = z.infer<typeof UpdateAccountBodySchema>;

export const AccountIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de conta deve ser um ObjectId hexadecimal válido de 24 caracteres'),
});

export type AccountIdParam = z.infer<typeof AccountIdParamSchema>;

export const DeleteAccountQuerySchema = z.object({
  cascade: z.enum(['true', 'false']).optional().default('false'),
});

export type DeleteAccountQuery = z.infer<typeof DeleteAccountQuerySchema>;

export const AccountResponseItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  type: AccountTypeEnum,
  initialBalance: z.number(),
  institution: z.string().optional(),
  color: z.string().optional(),
  balance: z.number(),
  transactionCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AccountResponseItem = z.infer<typeof AccountResponseItemSchema>;

export const ListAccountsResponseSchema = z.object({
  accounts: z.array(AccountResponseItemSchema),
  totalAccounts: z.number(),
  netWorth: z.number(),
});

export type ListAccountsResponse = z.infer<typeof ListAccountsResponseSchema>;
