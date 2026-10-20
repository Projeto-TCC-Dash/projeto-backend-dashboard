# Tasks: Gestão de Contas Bancárias e Cartões

**Input**: Design documents from `/specs/007-accounts-management/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Testes automatizados (TDD) incluídos em cada User Story para garantir conformidade estrita com o Spec-Kit e a Constituição v2.1.0.

**Organization**: Tarefas agrupadas por User Story para assegurar implementação, testes independentes e entrega incremental do MVP.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependências de tarefas não concluídas)
- **[Story]**: Rótulo da User Story correspondente ([US1], [US2], [US3], [US4], [US5])
- Caminhos absolutos/relativos exatos em cada tarefa

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Estruturas de constantes, schemas de dados fundamentais e modelos Mongoose

- [x] T001 [P] Adicionar constantes `ACCOUNT_TYPES`, `AccountTypeEnum`, `AccountType` e `DEFAULT_ACCOUNT_NAME` em `src/config/constants.ts`
- [x] T002 [P] Criar schemas Zod para contas (`CreateAccountBodySchema`, `UpdateAccountBodySchema`, `AccountIdParamSchema`, `DeleteAccountQuerySchema`, `AccountResponseItemSchema`, `ListAccountsResponseSchema`) em `src/schemas/account.schemas.ts`
- [x] T003 [P] Criar interface `IAccount` e modelo Mongoose `AccountModel` com índice composto único `{ userId: 1, name: 1 }` em `src/models/account.model.ts`
- [x] T004 Atualizar `ITransaction` e `TransactionSchema` adicionando `accountId?: Types.ObjectId` (ref: 'Account') e índice `{ userId: 1, accountId: 1 }` em `src/models/transaction.model.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura base de serviço e roteamento que bloqueia a implementação das histórias de usuário

**⚠️ CRITICAL**: Nenhuma User Story pode ser iniciada antes do término desta fase

- [x] T005 Criar classe base `AccountService` com métodos utilitários de busca multi-tenant em `src/services/account.service.ts`
- [x] T006 Registrar o plugin de rotas `accountsRoutes` na aplicação Fastify em `src/app.ts`

**Checkpoint**: Fundação pronta - implementação de histórias de usuário pode iniciar

---

## Phase 3: User Story 1 - Criação e Listagem de Contas (Priority: P1) 🎯 MVP

**Goal**: Permitir que o usuário crie contas com validação de unicidade de nome e liste suas contas com saldo agregado e contagem de transações

**Independent Test**: Enviar `POST /api/accounts` criando uma conta, verificar persistência e listar via `GET /api/accounts` confirmando cálculo de saldo (`initialBalance + sum(transações)`) e `transactionCount`.

### Tests for User Story 1
> **NOTE: Escrever os testes primeiro e garantir que falhem antes da implementação**

- [x] T007 [P] [US1] Criar testes de integração para `POST /api/accounts` e `GET /api/accounts` (criação, erro 409 para nome duplicado, cálculo de saldo consolidado e isolamento multi-tenant) em `tests/accounts.test.ts`

### Implementation for User Story 1

- [x] T008 [US1] Implementar métodos `createAccount` e `listAccountsWithBalances` com agregação do MongoDB em `src/services/account.service.ts`
- [x] T009 [US1] Implementar rotas `POST /api/accounts` e `GET /api/accounts` com validação de schemas Zod e hook de autenticação `requireAuth` em `src/routes/accounts.routes.ts`

**Checkpoint**: User Story 1 funcional e testável de forma 100% autônoma (MVP entregue)

---

## Phase 4: User Story 2 - Atualização e Edição de Propriedades da Conta (Priority: P2)

**Goal**: Permitir ao usuário editar nome, tipo, cor, instituição e saldo inicial de uma conta existente

**Independent Test**: Enviar `PATCH /api/accounts/:id` para uma conta ativa e confirmar que os dados foram atualizados e refletidos na listagem.

### Tests for User Story 2

- [x] T010 [P] [US2] Criar testes de integração para `PATCH /api/accounts/:id` (edição parcial de campos, validação de formato de cor, erro 404 para conta inexistente e erro 409 para colisão de nomes) em `tests/accounts.test.ts`

### Implementation for User Story 2

- [x] T011 [US2] Implementar método `updateAccount` validando unicidade de nome e isolamento multi-tenant por `userId` em `src/services/account.service.ts`
- [x] T012 [US2] Implementar rota `PATCH /api/accounts/:id` com validação de parâmetros e payload Zod em `src/routes/accounts.routes.ts`

**Checkpoint**: User Story 1 e 2 operando conjuntamente e testadas com sucesso

---

## Phase 5: User Story 3 - Exclusão Segura de Contas Financeiras (Priority: P2)

**Goal**: Permitir exclusão de contas com política de proteção (bloqueio 409 quando há transações ativas, cascata com `?cascade=true` e bloqueio da última conta do usuário)

**Independent Test**: Testar exclusão de conta vazia (sucesso 204), conta com transações sem cascata (bloqueio 409), com `?cascade=true` (remoção atômica da conta e transações) e tentativa de deletar a única conta do usuário (erro 400).

### Tests for User Story 3

