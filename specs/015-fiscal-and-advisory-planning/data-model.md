# Data Model & Schema Definitions: Fiscal Planning & Advanced Financial Advisory

**Feature**: `015-fiscal-and-advisory-planning`  
**Date**: 2026-11-18  
**Status**: Draft  

---

## 1. Constantes e Enums Canônicos

### Categorias Fiscais Dedutíveis (`TaxCategory`)
```typescript
export const TAX_CATEGORIES = [
  'HEALTH',                 // Despesas médicas, hospitais, planos de saúde e odontologia
  'EDUCATION',              // Instrução regular (infantil, fundamental, médio, superior, pós)
  'PENSION_PGBL',           // Previdência complementar modalidade PGBL (até 12% da renda tributável)
  'ALIMONY',                // Pensão alimentícia homologada judicialmente
  'BUSINESS_EXPENSE_BOOK',  // Despesas de custeio dedutíveis no Livro-Caixa (autônomos/liberais)
  'OTHER_DEDUCTIBLE',       // Outras deduções amparadas pela legislação
] as const;

export type TaxCategory = typeof TAX_CATEGORIES[number];
```

### Status de Comprovação Fiscal (`FiscalVerificationStatus`)
```typescript
export const FISCAL_VERIFICATION_STATUSES = [
  'PENDING',    // Identificado como dedutível, aguardando documento/comprovação
  'CONFIRMED',  // Comprovante anexado e conferido pelo usuário
  'EXEMPT',     // Dispensado de documentação ou não dedutível na declaração final
] as const;

export type FiscalVerificationStatus = typeof FISCAL_VERIFICATION_STATUSES[number];
```

### Macroclasses de Ativos de Investimento (`AssetMacroClass`)
```typescript
export const ASSET_MACRO_CLASSES = [
  'FIXED_INCOME',    // Tesouro Direto, CDB, LCI, LCA, Debêntures
  'EQUITIES',        // Ações e fundos de ações
  'REAL_ESTATE',     // Fundos de Investimento Imobiliário (FIIs) e imóveis
  'INTERNATIONAL',   // Ativos globais, BDRs e ETFs internacionais
  'CRYPTO',          // Criptoativos
  'CASH_LIQUIDITY',  // Reserva de emergência imediata (Tesouro Selic, fundos DI taxa zero)
] as const;

export type AssetMacroClass = typeof ASSET_MACRO_CLASSES[number];
```

### Status Orçamentário de Consumo (`BudgetConsumptionStatus`)
```typescript
export const BUDGET_CONSUMPTION_STATUSES = [
  'REGULAR',   // Consumo < 70% do teto
  'WARNING',   // Consumo entre 70% e 99.9%
  'EXCEEDED',  // Consumo >= 100%
] as const;

export type BudgetConsumptionStatus = typeof BUDGET_CONSUMPTION_STATUSES[number];
```

---

## 2. Entidades do Banco de Dados (Mongoose & MongoDB)

### 2.1 Subdocumento Fiscal na Transação (`ITransactionFiscalMetadata`)
Incorporado diretamente à coleção `transactions` para manter a integridade atômica e desempenho de consulta:

```typescript
export interface ITransactionFiscalMetadata {
  isTaxDeductible: boolean;
  taxCategory?: TaxCategory;
  providerDocument?: string;     // CPF ou CNPJ limpo (apenas dígitos)
  providerName?: string;         // Razão social ou nome do profissional
  proofDocumentId?: mongoose.Types.ObjectId; // Referência a fiscal_proofs
  deductibleAmount?: number;     // Valor passível de dedução (suporta desmembramento)
  status: FiscalVerificationStatus;
  verifiedAt?: Date;
  notes?: string;
}
```

**Índices Adicionados em `transactions`**:
- `{ userId: 1, "fiscal.isTaxDeductible": 1, date: -1 }` (otimização do painel fiscal)
- `{ userId: 1, "fiscal.taxCategory": 1 }`

---

### 2.2 Documento Comprobatório Fiscal (`FiscalProofDocumentModel`)
Coleção: `fiscal_proofs`

```typescript
export interface IFiscalProofDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  transactionId?: mongoose.Types.ObjectId;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  extractedData?: {
    providerDocument?: string;
    providerName?: string;
    totalAmount?: number;
    issueDate?: Date;
    description?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Regras de Validação**:
- Formatos aceitos: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- Tamanho máximo: 10MB (`10 * 1024 * 1024` bytes).
- Armazenamento físico: diretório protegido `uploads/receipts/`.

**Índices em `fiscal_proofs`**:
- `{ userId: 1, createdAt: -1 }`
- `{ transactionId: 1 }` (com `sparse: true`)

---

### 2.3 Planejamento Orçamentário (`BudgetPlanModel`)
Coleção: `budgets`

```typescript
export interface ICategoryBudget {
  category: Category;
  limitAmount: number;
}

