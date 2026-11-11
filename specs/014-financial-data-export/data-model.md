# Data Model: Feature 014 — Central de Exportação de Dados Financeiros

Este documento define os modelos de dados, schemas Zod e DTOs que sustentam o serviço de exportação financeira em conformidade com o princípio de Schema-Driven Development (SDD).

---

## 1. DTO de Requisição e Validação (Query Parameters)

Arquivo: `src/schemas/export.schemas.ts`

```typescript
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
    accountId: z.string().min(24).max(24, 'ID de conta inválido.').optional(),
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
```

---

## 2. Entidade Intermediária de Exportação (Export Record)

Arquivo: `src/services/export.service.ts`

Representa a linha formatada e sanitizada pronta para ser inserida em qualquer um dos três formatos de saída (CSV, XLSX ou PDF):

```typescript
export interface IExportRecord {
  date: Date;
  dateFormatted: string; // "DD/MM/YYYY"
  description: string;   // cleanDescription ou description
  category: string;      // Categoria canônica
  accountName: string;   // Nome da conta resolvida ou "Sem Conta"
  type: 'RECEITA' | 'DESPESA' | 'PAGAMENTO_FATURA';
  amount: number;        // Valor numérico com sinal original
  amountFormatted: string; // Ex: "R$ 1.250,00" ou "-R$ 45,90"
  decimalFormatted: string; // Ex: "1250,00" ou "-45,90" (para CSV)
}
```

---

## 3. Sumário Executivo de Métricas (Export Metrics)

Utilizado principalmente no cabeçalho/resumo do relatório PDF e na primeira aba da planilha XLSX:

```typescript
export interface IExportSummaryMetrics {
  totalCount: number;
  totalIncome: number;     // Soma de transações de entrada (> 0 e categoria Receita)
  totalExpenses: number;   // Soma de despesas (< 0, excluindo pagamentos de fatura para neutralização)
  netBalance: number;      // Balanço líquido do período filtrado
  periodLabel: string;     // Ex: "Outubro/2026" ou "01/10/2026 até 30/10/2026"
  generatedAt: Date;
}
```

---

## 4. Relação com Entidades Existentes do Mongoose

A exportação lê e relaciona diretamente as seguintes entidades de banco:

1. **`UserModel` (`src/models/user.model.ts`)**:
   - `_id`, `email`, `name`: Utilizados para personalizar o cabeçalho e rodapé do relatório PDF institucional ("Relatório Financeiro emitido para Nome/Email").

2. **`AccountModel` (`src/models/account.model.ts`)**:
   - `_id`, `name`, `type`: Utilizados para validar que `accountId` pertence ao `userId` autenticado e mapear o identificador para o nome amigável da conta bancária.

3. **`TransactionModel` (`src/models/transaction.model.ts`)**:
   - `userId`, `date`, `amount`, `description`, `cleanDescription`, `category`, `accountId`: Campos base extraídos pelo filtro de banco.
