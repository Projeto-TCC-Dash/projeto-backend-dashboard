# Tasks: Vínculo de Contas Sociais — Google OAuth 2.0

**Input**: Design documents from `/specs/013-google-auth-linking/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configurações de ambiente, contratos Zod e schemas compartilhados

- [X] T001 Adicionar variável opcional `GOOGLE_CLIENT_ID` ao schema de variáveis de ambiente em `src/config/env.ts`
- [X] T002 [P] Criar schemas Zod para vínculo, desvinculação e login com Google em `src/schemas/auth.schemas.ts`
- [X] T003 [P] Atualizar `UserSecuritySettingsSchema` e contratos de perfil para incluir metadados sociais em `src/schemas/user.schemas.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura de dados e serviço validador de token do Google que bloqueiam todas as User Stories

**⚠️ CRITICAL**: Nenhuma User Story pode ser iniciada antes da conclusão desta fase

- [X] T004 Estender interface `IUser`, criar subschema `GoogleAccountSubschema` e adicionar índice único esparso em `googleAccount.googleId` em `src/models/user.model.ts`
- [X] T005 [P] Implementar serviço `GoogleOAuthService` para validação de ID Token do Google via endpoint oficial em `src/services/google-auth.service.ts`
- [X] T006 [P] Criar suite de testes unitários para o validador `GoogleOAuthService` em `tests/unit/google-auth.service.test.ts`

**Checkpoint**: Base de dados e validação de token prontas — implementação das histórias pode começar

---

## Phase 3: User Story 1 - Vinculação de Conta Google (Priority: P1) 🎯 MVP

**Goal**: Permitir que usuários autenticados vinculem sua conta Google através de um ID token válido

**Independent Test**: Usuário autenticado envia `POST /api/auth/google/link` com ID token válido e tem seu subdocumento `googleAccount` persistido, rejeitando tokens inválidos e conflitos de contas duplicadas.

### Tests for User Story 1
- [X] T007 [P] [US1] Criar suite de testes de integração para vinculação de conta Google (`POST /api/auth/google/link`) em `tests/integration/google-link.test.ts`

### Implementation for User Story 1
- [X] T008 [US1] Implementar método `AuthService.linkGoogleAccount` em `src/services/auth.service.ts` com validação de token, checagem de conflito 409 e persistência do vínculo
- [X] T009 [US1] Registrar rota autenticada `POST /api/auth/google/link` no Fastify com validação Zod e hook `requireAuth` em `src/routes/auth.routes.ts`
- [X] T010 [US1] Executar e validar aprovação dos testes de integração de vinculação com `npm test -- tests/integration/google-link.test.ts`

**Checkpoint**: User Story 1 (MVP) completamente funcional e testável de forma autônoma

---

## Phase 4: User Story 2 - Desvinculação com Guarda de Senha Local (Priority: P2)

**Goal**: Permitir desvinculação da conta Google com regra de segurança que impede perda total de acesso à conta

**Independent Test**: Usuário autenticado com senha local consegue desvincular via `DELETE /api/auth/google/unlink`; usuário sem senha local tem a solicitação bloqueada com erro 400.

### Tests for User Story 2
- [X] T011 [P] [US2] Criar suite de testes de integração para desvinculação de conta Google (`DELETE /api/auth/google/unlink`) em `tests/integration/google-unlink.test.ts`

### Implementation for User Story 2
- [X] T012 [US2] Implementar método `AuthService.unlinkGoogleAccount` em `src/services/auth.service.ts` com guarda `hasLocalPassword` e remoção de `googleAccount`
- [X] T013 [US2] Registrar rota autenticada `DELETE /api/auth/google/unlink` no Fastify em `src/routes/auth.routes.ts`
- [X] T014 [US2] Executar e validar aprovação dos testes de desvinculação com `npm test -- tests/integration/google-unlink.test.ts`

**Checkpoint**: User Story 1 e 2 operacionais e protegidas contra lock-out

---

## Phase 5: User Story 3 - Consulta do Estado de Vínculo e Login via Google (Priority: P3)

**Goal**: Exibir status do vínculo no perfil e permitir login social por conta Google vinculada com suporte a 2FA

**Independent Test**: `GET /api/user/profile` retorna metadados no subobjeto `security`; `POST /api/auth/google` emite JWT ou desafio 2FA conforme configuração do usuário.

### Tests for User Story 3
- [X] T015 [P] [US3] Criar suite de testes de integração para login social e consulta de perfil em `tests/integration/google-login.test.ts`

### Implementation for User Story 3
- [X] T016 [US3] Atualizar `UserService.getProfile` em `src/services/user.service.ts` para retornar `googleLinked`, `googleEmail`, `googleLinkedAt` e status dinâmico de `twoFactorEnabled`
- [X] T017 [US3] Implementar método `AuthService.loginWithGoogle` em `src/services/auth.service.ts` com criação de sessão e interceptação de 2FA
- [X] T018 [US3] Registrar rota pública `POST /api/auth/google` em `src/routes/auth.routes.ts`
- [X] T019 [US3] Executar e validar aprovação dos testes de login social e perfil com `npm test -- tests/integration/google-login.test.ts`

**Checkpoint**: Todas as User Stories implementadas e testadas com sucesso

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação holística de regressão, checagem estrita de tipos e atualização da documentação

- [X] T020 [P] Atualizar `ROADMAP.md` refletindo o status da Feature 013 como concluída
- [X] T021 Executar suíte completa de testes com `npm test` garantindo regressão zero em todas as features
- [X] T022 Executar checagem estrita de tipos com `npm run typecheck` garantindo conformidade total ao compilador TypeScript

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Sem dependências — execução imediata.
- **Foundational (Phase 2)**: Depende da Phase 1 — BLOQUEIA as histórias de usuário.
- **User Stories (Phases 3 a 5)**: Dependem da Phase 2; executadas na ordem de prioridade P1 → P2 → P3.
- **Polish (Phase 6)**: Depende da conclusão de todas as fases anteriores.

### Within Each User Story
- Testes de integração escritos primeiro.
- Métodos de serviço implementados e integrados às rotas Fastify.
- Validação executada e confirmada antes de avançar à próxima história.
