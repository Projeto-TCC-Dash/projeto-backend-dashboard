# Tasks: Tratamento Contábil Inteligente de Faturas na IA & Métricas

**Input**: Design documents from `specs/009-invoice-accounting-ai/` (spec.md, plan.md, research.md, data-model.md, contracts/)

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test-driven development (TDD) approach included with unit and integration test tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificação do ambiente de execução e integridade da branch ativa

- [X] T001 Verificar integridade da branch `feature/009-invoice-accounting-ai` e execução da suíte de testes com `npm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extensão de schemas e contratos de métricas que suportam todas as histórias de usuário

**⚠️ CRITICAL**: Os modelos e schemas de métricas devem suportar `invoiceSettlements` antes das refatorações nos serviços analíticos

- [X] T002 Atualizar interface `IFinancialMetrics` e schema Mongoose em `src/models/analysis.model.ts` adicionando `invoiceSettlements: number` com default 0
- [X] T003 [P] Atualizar schema Zod `FinancialMetricsSchema` em `src/schemas/analysis.schemas.ts` adicionando `invoiceSettlements: z.number().default(0)`

**Checkpoint**: Schemas prontos e com compatibilidade retroativa — implementação das histórias de usuário pode prosseguir

---

## Phase 3: User Story 1 - Segregação Contábil de Faturas no Cálculo de Despesas Primárias (Priority: P1) 🎯 MVP

**Goal**: Garantir que transações categorizadas como `"Pagamento de Fatura"` não somem como despesas operacionais primárias em `AnalysisService.calculateMetrics`, sejam segregadas em `invoiceSettlements`, não poluam o ranking de `topCategories` e preservem o cálculo da `savingsRate`.

**Independent Test**: Submeter uma lista de transações com compras individuais no cartão e pagamento da fatura para `AnalysisService.calculateMetrics`, verificando que `totalExpenses` reflete apenas as compras reais, `invoiceSettlements` contém o valor da fatura e `topCategories` não contém "Pagamento de Fatura".

### Tests for User Story 1 (TDD) ⚠️

> **NOTE: Escrever estes testes primeiro e garantir que falhem antes da implementação**

- [ ] T004 [P] [US1] Escrever testes unitários em `tests/unit/analysis.service.test.ts` cobrindo segregação de faturas, isolamento de `totalExpenses`, integridade de `topCategories` e taxa de poupança sem duplicação
- [ ] T005 [P] [US1] Escrever teste de integração em `tests/integration/analysis.routes.test.ts` validando a presença e exatidão de `invoiceSettlements` no retorno da rota `GET /api/analysis/:month`

### Implementation for User Story 1

- [ ] T006 [US1] Implementar segregação de `"Pagamento de Fatura"` no método `AnalysisService.calculateMetrics` em `src/services/analysis.service.ts`
- [ ] T007 [US1] Executar e validar a aprovação de todos os testes de US1 com `npm test -- tests/unit/analysis.service.test.ts tests/integration/analysis.routes.test.ts`

**Checkpoint**: User Story 1 (MVP) 100% funcional e testável de forma autônoma

---

## Phase 4: User Story 2 - Diagnóstico Financeiro Consciente de Faturas na IA (Priority: P2)

**Goal**: Calibrar o prompt de sistema do Gemini em `generateFinancialDiagnosis` com regras contábeis explícitas para tratar liquidações de fatura como transferências de quitação de passivo e não como compras adicionais supérfluas.

**Independent Test**: Verificar que o prompt gerado em `src/services/gemini.service.ts` contém as diretrizes contábeis de faturas e segrega o montante de liquidações no relatório de entrada.

### Tests for User Story 2 (TDD) ⚠️

- [ ] T008 [P] [US2] Escrever testes unitários em `tests/unit/categorization.test.ts` validando a inclusão de diretrizes contábeis de faturas no prompt de diagnóstico gerado por `GeminiService`

### Implementation for User Story 2

- [ ] T009 [US2] Atualizar o prompt de sistema e resumo financeiro em `GeminiService.generateFinancialDiagnosis` em `src/services/gemini.service.ts` incorporando as instruções contábeis de faturas
- [ ] T010 [US2] Executar e validar aprovação dos testes de US2 com `npm test -- tests/unit/categorization.test.ts`

**Checkpoint**: User Stories 1 e 2 plenamente funcionais e independentes

---

## Phase 5: User Story 3 - Resumo Mensal Alinhado no Assistente de Chat (Priority: P3)

**Goal**: Segregar o valor de quitações de fatura no resumo financeiro mensal (`TransactionService.getMonthlyFinancialSummary`) e nas instruções do chatbot (`ChatService.buildSystemInstruction`).

**Independent Test**: Chamar `TransactionService.getMonthlyFinancialSummary` com transações contendo faturas e verificar que `totalExpenses` exclui faturas e `invoiceSettlements` reporta o total quitado; verificar que `ChatService.buildSystemInstruction` orienta a persona do consultor a diferenciar faturas de despesas de consumo.

### Tests for User Story 3 (TDD) ⚠️

- [ ] T011 [P] [US3] Escrever testes unitários para `TransactionService.getMonthlyFinancialSummary` e `ChatService.buildSystemInstruction` em `tests/unit/transaction-service.test.ts`

### Implementation for User Story 3

- [ ] T012 [US3] Atualizar `TransactionService.getMonthlyFinancialSummary` em `src/services/transaction.service.ts` para segregar `invoiceSettlements` de `totalExpenses`
- [ ] T013 [US3] Atualizar `ChatService.buildSystemInstruction` em `src/services/chat.service.ts` instruindo a persona a diferenciar gastos de consumo de pagamentos de fatura
- [ ] T014 [US3] Executar e validar aprovação dos testes de US3 com `npm test -- tests/unit/transaction-service.test.ts tests/integration/chat.routes.test.ts`

**Checkpoint**: Todas as histórias de usuário (US1, US2, US3) funcionais e integradas

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificação global de regressão, conformidade estrita de tipagem e integridade da documentação

- [ ] T015 [P] Executar checagem estrita de tipos do TypeScript em `tsconfig.json` com `npx tsc --noEmit`
- [ ] T016 Executar a suíte completa de testes com `npm test` garantindo 100% dos testes verdes e zero regressões em funcionalidades legadas
- [ ] T017 Validar cenários do guia rápido descritos em `specs/009-invoice-accounting-ai/quickstart.md`

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
- **User Story 2 (P2)**: Depende dos schemas da Phase 2. Independente de US3.
- **User Story 3 (P3)**: Depende da regra contábil validada na US1.

### Parallel Opportunities

- `T002` e `T003` em Foundational podem ser executados em paralelo.
- `T004` e `T005` (testes de US1) podem ser criados em paralelo antes de `T006`.
- `T008` (testes de US2) pode ser criado em paralelo a `T011` (testes de US3).
- `T015` (typecheck) pode rodar em paralelo com a suíte de testes.
