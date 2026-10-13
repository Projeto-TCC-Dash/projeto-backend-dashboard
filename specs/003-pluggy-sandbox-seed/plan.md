# Implementation Plan: Reestruturação da Pluggy para Motor Interno de Seed

**Branch**: `003-pluggy-sandbox-seed` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-pluggy-sandbox-seed/spec.md`

## Summary

Refatoração da arquitetura de integração da Pluggy para operar estritamente como motor de amostragem de dados e seed interno. Remoção da rota pública `POST /api/integrations/pluggy/sync` e seus schemas da API Fastify, mantendo o produto do usuário final focado exclusivamente na ingestão de extratos bancários manuais (OFX e CSV). Evolução do `PluggyService` e do script de seed (`scripts/seed.ts` via `npm run seed`) para criar dinamicamente uma conexão na sandbox da Pluggy (`connectorId: 2`), realizar polling de sincronização, baixar todas as contas e transações simuladas e persistir no MongoDB de forma idempotente e sanitizada. Atualização do `README.md` e suíte de testes.

## Technical Context

**Language/Version**: Node.js 20 LTS, TypeScript 5.5 (`strict: true`)

**Primary Dependencies**: Fastify, Zod, Mongoose, `@google/genai`, `fastify-type-provider-zod`

**Storage**: MongoDB 7.0 (Coleção `transactions` com índice composto único `{ userId: 1, externalId: 1 }`)

**Testing**: Vitest para testes unitários e testes de integração

**Target Platform**: Linux / Docker Compose

**Performance Goals**:
- Criação e sincronização do item de sandbox na Pluggy: < 20 segundos
- Resposta para chamadas públicas antigas da Pluggy: 404 imediato

**Constraints**:
- Ausência de rotas públicas da Pluggy expostas na API
- Manter 100% de conformidade com os 7 princípios da Constituição v1.0.0

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Justificativa |
|---|:---:|---|
| **I. Escopo Estrito de Backend** | ✅ PASS | TypeScript estrito mantido, sem frontend, sem uso de `any`. |
| **II. Stack Tecnológica Sem Dependências Relacionais** | ✅ PASS | Persistência exclusiva no MongoDB NoSQL via Mongoose; sem Redis ou bancos SQL. |
| **III. Arquitetura BYOK & Custo Zero** | ✅ PASS | As transações populadas pela Pluggy alimentam o dashboard sem impactar os requisitos de BYOK da IA. |
| **IV. Minimização Extrema de Tokens** | ✅ PASS | As transações importadas da Pluggy são sanitizadas antes de qualquer persistência ou consulta. |
| **V. Ingestão Dupla** | ✅ PASS | A ingestão de usuário final foca em OFX/CSV; a Pluggy opera como motor canônico de simulação e seed de Open Finance. |
| **VI. Containerização Integral** | ✅ PASS | A aplicação e o MongoDB rodam 100% via Docker Compose. |
| **VII. Autenticação Stateless e LGPD** | ✅ PASS | Todas as transações populadas são sanitizadas via `SanitizerService`, expurgando PII. |

## Project Structure

### Documentation (this feature)

```text
specs/003-pluggy-sandbox-seed/
├── plan.md              # Este plano de implementação
├── research.md          # Decisões arquiteturais do conector de sandbox e remoção da rota
├── data-model.md        # Modelos internos de comunicação e esquema MongoDB
├── quickstart.md        # Guia de validação do seed e da remoção da rota
├── checklists/
│   └── requirements.md  # Checklist de qualidade da especificação
└── tasks.md             # Tarefas de implementação (geradas no /speckit-tasks)
```

### Source Code Touchpoints

```text
src/
├── app.ts                      # Remoção do registro de pluggyRoutes
├── routes/
│   └── pluggy.routes.ts        # [EXCLUSÃO] Rota pública removida
├── schemas/
│   └── pluggy.schemas.ts       # [EXCLUSÃO] Schemas públicos de rota removidos
├── services/
│   └── pluggy.service.ts       # Refatoração: método autônomo createAndSyncSandboxItem
scripts/
└── seed.ts                     # Atualização: chamada dinâmica ao PluggyService
tests/
└── integration/
    ├── pluggy.routes.test.ts   # [EXCLUSÃO ou atualização para 404]
    └── seed.test.ts            # Atualização para validar novo fluxo dinâmico
README.md                       # Atualização removendo endpoint público e detalhando o seed
```

## Complexity Tracking

> Nenhuma complexidade não gerenciada. A remoção da rota pública diminui a superfície de ataque da API e simplifica a arquitetura, enquanto a criação dinâmica de conexões na sandbox da Pluggy automatiza o provisionamento de testes sem intervenção manual.
