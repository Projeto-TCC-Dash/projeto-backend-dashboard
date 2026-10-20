# Tasks: Novas Categorias Canônicas e Exclusão Pontual de Transações

**Input**: Design documents from `specs/008-categories-and-deletion/` (spec.md, plan.md, research.md, data-model.md, contracts/)

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test-driven development (TDD) approach included with unit and integration test tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificação do ambiente de execução e alinhamento dos módulos da feature

- [X] T001 Verificar integridade da branch `feature/008-categories-and-deletion` e execução da suíte de testes existente com `npm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Expansão do domínio de categorias canônicas que dá suporte a todas as histórias de usuário

**⚠️ CRITICAL**: A enumeração canônica e o modelo base de transações precisam ser atualizados antes dos fluxos de mutação e IA

- [X] T002 Atualizar `CANONICAL_CATEGORIES` em `src/config/constants.ts` adicionando `"Pagamento de Fatura"` e `"Investimentos"`, totalizando 11 categorias canônicas
- [X] T003 [P] Implementar método estático `AnalysisService.invalidate(userId: string): Promise<number>` em `src/services/analysis.service.ts` para remoção atômica de análises em cache via `FinancialAnalysisModel.deleteMany({ userId })`

**Checkpoint**: Enumerações e infraestrutura de invalidação prontas — implementação das histórias de usuário pode prosseguir

---

## Phase 3: User Story 1 - Exclusão Pontual de Transação com Sincronização de Métricas (Priority: P1) 🎯 MVP

**Goal**: Permitir que usuários autenticados excluam qualquer transação pontual de sua propriedade via `DELETE /api/transactions/:id`, garantindo isolamento multi-tenant seguro e invalidação imediata do cache de análises financeiras.

**Independent Test**: Criar uma transação para o usuário via fixture, chamar `DELETE /api/transactions/:id`, verificar retorno HTTP 204, confirmar que a transação não é mais retornada no banco e que as análises em cache foram expurgadas.

### Tests for User Story 1 (TDD) ⚠️

> **NOTE: Escrever estes testes primeiro e garantir que falhem antes da implementação do endpoint**

- [ ] T004 [P] [US1] Escrever testes de integração para `DELETE /api/transactions/:id` em `tests/integration/transactions.test.ts` cobrindo cenários 204 (sucesso), 404 (transação inexistente), 404 (transação de outro usuário - isolamento multi-tenant), 400 (ID de transação malformado) e 401 (sem token)
- [ ] T005 [P] [US1] Escrever teste unitário para `TransactionService.deleteTransaction` e invalidação em `tests/unit/transaction-service.test.ts`

### Implementation for User Story 1

- [ ] T006 [US1] Implementar método `TransactionService.deleteTransaction(userId: string, transactionId: string): Promise<boolean>` em `src/services/transaction.service.ts` utilizando `TransactionModel.findOneAndDelete` e disparando `AnalysisService.invalidate(userId)`
- [ ] T007 [US1] Registrar a rota `DELETE /api/transactions/:id` em `src/routes/transactions.routes.ts` com autenticação `requireAuth`, validação com `TransactionIdParamSchema` e respostas HTTP 204, 400, 401 e 404
- [ ] T008 [US1] Executar e validar a aprovação de todos os testes de US1 com `npm test -- tests/integration/transactions.test.ts tests/unit/transaction-service.test.ts`

**Checkpoint**: User Story 1 (MVP) 100% funcional e testável de forma autônoma

---

## Phase 4: User Story 2 - Expansão de Categorias Canônicas para Faturas e Investimentos (Priority: P2)

**Goal**: Permitir que usuários classifiquem manualmente transações em `"Pagamento de Fatura"` ou `"Investimentos"` via `PATCH /api/transactions/:id`, e calibrar o prompt do motor de inteligência artificial Gemini para classificar liquidações de fatura e aportes de investimento.

**Independent Test**: Atualizar a categoria de uma transação existente via `PATCH /api/transactions/:id` para as novas categorias e verificar sucesso; testar calibração do prompt do Gemini para classificar faturas e aportes.

### Tests for User Story 2 (TDD) ⚠️

- [ ] T009 [P] [US2] Escrever testes unitários em `tests/unit/categorization.test.ts` verificando validação das 11 categorias canônicas em `CategoryEnum` e presença das diretrizes de fatura e investimentos no prompt de sistema do Gemini
- [ ] T010 [P] [US2] Escrever teste de integração em `tests/integration/transactions.test.ts` validando a mutação de categoria via `PATCH /api/transactions/:id` para `"Pagamento de Fatura"` e `"Investimentos"`

### Implementation for User Story 2

- [ ] T011 [US2] Calibrar o prompt do sistema em `src/services/gemini.service.ts` com diretrizes explícitas para liquidação de faturas de cartão ("Pagamento de Fatura") e aportes/títulos/ações ("Investimentos")
- [ ] T012 [US2] Validar suporte integral às 11 categorias no fluxo de edição manual `PATCH /api/transactions/:id` em `src/routes/transactions.routes.ts` e `src/services/transaction.service.ts`
- [ ] T013 [US2] Executar e validar aprovação dos testes de US2 com `npm test -- tests/unit/categorization.test.ts tests/integration/transactions.test.ts`

**Checkpoint**: User Stories 1 e 2 plenamente funcionais e independentes

---

## Phase 5: User Story 3 - Consulta e Filtragem por Novas Categorias Canônicas (Priority: P3)

**Goal**: Permitir que usuários listem transações filtrando especificamente por `"Pagamento de Fatura"` ou `"Investimentos"` no endpoint `GET /api/transactions?category=...`.

**Independent Test**: Realizar requisições `GET /api/transactions?category=Pagamento%20de%20Fatura` e verificar que apenas transações dessa categoria são retornadas no payload.

### Tests for User Story 3 (TDD) ⚠️

- [ ] T014 [P] [US3] Escrever teste de integração em `tests/integration/transactions.test.ts` para filtros de listagem por `"Pagamento de Fatura"` e `"Investimentos"`

### Implementation for User Story 3

- [ ] T015 [US3] Assegurar que `ListTransactionsQuerySchema` e o pipeline de agregação/busca em `src/services/transaction.service.ts` aceitam e filtram perfeitamente as 11 categorias canônicas
- [ ] T016 [US3] Executar e validar aprovação dos testes de US3 com `npm test -- tests/integration/transactions.test.ts`

**Checkpoint**: Todas as histórias de usuário (US1, US2, US3) funcionais e integradas

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificação global de regressão, conformidade estrita de tipagem e integridade da documentação

- [ ] T017 [P] Executar checagem estrita de tipos do TypeScript em `tsconfig.json` com `npx tsc --noEmit`
- [ ] T018 Executar a suíte completa de testes com `npm test` garantindo 100% dos testes verdes e zero regressões em funcionalidades legadas
- [ ] T019 Validar cenários do guia rápido descritos em `specs/008-categories-and-deletion/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — execução imediata.
- **Foundational (Phase 2)**: Depende do Setup — **BLOQUEIA** todas as User Stories.
- **User Stories (Phases 3, 4, 5)**: Dependem da conclusão da Phase 2.
  - Ordem de execução recomendada: US1 (P1 - MVP) → US2 (P2) → US3 (P3).
