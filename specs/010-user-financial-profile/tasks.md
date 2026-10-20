# Tasks: Perfil Financeiro, Regime de Renda e Metas do Usuário

**Input**: Design documents from `specs/010-user-financial-profile/` (spec.md, plan.md, research.md, data-model.md, contracts/)

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

- [X] T001 Verificar integridade da branch `feature/010-user-financial-profile` e execução dos testes com `npm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modelagem de dados, esquemas Zod e constantes compartilhadas que suportam todas as histórias de usuário

**⚠️ CRITICAL**: Os enums, schemas de validação e modelo Mongoose de usuário devem ser estendidos antes dos serviços e rotas

- [X] T002 Definir enums `INCOME_TYPES`, `FINANCIAL_GOALS`, `RISK_PROFILES` e tipos correspondentes em `src/config/constants.ts`
- [X] T003 [P] Estender interface `IUser` e schema Mongoose `UserSchema` com o subdocumento `financialProfile` em `src/models/user.model.ts`
- [X] T004 [P] Criar schemas Zod `FinancialProfileSchema`, `UpdateFinancialProfileRequestSchema` e `UserProfileResponseSchema` em `src/schemas/user.schemas.ts`

**Checkpoint**: Schemas e modelos prontos — implementação das histórias de usuário pode prosseguir

---

## Phase 3: User Story 1 - Gerenciamento e Consulta do Perfil Financeiro Voluntário (Priority: P1) 🎯 MVP

**Goal**: Permitir que usuários autenticados consultem seus dados cadastrais e perfil financeiro via `GET /api/user/profile` e atualizem seus dados voluntários via `PUT /api/user/profile`, com validação de enums e valores não-negativos, invalidando automaticamente o cache de análises mensais.

**Independent Test**: Autenticar usuário, enviar requisição `PUT /api/user/profile` com regime "PJ_AUTONOMO", renda declarada e metas, verificar retorno HTTP 200, confirmar atualização via `GET /api/user/profile` e validar expurgo das análises em cache.

### Tests for User Story 1 (TDD) ⚠️

> **NOTE: Escrever estes testes primeiro e garantir que falhem antes da implementação**

- [X] T005 [P] [US1] Escrever testes unitários em `tests/unit/user-service.test.ts` cobrindo `UserService.getProfile` e `UserService.updateFinancialProfile` (persistência, validações e disparo de `AnalysisService.invalidate`)
- [X] T006 [P] [US1] Escrever testes de integração em `tests/integration/user-profile.routes.test.ts` cobrindo `GET /api/user/profile` (200, 401) e `PUT /api/user/profile` (200 com payload válido, 400 para renda negativa, 400 para enum inválido, 401 sem token)

### Implementation for User Story 1

- [X] T007 [US1] Implementar classe de serviço `UserService` em `src/services/user.service.ts` com métodos `getProfile(userId)` e `updateFinancialProfile(userId, updateData)` disparando `AnalysisService.invalidate(userId)`
- [X] T008 [US1] Criar rotas de perfil de usuário em `src/routes/user.routes.ts` com autenticação `requireAuth`, validação de body via `fastify-type-provider-zod` e registrá-las no Fastify em `src/app.ts`
- [X] T009 [US1] Executar e validar aprovação de todos os testes de US1 com `npm test -- tests/unit/user-service.test.ts tests/integration/user-profile.routes.test.ts`

**Checkpoint**: User Story 1 (MVP) 100% funcional e testável de forma autônoma

---

## Phase 4: User Story 2 - Calibragem Contextual de Diagnósticos e Reserva de Emergência pela IA (Priority: P2)

**Goal**: Injetar o perfil financeiro do usuário (`financialProfile`) no prompt do Gemini em `generateFinancialDiagnosis`, calibrando a meta da reserva de emergência (3-6 meses para CLT/servidor público vs. 6-12 meses para PJ/autônomo) e priorizando as metas declaradas no diagnóstico e nas recomendações.

**Independent Test**: Verificar que `GeminiService.buildFinancialDiagnosisPrompts` inclui o perfil financeiro do usuário e instruções de reserva calibradas por regime de trabalho; verificar que `AnalysisService.getAnalysis` carrega e repassa o perfil do usuário.

### Tests for User Story 2 (TDD) ⚠️

- [X] T010 [P] [US2] Escrever testes unitários em `tests/unit/categorization.test.ts` validando a inclusão de dados do perfil e das heurísticas de reserva e metas em `GeminiService.buildFinancialDiagnosisPrompts`

### Implementation for User Story 2

- [X] T011 [US2] Atualizar método `GeminiService.buildFinancialDiagnosisPrompts` e `GeminiService.generateFinancialDiagnosis` em `src/services/gemini.service.ts` para receber e formatar os campos de `financialProfile`
- [X] T012 [US2] Atualizar `AnalysisService.getAnalysis` em `src/services/analysis.service.ts` para carregar o perfil do usuário no MongoDB e repassá-lo na chamada do Gemini
- [X] T013 [US2] Executar e validar aprovação dos testes de US2 com `npm test -- tests/unit/categorization.test.ts tests/integration/analysis.routes.test.ts`

**Checkpoint**: User Stories 1 e 2 plenamente funcionais e integradas

---

## Phase 5: User Story 3 - Hiperpersonalização Conversacional no Chatbot Financeiro (Priority: P3)

**Goal**: Injetar o regime de trabalho, renda declarada e metas prioritárias do usuário nas instruções de sistema da persona do consultor no chatbot (`ChatService.buildSystemInstruction`).

**Independent Test**: Chamar `ChatService.buildSystemInstruction` para um usuário com perfil cadastrado e verificar que o texto contém o regime de trabalho, renda mensal declarada e as metas financeiras.

### Tests for User Story 3 (TDD) ⚠️

- [X] T014 [P] [US3] Escrever teste unitário em `tests/unit/transaction-service.test.ts` validando a injeção do perfil financeiro nas diretrizes de sistema de `ChatService.buildSystemInstruction`

### Implementation for User Story 3

- [X] T015 [US3] Atualizar `ChatService.buildSystemInstruction` em `src/services/chat.service.ts` para buscar o perfil financeiro do usuário no MongoDB e injetá-lo no bloco de diretrizes da persona
- [X] T016 [US3] Executar e validar aprovação dos testes de US3 com `npm test -- tests/unit/transaction-service.test.ts tests/integration/chat.routes.test.ts`

**Checkpoint**: Todas as histórias de usuário (US1, US2, US3) funcionais e integradas

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificação global de regressão, conformidade estrita de tipagem e integridade da documentação

- [X] T017 [P] Executar checagem estrita de tipos do TypeScript em `tsconfig.json` com `npx tsc --noEmit`
- [X] T018 Executar a suíte completa de testes com `npm test` garantindo 100% dos testes verdes e zero regressões em funcionalidades legadas
- [X] T019 Validar cenários do guia rápido descritos em `specs/010-user-financial-profile/quickstart.md`

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
- **User Story 2 (P2)**: Depende de US1 (dados do perfil persistidos no usuário).
- **User Story 3 (P3)**: Depende de US1 (dados do perfil persistidos no usuário).

### Parallel Opportunities

- `T002`, `T003` e `T004` em Foundational podem ser executados em paralelo.
- `T005` e `T006` (testes de US1) podem ser criados em paralelo antes de `T007`.
- `T010` (testes de US2) e `T014` (testes de US3) podem ser criados em paralelo.
- `T017` (typecheck) pode rodar em paralelo com a suíte de testes.
