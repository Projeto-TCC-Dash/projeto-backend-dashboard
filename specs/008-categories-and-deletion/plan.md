# Implementation Plan: Novas Categorias Canônicas e Exclusão Pontual de Transações

**Branch**: `feature/008-categories-and-deletion` | **Date**: 2026-10-19 | **Spec**: [specs/008-categories-and-deletion/spec.md](spec.md)

**Input**: Feature specification from `specs/008-categories-and-deletion/spec.md`

## Summary

Esta feature expande as categorias financeiras canônicas do sistema, adicionando `"Pagamento de Fatura"` e `"Investimentos"` (expandindo de 9 para 11 categorias), calibrando as instruções do motor de IA Gemini para classificar liquidações de faturas e aportes patrimoniais. Adicionalmente, implementa o endpoint de exclusão pontual de transação (`DELETE /api/transactions/:id`) com garantia atômica, isolamento multi-tenant estrito por `userId` e invalidação automática do cache de análise financeira do usuário via `AnalysisService.invalidate(userId)`.

## Technical Context

**Language/Version**: TypeScript 5.x (Strict mode) / Node.js >= 20.x

**Primary Dependencies**: Fastify 5.x, Zod 3.x (`fastify-type-provider-zod`), Mongoose 8.x, `@google/genai` (SDK oficial do Gemini)

**Storage**: MongoDB (Mongoose ODM, sem bancos relacionais)

**Testing**: Vitest (`npm test`), supertest / fastify.inject para testes de integração

**Target Platform**: Linux / macOS containerizado via Docker Compose

**Project Type**: REST API Web Service (Backend headless)

**Performance Goals**: Tempo de resposta de exclusão de transação < 300ms p95; latência de listagem com filtro < 100ms

**Constraints**: Autenticação stateless JWT (`requireAuth`), zero vazamento de dados entre usuários (404 seguro), proibição de tipos `any`, conformidade estrita com LGPD

**Scale/Scope**: Módulo de transações existente (`src/routes/transactions.routes.ts`, `src/services/transaction.service.ts`, `src/config/constants.ts`, `src/services/gemini.service.ts`, `src/services/analysis.service.ts`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Escopo Estrito de Backend (TypeScript & Node.js Strict)**: Tipagem estrita com Zod e Mongoose, sem `any`.
- [x] **Principle II: Stack Tecnológica Sem Dependências Relacionais**: Utilização exclusiva de Fastify, Zod e MongoDB/Mongoose. Nenhum banco relacional adicionado.
- [x] **Principle III: Arquitetura BYOK & Custo Zero de IA**: Categorização mantém padrão BYOK com chave criptografada em AES-256-GCM.
- [x] **Principle IV: Minimização Extrema de Tokens**: Categorização por IA mantém a deduplicação de nomes únicos de estabelecimentos antes do envio à LLM.
- [x] **Principle V: Ingestão de Extratos e Provedor Local de Seed**: Esquema canônico unificado atualizado com as novas categorias.
- [x] **Principle VI: Containerização Integral**: Compatível com Docker Compose existente.
- [x] **Principle VII: Autenticação Stateless e LGPD**: `requireAuth` em todas as rotas com chave JWT; isolamento multi-tenant obrigatório; nenhum PII persistido ou enviado à IA.

## Project Structure

### Documentation (this feature)

```text
specs/008-categories-and-deletion/
├── spec.md              # Especificação de requisitos da feature
├── plan.md              # Este plano de implementação
├── research.md          # Decisões técnicas e de arquitetura
├── data-model.md        # Modelagem de dados e esquemas
├── quickstart.md        # Guia de validação e testes
├── contracts/
│   └── transactions-api.md  # Contrato REST do endpoint DELETE /api/transactions/:id e filtros
└── checklists/
    └── requirements.md  # Checklist de qualidade da especificação
```

### Source Code (repository root)

```text
src/
├── config/
│   └── constants.ts                # Adição de "Pagamento de Fatura" e "Investimentos" em CANONICAL_CATEGORIES
├── models/
│   ├── transaction.model.ts        # Atualização do enum Mongoose com CANONICAL_CATEGORIES
│   └── analysis.model.ts           # Modelo de cache de análises
├── routes/
│   └── transactions.routes.ts      # Adição do endpoint DELETE /api/transactions/:id
├── services/
│   ├── transaction.service.ts      # Método deleteTransaction(userId, transactionId)
│   ├── analysis.service.ts         # Método invalidate(userId)
│   └── gemini.service.ts           # Calibração do prompt de categorização inteligente
└── schemas/
    └── transaction.schemas.ts      # Reutilização de TransactionIdParamSchema e CategoryEnum

tests/
├── unit/
│   └── categorization.test.ts      # Testes das 11 categorias canônicas
└── integration/
    └── transactions.test.ts        # Testes de exclusão (204, 404, 400), multi-tenant e invalidação
```

**Structure Decision**: Padrão modular Fastify + Services + Models existente, mantendo coesão e baixo acoplamento.

## Complexity Tracking

> Nenhuma violação das regras constitucionais identificada. Nenhuma complexidade acidental introduzida.
