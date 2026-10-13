# Implementation Tasks: API REST do Backend Financeiro

**Feature**: `001-financial-backend-api`  
**Date**: 2026-10-13  
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Este documento define o plano de tarefas ordenadas por dependência para implementação da API REST de inteligência financeira pessoal, cobrindo os 5 módulos com suporte a execução independente e incremental.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialização do repositório, dependências, configurações estritas do compilador e orquestração Docker.

- [X] T001 Initialize Node.js 20+ project with dependencies (`fastify`, `@fastify/jwt`, `@fastify/multipart`, `@fastify/cors`, `@fastify/swagger`, `@fastify/swagger-ui`, `fastify-type-provider-zod`, `zod`, `mongoose`, `@google/genai`, `node-ofx-parser`, `csv-parse`, `iconv-lite`, `bcryptjs`) and devDependencies (`typescript`, `@types/node`, `@types/bcryptjs`, `tsx`, `vitest`, `supertest`) in `package.json`
- [X] T002 [P] Configure strict TypeScript compiler with `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `noImplicitReturns: true`, and `noUncheckedIndexedAccess: true` in `tsconfig.json`
- [X] T003 [P] Create multi-stage build `Dockerfile` with non-root user `node` and `docker-compose.yml` with MongoDB 7.0 healthcheck and conditional dependency in `Dockerfile` and `docker-compose.yml`
- [X] T004 [P] Configure environment schema validation using Zod for `PORT`, `HOST`, `MONGODB_URI`, `JWT_SECRET`, and `ENCRYPTION_KEY` (32 bytes) in `src/config/env.ts` and template in `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura básica que DEVE estar completa antes da implementação de qualquer história de usuário.

**⚠️ CRITICAL**: Nenhuma história de usuário pode ser iniciada antes da conclusão desta fase.

- [X] T005 Configure Mongoose connection management and lifecycle events for MongoDB in `src/config/database.ts`
- [X] T006 [P] Define system constants and canonical categories enum (`Alimentação`, `Transporte`, `Moradia`, `Saúde`, `Lazer`, `Educação`, `Outros`) in `src/config/constants.ts`
- [X] T007 [P] Implement native Node.js crypto service for `AES-256-GCM` encryption and decryption with 96-bit random IV and 128-bit authentication tag in `src/services/crypto.service.ts`
- [X] T008 [P] Configure Fastify instance, Swagger/OpenAPI plugins, CORS, and multipart file upload handling with `fastify-type-provider-zod` in `src/app.ts`
- [X] T009 [P] Implement healthcheck route `GET /health` verifying operational readiness and active MongoDB connection in `src/routes/health.routes.ts`
- [X] T010 Create server entry point with graceful shutdown on `SIGINT`/`SIGTERM` in `src/server.ts`

**Checkpoint**: Base fundamental pronta - implementação das histórias de usuário pode começar.

---

## Phase 3: User Story 1 - Autenticação de Usuário e Configuração BYOK de Chave de IA (Priority: P1) 🎯 MVP

**Goal**: Permitir registro e login de usuários via JWT, cadastro da API Key do Google AI Studio com teste de conectividade ativo no Gemini, armazenamento seguro via AES-256-GCM e bloqueio `HTTP 403` em rotas analíticas sem chave.

**Independent Test**: Registrar usuário, efetuar login para obter o JWT, confirmar que rota analítica responde `403 Forbidden` sem chave, cadastrar chave válida com ping ativo no Gemini e verificar persistência criptografada.

