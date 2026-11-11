# Data Model & Schema Design: Feature 009

## Model & Schema Changes

### 1. Financial Metrics Model (`IFinancialMetrics`)
Location: `src/models/analysis.model.ts`

```typescript
export interface IFinancialMetrics {
  totalIncome: number;
  totalExpenses: number;
  invoiceSettlements: number; // Montante total de faturas de cartão liquidadas no mês (segregado)
  netBalance: number;
  savingsRate: number;
  topCategories: ICategoryMetric[];
}

const FinancialMetricsSubschema = new Schema<IFinancialMetrics>(
  {
    totalIncome: { type: Number, required: true },
    totalExpenses: { type: Number, required: true },
    invoiceSettlements: { type: Number, default: 0 },
    netBalance: { type: Number, required: true },
    savingsRate: { type: Number, required: true },
    topCategories: { type: [CategoryMetricSubschema], default: [] },
  },
  { _id: false }
);
```

---

### 2. Financial Metrics Zod Schema (`FinancialMetricsSchema`)
Location: `src/schemas/analysis.schemas.ts`

```typescript
export const FinancialMetricsSchema = z.object({
  totalIncome: z.number(),
  totalExpenses: z.number(),
  invoiceSettlements: z.number().default(0),
  netBalance: z.number(),
  savingsRate: z.number(),
  topCategories: z.array(CategoryMetricSchema),
});
```

---

### 3. Monthly Financial Summary Return Type
Location: `src/services/transaction.service.ts`

```typescript
export interface IMonthlyFinancialSummary {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  invoiceSettlements: number;
  netBalance: number;
  categoryTotals: Record<string, number>;
}
```
