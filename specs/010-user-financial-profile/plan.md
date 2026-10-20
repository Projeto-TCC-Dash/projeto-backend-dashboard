# Implementation Plan: Perfil Financeiro, Regime de Renda e Metas do Usuário

**Branch**: `feature/010-user-financial-profile` | **Date**: 2026-10-19 | **Spec**: [specs/010-user-financial-profile/spec.md](spec.md)

**Input**: Feature specification from `specs/010-user-financial-profile/spec.md`

## Summary

Esta feature adiciona o suporte nativo ao perfil financeiro voluntário do usuário, modelado como subdocumento `financialProfile` no modelo `User` do MongoDB, com enums estritos para regime de renda (`incomeType`), metas financeiras (`goals`) e tolerância a risco (`riskProfile`). Expõe endpoints REST autenticados `GET /api/user/profile` e `PUT /api/user/profile` com invalidação automática de cache de análises financeiras. Além disso, injeta o perfil financeiro do usuário nos prompts de diagnóstico (`AnalysisService` / `GeminiService`) para calibrar as faixas de reserva de emergência (3-6 meses para CLT vs. 6-12 meses para PJ/autônomo) e nas instruções da persona do chatbot (`ChatService`).

## Technical Context

**Language/Version**: TypeScript 5.x (Strict mode) / Node.js >= 20.x

**Primary Dependencies**: Fastify 5.x, Zod 3.x (`fastify-type-provider-zod`), Mongoose 8.x, `@google/genai`

**Storage**: MongoDB (Mongoose ODM, sem bancos relacionais)

**Testing**: Vitest (`npm test`), supertest / fastify.inject

**Target Platform**: Linux / macOS containerizado via Docker Compose

**Project Type**: REST API Web Service (Backend headless)

**Performance Goals**: Tempo de resposta de atualização/consulta do perfil < 300ms p95; zero impacto em usuários sem perfil preenchido.

**Constraints**: Autenticação stateless JWT (`requireAuth`), preenchimento 100% facultativo (LGPD), sem dados relacionais, tipagem estrita sem `any`.

**Scale/Scope**: Módulos de usuário, autenticação e serviços de IA (`src/config/constants.ts`, `src/models/user.model.ts`, `src/schemas/user.schemas.ts`, `src/services/user.service.ts`, `src/routes/user.routes.ts`, `src/services/analysis.service.ts`, `src/services/gemini.service.ts`, `src/services/chat.service.ts`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Escopo Estrito de Backend (TypeScript & Node.js Strict)**: Tipagem estrita com Zod e Mongoose, sem `any`.
- [x] **Principle II: Stack Tecnológica Sem Dependências Relacionais**: Utilização exclusiva de Fastify, Zod e MongoDB/Mongoose.
- [x] **Principle III: Arquitetura BYOK & Custo Zero de IA**: Prompts ajustados com contexto do usuário preservando modelo BYOK.
- [x] **Principle IV: Minimização Extrema de Tokens**: Dados contextuais mínimos injetados na LLM com Structured Outputs.
- [x] **Principle V: Ingestão de Extratos e Provedor Local de Seed**: Não afeta parsers; compatível com usuários do seed.
- [x] **Principle VI: Containerização Integral**: Compatível com Docker Compose.
- [x] **Principle VII: Autenticação Stateless e LGPD**: `requireAuth` em todas as rotas; preenchimento 100% voluntário para finalidade exclusiva de PFM; nenhuma PII compartilhada ou utilizada para scoring punitivo.

## Project Structure

### Documentation (this feature)

```text
specs/010-user-financial-profile/
├── spec.md              # Especificação de requisitos da feature
├── plan.md              # Este plano de implementação
├── research.md          # Decisões técnicas e heurísticas de planejamento financeiro
├── data-model.md        # Modelagem de dados e esquemas Zod
├── quickstart.md        # Guia de validação e testes
├── contracts/
│   └── user-profile-api.md  # Contratos REST de consulta e atualização do perfil
└── checklists/
    └── requirements.md  # Checklist de qualidade da especificação
```

### Source Code (repository root)

```text
src/
├── config/
│   └── constants.ts                # Adição de INCOME_TYPES, FINANCIAL_GOALS e RISK_PROFILES
├── models/
│   └── user.model.ts               # Extensão de IUser com subdocumento financialProfile
├── schemas/
│   └── user.schemas.ts             # Schemas Zod de request e response do perfil
├── services/
│   ├── user.service.ts             # Métodos getProfile e updateFinancialProfile
│   ├── analysis.service.ts         # Passagem de financialProfile para GeminiService
│   ├── gemini.service.ts           # Calibragem de reserva de emergência e metas no prompt
│   └── chat.service.ts             # Injeção de perfil no buildSystemInstruction do chat
├── routes/
│   └── user.routes.ts              # Endpoints GET e PUT /api/user/profile
└── app.ts                          # Registro de userRoutes

tests/
├── unit/
│   ├── user-service.test.ts        # Testes unitários de UserService
│   ├── categorization.test.ts      # Testes de injeção de perfil no prompt do Gemini
│   └── transaction-service.test.ts # Teste de injeção de perfil no chat
└── integration/
    └── user-profile.routes.test.ts # Testes de integração de GET e PUT /api/user/profile
```

**Structure Decision**: Criação modular de `user.service.ts` e `user.routes.ts` com desacoplamento claro do fluxo de autenticação.

## Complexity Tracking

> Nenhuma violação das regras constitucionais identificada. Nenhuma complexidade acidental introduzida.
