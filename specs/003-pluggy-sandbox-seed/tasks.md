# Implementation Tasks: Reestruturação da Pluggy para Motor Interno de Seed

**Feature**: `003-pluggy-sandbox-seed`  
**Date**: 2026-10-13  
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Este documento define o plano de tarefas executáveis e ordenadas por dependência para reestruturar a Pluggy como motor interno de amostragem de dados e seed, removendo a rota pública da API e atualizando a documentação.

---

## Phase 1: User Story 1 - População Automatizada com Massa de Dados da Sandbox da Pluggy (Priority: P1) 🎯 MVP

**Goal**: Permitir que o script de seed crie dinamicamente conexões na sandbox da Pluggy (`connectorId: 2` com credenciais de teste) e baixe todas as transações bancárias simuladas para popular o banco de desenvolvimento/testes, mantendo fallback de fixtures se offline.

**Independent Test**: Executar `npm run seed`; verificar que o sistema se conecta à Pluggy Sandbox, cria a conexão, aguarda status `UPDATED`, baixa e persiste transações autênticas da sandbox no MongoDB.

- [x] T001 [US1] Implement dynamic sandbox connection and polling method `createAndSyncSandboxItem` in `src/services/pluggy.service.ts`
- [x] T002 [US1] Update `scripts/seed.ts` to call `PluggyService.createAndSyncSandboxItem` with dynamic provisioning and resilient fixture fallback
- [x] T003 [US1] Update seed integration tests in `tests/integration/seed.test.ts` to validate the dynamic sandbox provisioning logic

**Checkpoint**: User Story 1 (MVP) completamente funcional — o seed agora popula o banco dinamicamente via API da Pluggy.

---

## Phase 2: User Story 2 - Foco Estrito da API Pública em Ingestão de Extratos (Priority: P2)

**Goal**: Remover a rota pública `POST /api/integrations/pluggy/sync` e seus esquemas, garantindo que a API pública atenda exclusivamente a arquivos de extrato (OFX e CSV) e responda 404 para rotas antigas da Pluggy.

**Independent Test**: Inspecionar Swagger UI (`/docs`) e verificar que a rota pública da Pluggy não existe mais; disparar chamada HTTP para `POST /api/integrations/pluggy/sync` e receber 404 Not Found.

- [x] T004 [US2] Remove public route file `src/routes/pluggy.routes.ts` and public schema file `src/schemas/pluggy.schemas.ts`
- [x] T005 [US2] Unregister `pluggyRoutes` in `src/app.ts`
- [x] T006 [US2] Update route integration tests in `tests/integration/pluggy.routes.test.ts` (verifying 404) and `tests/integration/swagger.test.ts` (ensuring 0 pluggy endpoints in OpenAPI spec)

**Checkpoint**: User Story 2 concluída — a superfície pública da API está limpa e focada em OFX/CSV.

---

## Phase 3: User Story 3 - Documentação Arquitetural e Operacional Atualizada (Priority: P3)

**Goal**: Atualizar o `README.md` refletindo a Pluggy como motor interno de geração de dados sintéticos para testes e removendo-a da tabela de endpoints públicos de usuários finais.

**Independent Test**: Revisão visual do `README.md` confirmando a tabela de endpoints atualizada e os diagramas coerentes com a nova divisão de responsabilidades.

- [x] T007 [US3] Update `README.md` architectural diagrams, module descriptions, and API reference table to position Pluggy strictly as seed test engine

---

## Phase 4: Polish & Build Validation

**Purpose**: Verificação de tipos estritos, compilação de produção e execução da suíte de testes completa.

- [x] T008 [P] Validate TypeScript compilation with `tsc --noEmit` and `npm run build`
- [x] T009 [P] Run full test suite with `npx vitest run` to verify 100% passing tests

---

## Dependencies & Execution Order

```text
Phase 1: US1 (P1 - MVP: Dynamic Sandbox Seed Engine) (T001 - T003)
    │
    ▼
Phase 2: US2 (P2 - Remove Public Pluggy Route) (T004 - T006)
    │
    ▼
Phase 3: US3 (P3 - Update Documentation & README) (T007)
    │
    ▼
Phase 4: Polish & Validation (T008, T009)
```
