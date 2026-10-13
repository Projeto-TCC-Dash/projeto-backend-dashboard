# Data Model: Gerador Local de Seed e Desacoplamento da Pluggy

**Feature**: `004-local-seed-generator`  
**Date**: 2026-10-13  
**Status**: Concluído (Fase 1)

---

## 1. Origens Canônicas de Transação (`TRANSACTION_SOURCES`)

A constante canônica em `src/config/constants.ts` e a tipagem no modelo `TransactionModel` passam a ser:

```typescript
export const TRANSACTION_SOURCES = ['OFX', 'CSV', 'SEED'] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];
```

---

## 2. Estrutura das Transações Sintéticas Geradas

As transações geradas pelo script `scripts/seed.ts` utilizam a estrutura canônica:

```typescript
export interface ISyntheticTransaction {
  externalId: string;       // ex: 'seed-2026-10-01'
  rawDescription: string;   // ex: 'COMPRA CARTAO PAO DE ACUCAR'
  cleanDescription: string; // ex: 'PAO DE ACUCAR'
  amount: number;           // positivo para receitas, negativo para despesas
  date: Date;               // data no mês corrente ou no mês anterior
  category: Category;       // Alimentação, Moradia, Transporte, etc.
  source: 'SEED';           // Marcador de dados sintéticos de teste
}
```

### Índices de Persistência no MongoDB (`transactions`)
- Índice Único Composto: `{ userId: 1, externalId: 1 }`
- Garante 0 registros duplicados em execuções repetidas do seed.
