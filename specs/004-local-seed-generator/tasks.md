# Implementation Tasks: Gerador Local de Seed e Desacoplamento da Pluggy

**Feature**: `004-local-seed-generator`  
**Date**: 2026-10-13  
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Este documento define o plano de tarefas executáveis e ordenadas por dependência para remover completamente o código da Pluggy e implementar o gerador determinístico 100% local de dados sintéticos para testes e demonstrações do dashboard.

---

## Phase 1: User Story 2 - Remoção Integral de Dependências e Código da Pluggy (Priority: P2)

**Goal**: Limpar a base de código, eliminando serviços, variáveis de ambiente e referências à Pluggy, atualizando as origens canônicas de transação.

**Independent Test**: Verificar compilação com `tsc --noEmit` e confirmar ausência de variáveis `PLUGGY_*` no `env.ts` e arquivos associados.

- [x] T001 [US2] Update `TRANSACTION_SOURCES` to `['OFX', 'CSV', 'SEED']` in `src/config/constants.ts` and `src/models/transaction.model.ts`
- [x] T002 [US2] Remove `PLUGGY_API_KEY`, `PLUGGY_CLIENT_ID`, and `PLUGGY_CLIENT_SECRET` from `src/config/env.ts`
- [x] T003 [US2] Delete `src/services/pluggy.service.ts` and `tests/integration/pluggy.routes.test.ts`
- [x] T004 [US2] Verify `src/app.ts` has no pluggy routes and ensure `tests/integration/swagger.test.ts` asserts clean route catalog

---

## Phase 2: User Story 1 - Gerador Local e Autônomo de Dados Sintéticos (Priority: P1) 🎯 MVP

**Goal**: Transformar `scripts/seed.ts` em um gerador autônomo, determinístico e 100% offline de dados sintéticos brasileiros (mais de 35 transações em múltiplos meses e cobrindo todas as 7 categorias), associando a chave do Gemini do `.env` e pré-aquecendo o cache de análise no MongoDB.

**Independent Test**: Executar `npm run seed` no terminal; verificar criação do usuário `teste.usuario@exemplo.com`, importação instantânea de dezenas de transações e análise pré-aquecida (`cached: true`) em menos de 1 segundo sem nenhuma chamada de rede.

- [x] T005 [US1] Implement rich synthetic Brazilian transaction generator with dynamic relative dates (current and previous month, 7 canonical categories) in `scripts/seed.ts`
- [x] T006 [US1] Update `scripts/seed.ts` execution flow to create user `teste.usuario@exemplo.com`, encrypt Gemini key from `.env`, persist synthetic transactions idempotently, and pre-warm monthly analysis cache
- [x] T007 [US1] Update `tests/integration/seed.test.ts` to test local synthetic generation, category distribution, and strict idempotency

**Checkpoint**: User Story 1 (MVP) completamente funcional e independente.

---

## Phase 3: User Story 3 - Atualização da Documentação e Guias Operacionais (Priority: P3)

**Goal**: Atualizar o `README.md` expurgando qualquer referência à Pluggy, destacando a ingestão por arquivos de extrato (OFX/CSV) e o gerador de seed instantâneo local.

**Independent Test**: Revisão visual do `README.md` confirmando diagramas, guia de início rápido e catálogo de endpoints alinhados com a Constituição v2.0.0.

- [x] T008 [US3] Overhaul `README.md` removing all Pluggy references, updating architecture diagrams, and documenting the local seed generator command

---

## Phase 4: Polish & Build Validation

**Purpose**: Verificação de tipos estritos, compilação de produção e execução da suíte de testes completa.

- [x] T009 [P] Validate TypeScript compilation with `tsc --noEmit` and `npm run build`
- [x] T010 [P] Run full test suite with `npx vitest run` to verify 100% passing tests

---

## Dependencies & Execution Order

```text
Phase 1: US2 (Clean up Pluggy & Configs) (T001 - T004)
    │
    ▼
Phase 2: US1 (P1 - MVP: Local Synthetic Seed Generator) (T005 - T007)
    │
    ▼
Phase 3: US3 (P3 - Update Documentation & README) (T008)
    │
    ▼
Phase 4: Polish & Validation (T009, T010)
```
