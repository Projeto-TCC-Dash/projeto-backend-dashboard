# Data Model: Reestruturação da Pluggy para Motor Interno de Seed

**Feature**: `003-pluggy-sandbox-seed`  
**Date**: 2026-10-13  
**Status**: Concluído (Fase 1)

---

## 1. Entidades Internas de Comunicação com a Pluggy

Como a Pluggy deixa de possuir rotas públicas e schemas Zod de API exposta, seus modelos são puramente interfaces TypeScript internas em `src/services/pluggy.service.ts`:

```typescript
export interface PluggyCreateItemResponse {
  id: string;
  status: 'UPDATING' | 'UPDATED' | 'LOGIN_ERROR' | 'OUTDATED';
  executionStatus: string;
}

export interface PluggyAccount {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  balance?: number;
}

export interface PluggyTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
  type?: string;
}
```

---

## 2. Esquema Canônico Persistido no MongoDB (`transactions`)

As transações baixadas da sandbox da Pluggy são convertidas para o modelo canônico unificado da plataforma:

```typescript
export interface ITransaction {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  externalId: string;       // ID original da transação na Pluggy
  rawDescription: string;   // Descrição original da Pluggy
  cleanDescription: string; // Descrição limpa pelo SanitizerService (LGPD)
  amount: number;           // Valor da movimentação (positivo = receita, negativo = despesa)
  date: Date;               // Data da movimentação
  category: Category;       // Categoria canônica atribuída
  source: 'PLUGGY';         // Origem demarcada como Open Finance Sandbox
  createdAt: Date;
  updatedAt: Date;
}
```

### Índices de Idempotência
- Índice Único Composto: `{ userId: 1, externalId: 1 }`
- Garante 0 registros duplicados ao reexecutar o seed.