- **Polish (Phase 6)**: Depende da conclusão de todas as histórias de usuário implementadas.

### User Story Dependencies

- **User Story 1 (P1 - MVP)**: Pode iniciar imediatamente após a Phase 2. Nenhuma dependência das outras stories.
- **User Story 2 (P2)**: Pode iniciar após a Phase 2. Não bloqueia US1.
- **User Story 3 (P3)**: Pode iniciar após a Phase 2. Valida a filtragem das categorias criadas em US2.

### Parallel Opportunities

- `T002` e `T003` em Foundational podem ser implementados e testados em paralelo.
- `T004` e `T005` (testes de US1) podem ser criados em paralelo antes de `T006`.
- `T009` e `T010` (testes de US2) podem ser criados em paralelo antes de `T011`.
- `T017` (typecheck) pode rodar em paralelo aos testes unitários.

---

## Parallel Example: User Story 1

```bash
# Executar testes da User Story 1 em paralelo:
npm test -- tests/integration/transactions.test.ts
npm test -- tests/unit/transaction-service.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Executar Phase 1 (Setup) e Phase 2 (Foundational).
2. Escrever testes de US1 (`T004`, `T005`).
3. Implementar serviço e rota de exclusão (`T006`, `T007`).
4. **Validar MVP**: `npm test -- tests/integration/transactions.test.ts` (US1 testada independentemente).

### Incremental Delivery

1. Setup + Foundational concluídos.
2. User Story 1 (Exclusão pontual & invalidação de cache) entregue como MVP.
3. User Story 2 (Novas categorias canônicas & calibração Gemini) entregue.
4. User Story 3 (Filtros de listagem pelas novas categorias) entregue.
5. Polish (Typecheck & suíte completa com 100% de cobertura).
