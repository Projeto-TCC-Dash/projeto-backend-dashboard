# Implementation Plan: Gestão de Contas Bancárias e Cartões

**Branch**: `007-accounts-management` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-accounts-management/spec.md`

## Summary

Esta funcionalidade introduz o gerenciamento nativo de múltiplas contas financeiras e cartões (CRUD completo) no backend Fastify/MongoDB, permitindo ao usuário criar contas com nome, tipo, saldo inicial opcional, instituição e cor temática. Transações passam a ser vinculadas a uma conta (`accountId`), com agregação de saldos e contagem de lançamentos em tempo real. A importação de extratos (.ofx/.csv) suporta especificação de conta de destino com fallback transparente para uma "Conta Principal" auto-provisionada, e o endpoint `PATCH /api/transactions/:id` passa a suportar reatribuição de conta. A exclusão de contas adota política de proteção estrita (bloqueio 409 por padrão, permitindo cascata com `?cascade=true` e impedindo a exclusão da última conta do usuário). O motor de seed sintético local é atualizado para gerar contas e associar suas transações determinísticas.

## Technical Context

**Language/Version**: Node.js >= 20.x, TypeScript 5.x em modo estrito (`strict: true`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`).

**Primary Dependencies**: Fastify 5.x, fastify-type-provider-zod, Zod 3.x, Mongoose 8.x, @fastify/multipart, @fastify/jwt.

**Storage**: MongoDB nativo via Mongoose ODM (novos modelos e índices na coleção `accounts` e atualização de índices na coleção `transactions`).

**Testing**: Vitest / Node Test Runner para testes unitários e de integração de rotas e serviços (`tests/accounts.test.ts`, `tests/transactions.test.ts`).

**Target Platform**: Linux / macOS containerizado via Docker Compose.

**Project Type**: Web Service (Backend REST API Fastify em Node.js / TypeScript).

**Performance Goals**: Agregação de contas e saldos (`GET /api/accounts`) com tempo de resposta inferior a 50ms (p95); operações de criação, edição e exclusão de contas em menos de 30ms.

**Constraints**:
- Zero `any` (conformidade com Princípio I).
- Validação estrita de contratos de entrada e saída em runtime via Zod (Princípio II).
- Isolamento multi-tenant rigoroso por `userId` em todas as queries e mutações (Princípio VII).
- Custo zero de IA no servidor e criptografia AES-256-GCM para BYOK mantidos (Princípio III).
- Autonomia 100% local do script de seed sintético com suporte a contas (Princípio V).
- Descarte sumário de identificadores reais de agência/conta do OFX; persistência crua de PII terminantemente proibida (Princípio VII).

**Scale/Scope**: Nova coleção `accounts` com índice composto único `{ userId: 1, name: 1 }`; novo conjunto de endpoints REST `/api/accounts`; atualização da rota `/api/transactions/upload` e `/api/transactions/:id`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio Constitucional | Status | Justificativa / Verificação |
|---|---|---|
| **I. Escopo Estrito de Backend (TypeScript Strict)** | PASS | Código 100% backend em TypeScript estrito, zero frontend, zero `any`, Zod type-provider para inferência estática de tipos. |
| **II. Stack Tecnológica Sem Relacionais (Fastify, Zod & Mongoose)** | PASS | Rotas implementadas em Fastify com esquemas Zod e persistência via Mongoose. Sem dependências relacionais. |
| **III. Arquitetura BYOK & Custo Zero de IA (AES-256-GCM)** | PASS | Nenhuma alteração no mecanismo de IA; BYOK e criptografia AES-256-GCM mantidos intactos. |
| **IV. Minimização de Tokens & Processamento Local Pré-LLM** | PASS | Resumo de saldo e agregações de contas são processados 100% localmente no MongoDB antes de qualquer interação externa. |
| **V. Ingestão de Extratos & Seed Autônomo Local** | PASS | Esquema Canônico e motor de Seed atualizados para suportar a entidade `Account` (`accountId`), com geração de contas sintéticas locais e parsing desacoplado de OFX/CSV. |
| **VI. Containerização Integral e Resiliência** | PASS | Total compatibilidade com Docker Compose; sem dependências binárias adicionais. |
| **VII. Autenticação Stateless & LGPD (JWT & Privacy-by-Design)** | PASS | Todas as rotas de contas são protegidas por JWT (`requireAuth`); filtro obrigatório por `userId`; proibição estrita de persistir números reais de conta/agência no MongoDB. |

## Project Structure

### Documentation (this feature)

```text
specs/007-accounts-management/
├── plan.md              # Este plano de implementação (/speckit-plan)
├── research.md          # Decisões técnicas e arquiteturais (Phase 0)
├── data-model.md        # Modelo de dados, schemas Zod e ERD (Phase 1)
├── quickstart.md        # Guia de validação ponta a ponta (Phase 1)
├── contracts/           # Contratos OpenAPI / JSON Schema da API (Phase 1)
│   ├── accounts.contract.json
│   ├── transactions-patch.contract.json
│   └── upload-account.contract.json
└── checklists/
    └── requirements.md  # Checklist de qualidade validado
```

### Source Code (repository root)

```text
src/
├── config/
│   └── constants.ts             # ACCOUNT_TYPES, AccountTypeEnum, DEFAULT_ACCOUNT_NAME
├── models/
│   ├── account.model.ts         # Novo modelo Mongoose IAccount e AccountModel com índices
│   └── transaction.model.ts     # ITransaction atualizado com accountId e índice composto { userId: 1, accountId: 1 }
├── schemas/
│   ├── account.schemas.ts       # CreateAccountBody, UpdateAccountBody, AccountResponseItem, ListAccountsResponse
│   └── transaction.schemas.ts   # UpdateTransactionBodySchema atualizado com accountId opcional
├── routes/
│   ├── accounts.routes.ts       # Rotas GET, POST, PATCH, DELETE /api/accounts
│   └── transactions.routes.ts   # Upload aceitando accountId e PATCH aceitando accountId
├── services/
│   ├── account.service.ts       # CRUD de contas, getOrCreateDefaultAccount, cálculo de saldos agregados
│   └── transaction.service.ts   # Ingestão associando accountId e updateTransaction com troca de conta
└── scripts/
    └── seed.ts                  # Atualização do seed para criar contas padrão e associar transações
tests/
├── accounts.test.ts             # Testes de integração do CRUD de contas, unicidade 409, bloqueio 409 e cascata
└── transactions.test.ts         # Testes de upload com accountId e PATCH de troca de conta
```

**Structure Decision**: Monolito modular em camada única de backend (`src/`), mantendo estrita separação entre rotas Fastify tipadas via Zod, camada de serviço de domínio (`AccountService`, `TransactionService`) e persistência Mongoose.

## Complexity Tracking

> Nenhuma violação constitucional detectada. Todas as soluções respeitam a Constituição v2.1.0 e as boas práticas do projeto.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| N/A | N/A | N/A |