export interface IBudgetPlan extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  month: string;                     // Formato YYYY-MM
  totalLimitAmount: number;          // Teto global do mês
  categoryBudgets: ICategoryBudget[]; // Limites individuais por categoria
  createdAt: Date;
  updatedAt: Date;
}
```

**Índices em `budgets`**:
- `{ userId: 1, month: 1 }` (com `{ unique: true }` para garantir um orçamento por mês)

---

### 2.4 Posições Patrimoniais da Carteira (`InvestmentHoldingModel`)
Coleção: `investment_holdings`

```typescript
export interface IInvestmentHolding extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId; // Conta bancária do tipo INVESTMENT
  macroClass: AssetMacroClass;
  amount: number;
  notes?: string;
  updatedAt: Date;
}
```

**Índices em `investment_holdings`**:
- `{ userId: 1, accountId: 1, macroClass: 1 }` (com `{ unique: true }`)
- `{ userId: 1 }`

---

## 3. Esquemas de Validação e DTOs (Zod)

### 3.1 Schemas de Orçamento
```typescript
export const CategoryBudgetSchema = z.object({
  category: CategoryEnum,
  limitAmount: z.number().positive('O teto orçamentário deve ser maior que zero'),
});

export const SetBudgetBodySchema = z.object({
  totalLimitAmount: z.number().positive('O teto global deve ser maior que zero'),
  categoryBudgets: z.array(CategoryBudgetSchema).min(1, 'Defina ao menos um teto de categoria'),
});

export const BudgetConsumptionItemSchema = z.object({
  category: CategoryEnum,
  limitAmount: z.number(),
  spentAmount: z.number(),
  remainingAmount: z.number(),
  percentConsumed: z.number(),
  status: z.enum(BUDGET_CONSUMPTION_STATUSES),
});

export const BudgetOverviewResponseSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  totalLimitAmount: z.number(),
  totalSpentAmount: z.number(),
  totalRemainingAmount: z.number(),
  globalPercentConsumed: z.number(),
  globalStatus: z.enum(BUDGET_CONSUMPTION_STATUSES),
  categories: z.array(BudgetConsumptionItemSchema),
});
```

### 3.2 Schemas de Atualização Fiscal de Transação
```typescript
export const UpdateTransactionFiscalBodySchema = z.object({
  isTaxDeductible: z.boolean(),
  taxCategory: z.enum(TAX_CATEGORIES).optional(),
  providerDocument: z.string().regex(/^\d{11}$|^\d{14}$/, 'Documento deve conter 11 (CPF) ou 14 (CNPJ) dígitos').optional(),
  providerName: z.string().min(2).max(120).optional(),
  deductibleAmount: z.number().positive().optional(),
  status: z.enum(FISCAL_VERIFICATION_STATUSES).default('PENDING'),
  notes: z.string().max(250).optional(),
});
```

### 3.3 Schemas de Análise Multi-Mês
```typescript
export const MultiMonthQuerySchema = z.object({
  range: z.enum(['3', '6', '12']).default('6'),
});

export const MonthlyDataPointSchema = z.object({
  month: z.string(),
  totalIncome: z.number(),
  totalExpenses: z.number(),
  netBalance: z.number(),
  savingsRate: z.number(),
});

export const MultiMonthAnalysisResponseSchema = z.object({
  rangeMonths: z.number(),
  averageSavingsRate: z.number(),
  averageMonthlyExpenses: z.number(),
  averageMonthlyIncome: z.number(),
  fixedCostTrend: z.object({
    status: z.enum(['STABLE', 'GROWING', 'DECLINING']),
    percentageChange: z.number(),
    alertCategory: z.string().optional(),
  }),
  monthlyHistory: z.array(MonthlyDataPointSchema),
});
```

### 3.4 Schemas de Carteira de Investimentos
```typescript
export const UpsertInvestmentHoldingBodySchema = z.object({
  accountId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de conta inválido'),
  macroClass: z.enum(ASSET_MACRO_CLASSES),
  amount: z.number().nonnegative('Montante deve ser zero ou positivo'),
  notes: z.string().max(200).optional(),
});

export const InvestmentPortfolioSummarySchema = z.object({
  totalInvested: z.number(),
  riskProfile: z.string().optional(),
  holdings: z.array(
    z.object({
      macroClass: z.enum(ASSET_MACRO_CLASSES),
      amount: z.number(),
      percentage: z.number(),
    })
  ),
  allocationDiagnosis: z.object({
    adherentToRiskProfile: z.boolean(),
    recommendations: z.array(z.string()),
  }),
});
```

### 3.5 Schemas do Painel Fiscal & Dossiê
```typescript
export const FiscalSummaryQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/, 'Ano inválido (formato YYYY)'),
});

export const FiscalAnnualSummaryResponseSchema = z.object({
  year: z.string(),
  totalDeductibleExpenses: z.number(),
  confirmedDeductibleExpenses: z.number(),
  pendingDocumentationExpenses: z.number(),
  byCategory: z.array(
    z.object({
      taxCategory: z.enum(TAX_CATEGORIES),
      totalAmount: z.number(),
      confirmedAmount: z.number(),
      pendingAmount: z.number(),
      count: z.number(),
    })
  ),
  pjSummary: z.object({
    applicable: z.boolean(),
    grossRevenueYearToDate: z.number(),
    annualLimit: z.number(),
    ceilingPercentage: z.number(),
    proLaboreTotal: z.number(),
    dividendsTotal: z.number(),
  }),
});
```
