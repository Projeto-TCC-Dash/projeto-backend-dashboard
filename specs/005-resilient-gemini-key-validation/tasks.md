# Implementation Tasks: Validação Resiliente e Semântica de Erros da Chave Gemini (BYOK)

**Feature**: `005-resilient-gemini-key-validation`  
**Date**: 2026-10-13  
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Este documento define o plano de tarefas ordenadas por dependência para implementar a classificação semântica de erros do Google Gemini, política de retentativa para falhas transitórias e aceite inteligente de chaves sob alta demanda upstream (503/429) no endpoint `PUT /api/user/ai-key`.

---

## Phase 1: Foundational (Error Parser & Retry Utilities)

**Purpose**: Infraestrutura básica e utilitários de tratamento de erro que sustentam todas as histórias de usuário

- [x] T001 Implement `GeminiErrorParser` and `withGeminiRetry` in `src/utils/gemini-errors.ts`
- [x] T002 [P] Create unit tests for error categorization and retry logic in `tests/unit/gemini-errors.test.ts`

**Checkpoint**: Utilitários de classificação e retry prontos e testados isoladamente.

---

## Phase 2: User Story 1 - Validação Resiliente e Aceite de Chaves sob Alta Demanda (Priority: P1) 🎯 MVP

**Goal**: Permitir que usuários autenticados cadastrem sua chave Gemini em `PUT /api/user/ai-key` mesmo quando o Google AI Studio estiver com pico de demanda (503 UNAVAILABLE ou 429), reconhecendo que a chave passou no gateway do Google, salvando-a criptografada com AES-256-GCM e rejeitando com 400 apenas quando a credencial for comprovadamente inválida/revogada.

**Independent Test**: Executar requisições em `PUT /api/user/ai-key` simulando retorno 200 OK (salva com status verificado), retorno 503 (salva com aviso de alta demanda) e retorno 400 (rejeição com erro de chave inválida).

- [x] T003 [US1] Update `GeminiService.validateApiKey` in `src/services/gemini.service.ts` to use `GeminiErrorParser` and `withGeminiRetry`, returning `KeyValidationResult` on 200/503/429 and throwing only on `AUTH_ERROR`
- [x] T004 [US1] Update `src/schemas/auth.schemas.ts` and `PUT /api/user/ai-key` handler in `src/routes/auth.routes.ts` to accept provisional keys under 503/429 and return 200 OK with informative message
- [x] T005 [US1] Add integration test cases for 200 OK, 503 UNAVAILABLE, and 400 Bad Request key registration in `tests/integration/auth.routes.test.ts`

**Checkpoint**: User Story 1 (MVP) completamente funcional e independente. Chaves válidas nunca mais são rejeitadas por picos de 503 do Google.

---

## Phase 3: User Story 2 - Padronização Semântica de Erros em Toda a API (Priority: P2)

**Goal**: Garantir que as rotas de IA (categorização, chat e análise financeira) emitam códigos HTTP semânticos (503 para indisponibilidade/alta demanda, 429 para cota) com mensagens claras, sem acusar falsamente a chave do usuário nem retornar 500 genérico.

**Independent Test**: Simular resposta 503 do Google durante chamadas a `/api/transactions/categorize`, `/api/chat/stream` e `/api/analysis/:month`, verificando status HTTP 503 e preservação da chave do usuário.

- [x] T006 [US2] Update `categorizeMerchants`, `generateChatResponseStream`, and `generateMonthlyAnalysis` in `src/services/gemini.service.ts` with retry and semantic error propagation
- [x] T007 [US2] Adjust error forwarding in `src/routes/transactions.routes.ts`, `src/routes/chat.routes.ts`, `src/routes/analysis.routes.ts`, and `src/plugins/error-handler.plugin.ts`
- [x] T008 [US2] Create integration tests in `tests/integration/ai-error-handling.routes.test.ts` verifying semantic 503 and 429 HTTP status responses

**Checkpoint**: Toda a API pública responde com semântica HTTP precisa e transparente.

---

## Phase 4: Polish & Build Validation

**Purpose**: Verificação de tipos estritos, compilação de produção e execução da suíte de testes completa.

- [x] T009 [P] Validate TypeScript compilation with `tsc --noEmit` and `npm run build`
- [x] T010 [P] Run full test suite with `npx vitest run` to verify 100% passing tests

---

## Dependencies & Execution Order

```text
Phase 1: Foundational (T001, T002)
    │
    ▼
Phase 2: User Story 1 (P1 - MVP: Resilient Key Validation) (T003 - T005)
    │
    ▼
Phase 3: User Story 2 (P2: Semantic Error Propagation) (T006 - T008)
    │
    ▼
Phase 4: Polish & Build Validation (T009, T010)
```

---

## Implementation Strategy

1. **MVP First (User Story 1)**: Concluir as Fases 1 e 2 para resolver imediatamente o bloqueio do usuário relatado nas imagens (erro 503 sendo tratado como 400 no cadastro da chave).
2. **Incremental Delivery**: Expandir a padronização semântica para as demais rotas na Fase 3.
3. **Validação Estrita**: Garantir compilação com `strict: true` e 100% dos testes da suíte passando.
