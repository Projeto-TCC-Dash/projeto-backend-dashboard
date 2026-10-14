# Data Model: Categorias Canônicas e Edição de Transações

**Feature**: `006-transaction-categories-editing`  
**Date**: 2026-10-13  
**Status**: Complete

## 1. Catálogo de Categorias Canônicas

O vocabulário de categorias permitidas no sistema é um enum fechado padronizado:

```typescript
export const CANONICAL_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Moradia",
  "Saúde",
  "Lazer",
  "Educação",
  "Receita",
  "Outros",
  "Não Categorizado",
] as const;

export type Category = typeof CANONICAL_CATEGORIES[number];
```

### Regras de Transição e Ciclo de Vida da Categoria

```text
[Importação OFX/CSV] ────> Categoria Inicial: "Não Categorizado"
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
       [Categorização por IA]           [Edição Manual via PATCH]
                  │                               │
                  ▼                               ▼
   "Alimentação", "Transporte", etc.     Qualquer categoria do catálogo canônico
   (exclui "Não Categorizado")           (inclui "Receita", "Outros", etc.)
```

- **Estado Inicial de Extratos**: Toda nova transação importada via `POST /api/transactions/upload` recebe `category: "Não Categorizado"`.
- **Transição via IA**: `POST /api/transactions/categorize` seleciona apenas transações com categoria `"Não Categorizado"` e as atualiza em lote com categorias identificadas pela LLM.
- **Transição Manual**: `PATCH /api/transactions/:id` permite ao usuário definir explicitamente qualquer categoria válida da lista canônica, sobrepondo o estado anterior.

---

## 2. Entidade Transaction (`ITransaction`)

### Coleção MongoDB: `transactions`

| Campo | Tipo | Obrigatoriedade | Descrição / Regras de Validação |
|---|---|---|---|
| `_id` | `ObjectId` | Sim | Identificador único gerado pelo MongoDB. |
| `userId` | `ObjectId` | Sim | Referência ao usuário proprietário (`User._id`). Indexado para isolamento multi-tenant. |
| `externalId` | `String` | Sim | Identificador bancário único no arquivo de extrato para conciliação e deduplicação. |
| `rawDescription` | `String` | Sim | Descrição bruta original do extrato bancário. Imutável após inserção. |
| `cleanDescription` | `String` | Sim | Descrição higienizada (sem PII ou ruídos bancários). **Editável via PATCH**. Min: 1, Max: 255. |
| `amount` | `Number` | Sim | Valor monetário (positivo para receitas, negativo para despesas). Imutável. |
| `date` | `Date` | Sim | Data e hora da transação. Imutável. |
| `category` | `String` | Sim | Categoria da transação. **Editável via PATCH**. Deve pertencer a `CANONICAL_CATEGORIES`. Default: `"Não Categorizado"`. |
| `source` | `String` | Sim | Origem da transação (`"OFX"`, `"CSV"`, `"SEED"`). Imutável. |
| `createdAt` | `Date` | Sim | Timestamp de criação gerenciado pelo Mongoose (`timestamps: true`). |
| `updatedAt` | `Date` | Sim | Timestamp de última atualização gerenciado pelo Mongoose (`timestamps: true`). |

### Índices do Banco de Dados
1. `{ userId: 1, externalId: 1 }` (Unique): Garante idempotência estrita de importação.
2. `{ userId: 1, date: -1 }`: Otimização de ordenação e filtros por competência/mês.
3. `{ userId: 1, category: 1 }`: Otimização para filtros por categoria e busca de transações pendentes (`category: "Não Categorizado"`).

---

## 3. DTOs e Esquemas Zod

### Atualização Parcial de Transação: `UpdateTransactionBodySchema`

```typescript
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
```

### Parâmetros de Rota: `TransactionIdParamSchema`

```typescript
export const TransactionIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'O id da transação deve ser um ObjectId hexadecimal válido de 24 caracteres'),
});

export type TransactionIdParam = z.infer<typeof TransactionIdParamSchema>;
```

### Resposta de Transação Atualizada: `TransactionItemSchema`

Reutiliza o schema existente de retorno de transações:
```typescript
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
```