- [x] T013 [P] [US3] Criar testes de integração para `DELETE /api/accounts/:id` cobrindo conta sem transações (204), com transações e `cascade=false` (409 Conflict), com `cascade=true` (200/204) e proteção da última conta (400) em `tests/accounts.test.ts`

### Implementation for User Story 3

- [x] T014 [US3] Implementar método `deleteAccount` com verificação de transações vinculadas, exclusão em cascata atômica e proteção de conta única em `src/services/account.service.ts`
- [x] T015 [US3] Implementar rota `DELETE /api/accounts/:id` com query parameter `cascade` em `src/routes/accounts.routes.ts`

**Checkpoint**: CRUD completo de contas finalizado e validado

---

## Phase 6: User Story 4 - Associação de Transações e Importação por Conta (Priority: P1)

**Goal**: Permitir que extratos bancários sejam importados para uma conta específica e transações existentes possam ter sua conta reatribuída via PATCH

**Independent Test**: Importar extrato OFX/CSV com `accountId` informado e verificar vínculo; atualizar `accountId` de uma transação existente via `PATCH /api/transactions/:id` e validar recálculo de saldo.

### Tests for User Story 4

- [x] T016 [P] [US4] Criar testes de integração para upload com `accountId` e rota `PATCH /api/transactions/:id` com novo campo `accountId` em `tests/transactions.test.ts`

### Implementation for User Story 4

- [x] T017 [P] [US4] Atualizar schemas `UpdateTransactionBodySchema` e `ListTransactionsQuerySchema` para aceitar `accountId` opcional em `src/schemas/transaction.schemas.ts`
- [x] T018 [US4] Atualizar `TransactionService.importTransactions` para receber `accountId` opcional e atribuir aos lançamentos inseridos em `src/services/transaction.service.ts`
- [x] T019 [US4] Atualizar `TransactionService.updateTransaction` para validar a existência e titularidade da nova conta informada em `accountId` em `src/services/transaction.service.ts`
- [x] T020 [US4] Atualizar rotas `POST /api/transactions/upload`, `GET /api/transactions` e `PATCH /api/transactions/:id` em `src/routes/transactions.routes.ts`

**Checkpoint**: Transações e importação de extratos totalmente integradas com contas

---

## Phase 7: User Story 5 - Provisionamento de Conta Padrão e Seed Local (Priority: P3)

**Goal**: Garantir auto-provisionamento da "Conta Principal" para novos usuários/dados legados e atualizar o gerador sintético de seed

**Independent Test**: Executar listagem ou importação sem conta e verificar que a "Conta Principal" é provisionada automaticamente; rodar `npm run seed` e verificar contas e transações geradas no banco.

### Tests for User Story 5

- [x] T021 [P] [US5] Criar testes para o método `getOrCreateDefaultAccount` e migração de transações legadas sem conta em `tests/accounts.test.ts`

### Implementation for User Story 5

- [x] T022 [US5] Implementar método idempotente `getOrCreateDefaultAccount` com migração de transações órfãs em `src/services/account.service.ts`
- [x] T023 [US5] Atualizar o script de seed local para gerar contas estruturadas ("Conta Corrente", "Cartão de Crédito") e vincular transações em `src/scripts/seed.ts`

**Checkpoint**: Retrocompatibilidade total e autonomia do seed local asseguradas

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verificação estática, cobertura e validação dos cenários do quickstart

- [x] T024 [P] Executar checagem estrita de tipos TypeScript sem emissão de código via `npx tsc --noEmit`
- [x] T025 Executar toda a suíte de testes do projeto via `npm test` garantindo 100% dos testes verdes
- [x] T026 Validar cenários de ponta a ponta descritos no guia de validação em `specs/007-accounts-management/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
1. **Setup (Phase 1)**: Sem dependências - pode iniciar imediatamente.
2. **Foundational (Phase 2)**: Depende do término do Setup - BLOQUEIA todas as User Stories.
3. **User Stories (Phases 3 a 7)**: Dependem do Foundational completo.
   - Ordem recomendada de execução: US1 (P1 - MVP) → US4 (P1 - Integração Transações) → US2 (P2 - Edição) → US3 (P2 - Exclusão Segura) → US5 (P3 - Seed/Auto-provisionamento).
4. **Polish (Phase 8)**: Depende da conclusão de todas as histórias.

### Parallel Opportunities
- **Setup**: T001, T002 e T003 podem ser implementados em paralelo.
- **Testes por Story**: T007, T010, T013, T016 e T021 podem ser escritos em paralelo aos respectivos módulos de teste.
- **Schemas e Serviços**: T017 pode rodar em paralelo com tarefas de serviço de outras histórias.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Completar Setup (T001 - T004) e Foundational (T005 - T006).
2. Escrever testes de US1 (T007) e vê-los falhar (Red).
3. Implementar serviço (T008) e rota (T009) até os testes passarem (Green).
4. Validar o MVP de criação e listagem de contas com saldo agregado.

### Incremental Delivery
- **Incremento 1**: MVP (US1 - Criar e Listar contas com saldos).
- **Incremento 2**: Ingestão e Edição de Transações associadas a Contas (US4).
- **Incremento 3**: Edição e Exclusão Segura de Contas (US2 e US3).
- **Incremento 4**: Auto-provisionamento e Seed Local Sintético (US5).
- **Incremento 5**: Validação final de tipos e testes completos (Polish).
