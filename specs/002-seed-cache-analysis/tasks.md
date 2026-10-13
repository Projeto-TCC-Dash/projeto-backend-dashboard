# Implementation Tasks: Cache de Análises com TTL, Seed Pluggy e Expansão da Documentação

**Feature**: `002-seed-cache-analysis`  
**Date**: 2026-10-13  
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Este documento define o plano de tarefas executáveis e ordenadas por dependência para a implementação do cache de análises com TTL, script de seed automatizado e reestruturação do README.md.

---

## Phase 1: Setup & Data Model

**Purpose**: Estruturação dos esquemas e modelos de dados para a coleção de análises financeiras.

- [x] T001 [P] Create `FinancialAnalysis` Mongoose model with unique index `{ userId: 1, month: 1 }` and native TTL index `{ expiresAt: 1 }` in `src/models/analysis.model.ts`
- [x] T002 [P] Define Zod schemas and DTOs for `FinancialAnalysisResponse`, `AnalysisQuery`, and `FinancialMetrics` in `src/schemas/analysis.schemas.ts`

---

## Phase 2: User Story 1 - Cache Inteligente de Análises Financeiras (Priority: P1) 🎯 MVP

**Goal**: Entregar diagnósticos mensais gerados por IA com cache de 24 horas no MongoDB, reaproveitando a análise quando o estado das transações não mudar (`cached: true`, <50ms) e economizando >90% de tokens no Gemini.

**Independent Test**: Chamar `GET /api/analysis/2026-10` uma vez (gera com IA, retorna `cached: false`), chamar novamente logo em seguida (retorna instantaneamente com `cached: true` e 0 chamadas ao Gemini); ao adicionar nova transação, o cache é invalidado e a próxima chamada regera com `cached: false`.

- [x] T003 [US1] Implement deterministic transaction state hashing utility (`transactionStateHash`) in `src/services/analysis.service.ts`
- [x] T004 [US1] Implement Gemini structured financial diagnosis generator with strict JSON Schema in `src/services/gemini.service.ts`
- [x] T005 [US1] Implement `AnalysisService` managing cache lookup, TTL validation, hash comparison, and fallback generation in `src/services/analysis.service.ts`
- [x] T006 [US1] Implement route `GET /api/analysis/:month` protected by `requireAuth` in `src/routes/analysis.routes.ts`
- [x] T007 [US1] Register `analysisRoutes` in `src/app.ts`
- [x] T008 [US1] Create unit tests for transaction state hashing and cache invalidation in `tests/unit/analysis.service.test.ts`
- [x] T009 [US1] Create integration tests for `GET /api/analysis/:month` in `tests/integration/analysis.routes.test.ts`

**Checkpoint**: User Story 1 (MVP) completamente funcional e testável de forma independente.

---

## Phase 3: User Story 2 - População Automatizada de Ambiente de Teste (Seed Pluggy e Chave .env) (Priority: P2)

**Goal**: Script executável `npm run seed` para provisionamento imediato de usuário de teste com chave BYOK ativa do `.env`, transações da sandbox da Pluggy e análise pré-aquecida.

**Independent Test**: Executar `npm run seed` em um terminal; verificar criação do usuário `teste.pluggy@exemplo.com`, chave do Gemini vinculada e transações prontas para teste. Reexecutar para validar idempotência (0 duplicatas).

- [x] T010 [P] [US2] Add `"seed": "tsx scripts/seed.ts"` script command in `package.json`
- [x] T011 [US2] Implement `scripts/seed.ts` creating `teste.pluggy@exemplo.com`, encrypting `GOOGLE_GENERATIVE_AI_API_KEY`, importing Pluggy sandbox transactions, and pre-warming analysis in `scripts/seed.ts`
- [x] T012 [US2] Create integration test verifying seed execution idempotency in `tests/integration/seed.test.ts`

**Checkpoint**: User Stories 1 e 2 funcionais e integradas.

---

## Phase 4: User Story 3 - Expansão da Documentação Arquitetural no README (Priority: P3)

**Goal**: Reformulação completa do `README.md` com visão executiva, diagramas Mermaid (Arquitetura, LGPD, BYOK e Cache com TTL), guia do Docker Compose e catálogo de endpoints.

**Independent Test**: Revisão visual do `README.md` confirmando a presença de todos os diagramas renderizáveis, tabelas e comandos operacionais.

- [x] T013 [US3] Update and expand `README.md` with complete architectural documentation, Mermaid flowcharts (Architecture, LGPD Sanitization, BYOK Security Lifecycle, Cache & TTL Strategy), Docker Compose guide, and API reference in `README.md`

---

## Phase 5: Polish & Build Validation

**Purpose**: Verificação de tipos estritos, execução da suite de testes completa e validação de build.

- [x] T014 [P] Validate TypeScript compilation with `tsc --noEmit` and `npm run build`
- [x] T015 [P] Run full test suite with `npx vitest run` and execute `npm run seed` to verify end-to-end integration

---

## Dependencies & Execution Order

```text
Phase 1: Setup & Data Model (T001, T002)
    │
    ▼
Phase 2: US1 (P1 - MVP: Analysis Cache & Route) (T003 - T009)
    │
    ▼
Phase 3: US2 (P2 - Seed Script & Pluggy) (T010 - T012)
    │
    ▼
Phase 4: US3 (P3 - README Expansion) (T013)
    │
    ▼
Phase 5: Polish & Validation (T014, T015)
```