- [X] T011 [P] [US1] Define Zod schemas and DTOs for `RegisterRequest`, `AuthResponse`, `SetApiKeyRequest`, and `SetApiKeyResponse` in `src/schemas/auth.schemas.ts`
- [X] T012 [P] [US1] Create `User` Mongoose model with `email` (unique index), `passwordHash`, `encryptedApiKey`, `iv` (24 hex), `authTag` (32 hex), and timestamps in `src/models/user.model.ts`
- [X] T013 [US1] Implement `@fastify/jwt` authentication plugin with JWT signing and `requireAuth` preHandler decorator in `src/plugins/auth.plugin.ts`
- [X] T014 [US1] Implement `requireAiKey` guard preHandler checking `user.encryptedApiKey !== null` and returning `HTTP 403 Forbidden` if missing in `src/plugins/auth.plugin.ts`
- [X] T015 [US1] Implement Gemini client initialization and active ping validation using `@google/genai` in `src/services/gemini.service.ts`
- [X] T016 [US1] Implement `AuthService` handling registration, password hashing with bcrypt, JWT token generation, and BYOK key encryption/storage in `src/services/auth.service.ts`
- [X] T017 [US1] Implement auth routes `POST /api/auth/register`, `POST /api/auth/login`, and `PUT /api/user/ai-key` in `src/routes/auth.routes.ts`
- [X] T018 [US1] Create unit tests for AES-256-GCM encryption/decryption and integration tests for auth routes and 403 guard in `tests/unit/crypto.service.test.ts` and `tests/integration/auth.routes.test.ts`

**Checkpoint**: User Story 1 (MVP) completamente funcional e testável de ponta a ponta.

---

## Phase 4: User Story 2 - Ingestão e Processamento Idempotente de Extratos OFX e CSV (Priority: P2)

**Goal**: Processar upload multipart de arquivos `.ofx` e `.csv`, extrair FITID, data, valor e descrição crua, aplicar sanitização estrita de PII (LGPD) e garantir idempotência por `(userId, externalId)`.

**Independent Test**: Fazer upload de arquivo OFX ou CSV, verificar importação no banco; re-enviar o mesmo arquivo e comprovar que transações duplicadas são ignoradas com 0% de duplicação.

- [X] T019 [P] [US2] Define Zod schemas for transaction DTOs, query filters, and upload response in `src/schemas/transaction.schemas.ts`
- [X] T020 [P] [US2] Create `Transaction` Mongoose model with `userId`, `externalId`, `rawDescription`, `cleanDescription`, `amount`, `date`, `category`, `source`, and compound unique index `{ userId: 1, externalId: 1 }` in `src/models/transaction.model.ts`
- [X] T021 [US2] Implement OFX parser with SGML tolerance and CSV parser with delimiter auto-detection and encoding handling in `src/services/parser.service.ts`
- [X] T022 [US2] Implement LGPD sanitization module removing account numbers, agency codes, CPFs, and CNPJs from raw descriptions in `src/services/sanitizer.service.ts`
- [X] T023 [US2] Implement `TransactionService` for idempotent batch persistence using `bulkWrite` with `ordered: false` and transaction query listing in `src/services/transaction.service.ts`
- [X] T024 [US2] Implement transaction routes `POST /api/transactions/upload` and `GET /api/transactions` in `src/routes/transactions.routes.ts`
- [X] T025 [US2] Create unit tests for OFX/CSV parsers, LGPD sanitization, and integration tests for upload and idempotency in `tests/unit/parser.service.test.ts` and `tests/integration/transactions.routes.test.ts`

**Checkpoint**: Histórias de Usuário 1 e 2 funcionando de forma independente e integrada.

---

## Phase 5: User Story 3 - Sincronização de Transações via Open Finance Simulado (Pluggy) (Priority: P3)

**Goal**: Sincronizar transações de contas do sandbox da Pluggy, normalizando-as para o mesmo esquema canônico das transações de extrato e persistindo com idempotência.

**Independent Test**: Disparar `POST /api/integrations/pluggy/sync` com `itemId` de teste, verificar conversão para modelo canônico e conferir que duplicidades são descartadas.

- [X] T026 [P] [US3] Define Zod schemas for Pluggy sync request (`PluggySyncRequest`) and response in `src/schemas/pluggy.schemas.ts`
- [X] T027 [US3] Implement Pluggy sandbox client to fetch accounts and transactions by item ID in `src/services/pluggy.service.ts`
- [X] T028 [US3] Implement transaction normalization adapter converting Pluggy transactions into canonical `Transaction` attributes in `src/services/pluggy.service.ts`
- [X] T029 [US3] Implement route `POST /api/integrations/pluggy/sync` invoking sync and batch persistence in `src/routes/pluggy.routes.ts`
- [X] T030 [US3] Create integration tests for Pluggy synchronization and normalization in `tests/integration/pluggy.routes.test.ts`

