# Implementation Plan: Categorias Canônicas, Edição Manual de Transações e Configuração de Seed

**Branch**: `006-transaction-categories-editing` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-transaction-categories-editing/spec.md`

## Summary

Esta funcionalidade expande a taxonomia canônica de transações para incluir `"Receita"` e `"Não Categorizado"`, define `"Não Categorizado"` como categoria padrão inicial de lançamentos originados de extratos bancários (.ofx e .csv), disponibiliza o endpoint protegido `PATCH /api/transactions/:id` para edição manual de transações com estrito isolamento multi-tenant, ajusta o pipeline de categorização inteligente da IA para priorizar lançamentos pendentes, e documenta a variável `GOOGLE_GENERATIVE_AI_API_KEY` no `.env.example` para suporte ao seed sintético local.

## Technical Context

**Language/Version**: Node.js >= 20.x, TypeScript 5.x em modo estrito (`strict: true`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`).

**Primary Dependencies**: Fastify 5.x, fastify-type-provider-zod, Zod 3.x, Mongoose 8.x, @google/genai, @fastify/multipart, @fastify/jwt.

**Storage**: MongoDB nativo via Mongoose ODM (coleção `transactions`).

**Testing**: Vitest / Node Test Runner para testes unitários e de integração de rotas e serviços.

**Target Platform**: Linux / macOS containerizado via Docker Compose.

**Project Type**: Web Service (Backend REST API Fastify em Node.js / TypeScript).

**Performance Goals**: Processamento e resposta de atualização manual de transação (`PATCH /api/transactions/:id`) em menos de 50ms (p95); latência total sob 500ms.

**Constraints**:
- Zero `any` (conformidade com Princípio I).
- Validação estrita de contratos de entrada e saída em runtime via Zod (Princípio II).
- Isolamento multi-tenant rigoroso por `userId` em todas as queries e mutações (Princípio VII).
- Custo zero de IA no servidor e criptografia AES-256-GCM para BYOK (Princípio III).
- Autonomia 100% local do script de seed sem dependência de rede (Princípio V).

**Scale/Scope**: Catálogo canônico estendido de 7 para 9 categorias; novo endpoint `PATCH /api/transactions/:id`; persistência e indexação otimizada para até dezenas de milhares de transações por usuário.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio Constitucional | Status | Justificativa / Verificação |
|---|---|---|
| **I. Escopo Estrito de Backend (TypeScript Strict)** | PASS | Código 100% backend em TypeScript estrito, zero frontend, zero `any`, Zod type-provider para inferência estática. |
| **II. Stack Tecnológica Sem Relacionais (Fastify, Zod & Mongoose)** | PASS | Rota implementada em Fastify com esquemas Zod e persistência via Mongoose. Sem dependências relacionais. |
| **III. Arquitetura BYOK & Custo Zero de IA (AES-256-GCM)** | PASS | Mantido modelo BYOK; chave no seed documentada como opcional local; persistência cifrada permanece inalterada. |
| **IV. Minimização de Tokens & Processamento Local Pré-LLM** | PASS | Categorização por IA passa a filtrar exclusivamente transações com `category: "Não Categorizado"`, evitando reprocessar transações editadas pelo usuário. |
| **V. Ingestão de Extratos & Seed Autônomo Local** | PASS | Extratos continuam utilizando parsers locais (.ofx/.csv); seed sintético opera 100% autônomo localmente mesmo sem chave de IA. |
| **VI. Containerização Integral e Resiliência** | PASS | Nenhuma dependência externa adicional adicionada; compatibilidade total com Docker Compose. |
| **VII. Autenticação Stateless & LGPD (JWT & Privacy-by-Design)** | PASS | Rota `PATCH` protegida por JWT (`requireAuth`); filtro obrigatório por `userId`; descarte de PII preservado. |

## Project Structure

### Documentation (this feature)

```text
specs/006-transaction-categories-editing/
├── plan.md              # Este plano de implementação (/speckit-plan)
├── research.md          # Decisões técnicas e arquiteturais (Phase 0)
├── data-model.md        # Modelo de dados e regras de transição (Phase 1)
├── quickstart.md        # Guia de validação ponta a ponta (Phase 1)
├── contracts/           # Contratos OpenAPI / JSON Schema da rota PATCH
│   └── transactions-patch.json
└── checklists/
    └── requirements.md  # Checklist de qualidade validado
```

### Source Code (repository root)

```text
.env.example                     # Documentação da variável GOOGLE_GENERATIVE_AI_API_KEY para seed
src/
├── config/
│   └── constants.ts             # CANONICAL_CATEGORIES (inclui 'Receita', 'Não Categorizado'), DEFAULT_CATEGORY
├── models/
│   └── transaction.model.ts     # TransactionSchema atualizado com default 'Não Categorizado'
├── schemas/
│   └── transaction.schemas.ts   # UpdateTransactionBodySchema, TransactionIdParamSchema
├── routes/
│   └── transactions.routes.ts   # PATCH /api/transactions/:id com validação Zod e auth
└── services/
    ├── transaction.service.ts   # updateTransaction(), getUniqueUncategorizedMerchants() ajustado
    └── gemini.service.ts        # Atualização do prompt de categorização com novas categorias canônicas
tests/
└── transactions.test.ts         # Testes de importação ('Não Categorizado'), PATCH, 404 e validação de categorias
```

**Structure Decision**: Monolito modular em camada única de backend (`src/`), mantendo a separação limpa entre rotas Fastify, esquemas Zod, serviços de domínio e modelos Mongoose.

## Complexity Tracking

> Nenhuma violação constitucional detectada. Sem exceções requeridas.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
