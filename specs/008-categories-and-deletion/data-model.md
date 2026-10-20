# Data Model & Schema Design: Feature 008

## Entities & Enums

### 1. Canonical Categories Enum (`CANONICAL_CATEGORIES`)
Location: `src/config/constants.ts`

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
  "Pagamento de Fatura", // Novo na Feature 008
  "Investimentos",        // Novo na Feature 008
] as const;

export const CategoryEnum = z.enum(CANONICAL_CATEGORIES);
export type Category = z.infer<typeof CategoryEnum>;
```

#### Validation Rules
- Exactly 11 allowed values.
- Case-sensitive exact string match.
- Used in Zod schemas for query parameters, request bodies, and Mongoose model schema.

---

### 2. Transaction Model (`ITransaction`)
Location: `src/models/transaction.model.ts`

```typescript
export interface ITransaction {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  accountId?: Types.ObjectId;
  externalId?: string;
  rawDescription: string;
  cleanDescription: string;
  amount: number;
  date: Date;
  category: Category; // Agora suporta as 11 categorias
  source: TransactionSource;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Indexes
- `{ userId: 1, date: -1 }` (Performance para filtros temporais e listagens)
- `{ userId: 1, accountId: 1 }` (Agrupamento por conta)
- `{ userId: 1, category: 1 }` (Filtros por categoria)

---

### 3. Financial Analysis Model (`IFinancialAnalysis`)
Location: `src/models/analysis.model.ts`

```typescript
export interface IFinancialAnalysis {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  month: string; // "YYYY-MM"
  transactionStateHash: string;
  diagnosis: string;
  recommendations: string[];
  metrics: IFinancialMetrics;
  generatedAt: Date;
  expiresAt: Date;
}
```

#### Cache Lifecycle & Deletion Trigger
- When `TransactionService.deleteTransaction(userId, id)` succeeds:
  - Invokes `AnalysisService.invalidate(userId)`
  - Runs `FinancialAnalysisModel.deleteMany({ userId: new Types.ObjectId(userId) })`
  - Guarantees subsequent `GET /api/analysis/:month` or summaries recalculate with up-to-date transaction items.