**Checkpoint**: Ingestão dupla completa (Extratos locais + Open Finance Pluggy).

---

## Phase 6: User Story 4 - Categorização Inteligente via IA e Otimização de Tokens (Priority: P4)

**Goal**: Agrupar e deduplicar em memória descrições de transações pendentes, solicitar categorização ao Gemini via Structured Outputs (catálogo canônico de 7 categorias) com a chave BYOK do usuário e reassociar localmente no MongoDB.

**Independent Test**: Disparar `POST /api/transactions/categorize`, verificar envio exclusivo de estabelecimentos únicos ao Gemini e comprovar atualização em lote de todas as transações correspondentes no banco.

- [X] T031 [P] [US4] Define Zod schemas for categorization request, Gemini structured output JSON schema, and categorization summary response in `src/schemas/categorization.schemas.ts`
- [X] T032 [US4] Implement in-memory aggregation and unique merchant name deduplication utility in `src/services/transaction.service.ts`
- [X] T033 [US4] Implement Gemini categorization caller with strict JSON Schema output constrained to the 7 canonical categories using decrypted BYOK key in `src/services/gemini.service.ts`
- [X] T034 [US4] Implement local reassociation engine updating all corresponding transactions in bulk in MongoDB in `src/services/transaction.service.ts`
- [X] T035 [US4] Implement route `POST /api/transactions/categorize` protected by `requireAuth` and `requireAiKey` in `src/routes/transactions.routes.ts`
- [X] T036 [US4] Create unit tests for in-memory deduplication/reassociation and integration tests for categorization route in `tests/unit/categorization.test.ts` and `tests/integration/categorization.routes.test.ts`

**Checkpoint**: Pipeline de enriquecimento e categorização inteligente por IA 100% operacional.

---

## Phase 7: User Story 5 - Consultoria Financeira com Streaming SSE (Priority: P5)

**Goal**: Disponibilizar endpoint `POST /api/chat/stream` com Server-Sent Events (SSE), injetando automaticamente resumo financeiro mensal (entradas, saídas, totais por categoria), histórico da sessão e prompt de persona consultora.

**Independent Test**: Enviar mensagem para `POST /api/chat/stream`, receber fluxo contínuo de tokens via SSE e confirmar que a resposta reflete métricas consolidadas dos gastos do mês.

- [X] T037 [P] [US5] Define Zod schemas for chat request (`ChatMessageRequest`) and SSE event payloads in `src/schemas/chat.schemas.ts`
- [X] T038 [P] [US5] Create `ChatSession` Mongoose model with `userId`, `messages: [{ role, content, timestamp }]`, and timestamps in `src/models/chat-session.model.ts`
- [X] T039 [US5] Implement monthly financial summary aggregator in MongoDB (inflows, outflows, category totals) in `src/services/transaction.service.ts`
- [X] T040 [US5] Implement advisor persona prompt builder combining system instructions, monthly financial summary, and conversation history in `src/services/gemini.service.ts`
- [X] T041 [US5] Implement streaming chat handler in Fastify using Server-Sent Events (SSE) with client abort listener in `src/routes/chat.routes.ts`
- [X] T042 [US5] Implement chat session persistence updating message history in `src/services/chat.service.ts`
- [X] T043 [US5] Create integration tests for chat streaming route and prompt context injection in `tests/integration/chat.routes.test.ts`

**Checkpoint**: Todos os 5 módulos de domínio completamente implementados e testáveis.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Tratamento global de erros, documentação Swagger, validação estrita de build e execução de cenários ponta a ponta.

