# Implementation Plan: Tratamento Contábil Inteligente de Faturas na IA & Métricas

**Branch**: `feature/009-invoice-accounting-ai` | **Date**: 2026-10-19 | **Spec**: [specs/009-invoice-accounting-ai/spec.md](spec.md)

**Input**: Feature specification from `specs/009-invoice-accounting-ai/spec.md`

## Summary

Esta feature implementa o tratamento contábil inteligente de pagamentos de faturas de cartão de crédito. No cálculo de métricas financeiras (`AnalysisService.calculateMetrics`), transações na categoria `"Pagamento de Fatura"` são segregadas em `invoiceSettlements` e excluídas da soma de despesas operacionais primárias (`totalExpenses`) e do ranking de maiores gastos (`topCategories`), evitando a contagem dupla de despesas e protegendo o cálculo da taxa de poupança. Adicionalmente, as diretrizes de sistema da IA Gemini em diagnósticos e no chatbot são atualizadas com instruções contábeis explícitas.

## Technical Context

**Language/Version**: TypeScript 5.x (Strict mode) / Node.js >= 20.x

**Primary Dependencies**: Fastify 5.x, Zod 3.x (`fastify-type-provider-zod`), Mongoose 8.x, `@google/genai`

**Storage**: MongoDB (Mongoose ODM, sem bancos relacionais)

**Testing**: Vitest (`npm test`), supertest / fastify.inject

**Target Platform**: Linux / macOS containerizado via Docker Compose

**Project Type**: REST API Web Service (Backend headless)

**Performance Goals**: Tempo de cálculo de métricas < 10ms; zero overhead computacional adicional.

**Constraints**: Autenticação stateless JWT (`requireAuth`), zero quebra de contratos legados (compatibilidade retroativa com `default(0)` para `invoiceSettlements`).

**Scale/Scope**: Módulos analíticos e de IA (`src/models/analysis.model.ts`, `src/schemas/analysis.schemas.ts`, `src/services/analysis.service.ts`, `src/services/transaction.service.ts`, `src/services/gemini.service.ts`, `src/services/chat.service.ts`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Escopo Estrito de Backend (TypeScript & Node.js Strict)**: Tipagem estrita com Zod e Mongoose, sem `any`.
- [x] **Principle II: Stack Tecnológica Sem Dependências Relacionais**: Utilização exclusiva de Fastify, Zod e MongoDB/Mongoose.
- [x] **Principle III: Arquitetura BYOK & Custo Zero de IA**: Prompts ajustados com regras contábeis preservando BYOK.
- [x] **Principle IV: Minimização Extrema de Tokens**: Resumo financeiro enxuto mantendo Structured Outputs.
- [x] **Principle V: Ingestão de Extratos e Provedor Local de Seed**: Suporte contábil às categorias geradas pelo seed e extratos.
- [x] **Principle VI: Containerização Integral**: Compatível com Docker Compose.
- [x] **Principle VII: Autenticação Stateless e LGPD**: `requireAuth` preservado; nenhuma PII nos prompts da IA.

## Project Structure

### Documentation (this feature)

```text
specs/009-invoice-accounting-ai/
├── spec.md              # Especificação de requisitos da feature
├── plan.md              # Este plano de implementação
├── research.md          # Decisões técnicas contábeis e de arquitetura
├── data-model.md        # Modelagem de dados e esquemas de métricas
├── quickstart.md        # Guia de validação e testes
├── contracts/
│   └── metrics-contracts.md # Contrato REST com campo invoiceSettlements
└── checklists/
    └── requirements.md  # Checklist de qualidade da especificação
```

### Source Code (repository root)

```text
src/
├── models/
│   └── analysis.model.ts           # Adição de invoiceSettlements em IFinancialMetrics e schema Mongoose
├── schemas/
│   └── analysis.schemas.ts         # Adição de invoiceSettlements em FinancialMetricsSchema
├── services/
│   ├── analysis.service.ts         # Segregação contábil em calculateMetrics
│   ├── transaction.service.ts      # Segregação contábil em getMonthlyFinancialSummary
│   ├── gemini.service.ts           # Diretrizes contábeis em generateFinancialDiagnosis
│   └── chat.service.ts             # Injeção de contexto diferenciado em buildSystemInstruction

tests/
├── unit/
│   └── analysis.service.test.ts    # Testes unitários de segregação de fatura, despesas e poupança
└── integration/
    ├── analysis.routes.test.ts     # Teste de integração do payload da análise
    └── chat.routes.test.ts         # Teste de injeção de contexto no chat
```

**Structure Decision**: Refatoração interna nos serviços e schemas existentes sem criação de novas entidades de banco.

## Complexity Tracking

> Nenhuma violação das regras constitucionais identificada. Nenhuma complexidade acidental introduzida.