- [X] T044 [P] Implement global error handler in Fastify for Zod validation errors, duplicate key violations (E11000), and unhandled exceptions in `src/plugins/error-handler.plugin.ts`
- [X] T045 [P] Create OpenAPI Swagger documentation integration tests validating schema compliance against `contracts/openapi.yaml` in `tests/integration/swagger.test.ts`
- [X] T046 [P] Validate TypeScript compilation and build without errors via `tsc --noEmit` and `npm run build`
- [X] T047 Execute end-to-end validation scenarios documented in `specs/001-financial-backend-api/quickstart.md` using Docker Compose

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1: Setup
    │
    ▼
Phase 2: Foundational (BLOCKS all User Stories)
    │
    ├──────────────────┬──────────────────┬──────────────────┬──────────────────┐
    ▼                  ▼                  ▼                  ▼                  ▼
Phase 3: US1 (P1)   Phase 4: US2 (P2)  Phase 5: US3 (P3)  Phase 6: US4 (P4)  Phase 7: US5 (P5)
   [Auth & BYOK]     [OFX/CSV Ingest]   [Open Finance]     [AI Categorize]     [Chatbot SSE]
    │                  │                  │                  │                  │
    └──────────────────┴──────────────────┴──────────────────┴──────────────────┘
                                           │
                                           ▼
                            Phase 8: Polish & Validation
```

### User Story Dependencies

- **User Story 1 (P1 - MVP)**: Pode iniciar imediatamente após a Fase 2 (Foundational). Fornece a infraestrutura de tokens JWT e verificação da chave BYOK para todas as rotas protegidas.
- **User Story 2 (P2)**: Pode iniciar após a Fase 2. Utiliza o `userId` autenticado para persistência idempotente das transações.
- **User Story 3 (P3)**: Depende da estrutura canônica de transações (US2) para converter dados do sandbox da Pluggy.
- **User Story 4 (P4)**: Depende das transações no banco (US2/US3) e da chave BYOK do usuário (US1) para categorizar estabelecimentos.
- **User Story 5 (P5)**: Depende das transações categorizadas (US4) para cálculo dos agregados mensais e da chave BYOK (US1) para gerar respostas do consultor.

---

## Parallel Execution Opportunities

- **Setup (Fase 1)**: T002, T003 e T004 podem ser executadas em paralelo após T001.
- **Foundational (Fase 2)**: T006, T007, T008 e T009 podem ser desenvolvidas em paralelo.
- **User Story 1 (Fase 3)**: T011 (schemas) e T012 (model) podem ser criadas em paralelo.
- **User Story 2 (Fase 4)**: T019 (schemas) e T020 (model) podem ser criadas em paralelo.
- **User Story 3 (Fase 5)**: T026 (schemas) pode ser criada em paralelo a adaptadores.
- **User Story 4 (Fase 6)**: T031 (schemas) pode ser criada em paralelo ao utilitário de deduplicação.
- **User Story 5 (Fase 7)**: T037 (schemas) e T038 (model) podem ser criadas em paralelo.
- **Polish (Fase 8)**: T044, T045 e T046 podem ser executadas em paralelo.

---

## Implementation Strategy

### MVP First (User Story 1 Apenas)
1. Concluir Fase 1 (Setup)
2. Concluir Fase 2 (Foundational)
3. Concluir Fase 3 (User Story 1)
4. **Validar MVP**: Cadastrar usuário, autenticar via JWT, cadastrar chave BYOK com ping ativo no Gemini e verificar bloqueio `403` quando sem chave.

### Entrega Incremental
1. **Incremento 1 (MVP)**: Autenticação + Gestão BYOK AES-256-GCM.
2. **Incremento 2**: Ingestão de Extratos OFX/CSV com descarte LGPD e Idempotência.
3. **Incremento 3**: Integração Pluggy Sandbox Open Finance.
4. **Incremento 4**: Deduplicação em memória e Categorização via Gemini.
5. **Incremento 5**: Consultoria Financeira com Streaming SSE e Resumo Mensal.
6. **Incremento 6**: Validação final de ponta a ponta e Docker Compose.
