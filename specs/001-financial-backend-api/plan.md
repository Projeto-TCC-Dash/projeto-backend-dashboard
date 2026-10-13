# Implementation Plan: API REST do Backend Financeiro

**Branch**: `001-financial-backend-api` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-financial-backend-api/spec.md`

## Summary

Implementação da API REST de inteligência financeira pessoal construída sobre Node.js 20+, Fastify, TypeScript (strict mode), Mongoose/MongoDB e Zod. A solução adota a arquitetura Bring Your Own Key (BYOK) com validação ativa e criptografia `AES-256-GCM` para consumo da API do Google Gemini via `@google/genai`, ingestão de extratos `.ofx` e `.csv` com conformidade à LGPD e idempotência estrita por `(userId, externalId)`, integração simulada com Open Finance (Pluggy), categorização inteligente com deduplicação prévia em memória e consultoria financeira interativa com streaming SSE (`POST /api/chat/stream`). O ambiente é 100% conteinerizado via Dockerfile multi-stage e Docker Compose com MongoDB 7.0 gerenciado com healthchecks.

## Technical Context

**Language/Version**: Node.js 20 LTS, TypeScript 5.x (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`)

**Primary Dependencies**: Fastify (4.x/5.x), `@fastify/jwt`, `@fastify/multipart`, `@fastify/cors`, `@fastify/swagger`, `@fastify/swagger-ui`, `fastify-type-provider-zod`, Zod 3.x, Mongoose 8.x, `@google/genai`, `node-ofx-parser`, `csv-parse`, `iconv-lite`

**Storage**: MongoDB 7.0 Community Edition gerenciado via Mongoose ODM

**Testing**: Vitest com cobertura de testes unitários (parsers, criptografia, sanitização) e integração de rotas Fastify (com MongoDB em memória / container de teste)

**Target Platform**: Linux server containerizado (Docker Compose com Alpine Linux)

**Project Type**: REST API & Web Service com Server-Sent Events (Backend estrito)

**Performance Goals**:
- Parsing local, sanitização e normalização de 500 transações em < 2s
- Emissão do primeiro token em streaming SSE do chatbot em < 1.5s
- Validação e ping da chave BYOK do Gemini em < 3s

**Constraints**:
- Chave BYOK criptografada em repouso com `AES-256-GCM` (IV de 96 bits, tag de 128 bits, chave de 256 bits)
- Bloqueio imediato (`HTTP 403 Forbidden`) em rotas analíticas/chat para usuários sem chave BYOK
- Conformidade estrita com LGPD: expurgo de agência, conta e CPF/CNPJ na camada de parsing; zero PII no MongoDB ou enviado à LLM
- Idempotência definitiva por índice composto único `{ userId: 1, externalId: 1 }`
- Redução mínima de 70% no volume de textos enviados ao Gemini via deduplicação pré-LLM em memória
- Resposta estruturada estrita no catálogo fechado de 7 categorias

**Scale/Scope**: 5 módulos de domínio, 8 rotas principais, 3 coleções no MongoDB

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio da Constituição | Status | Avaliação Técnica |
|---|:---:|---|
| **I. Escopo Estrito de Backend (TypeScript & Node.js Strict)** | ✅ PASS | Repositório exclusivamente backend; TS configurado com `strict: true`, `noImplicitAny: true`, sem dependências de frontend. |
| **II. Stack Tecnológica Sem Dependências Relacionais (Fastify, Zod & MongoDB/Mongoose)** | ✅ PASS | Fastify é o único framework HTTP; validação e serialização integradas com Zod; persistência exclusiva em MongoDB via Mongoose. Sem SQL. |
| **III. Arquitetura BYOK & Custo Zero de IA no Servidor (AES-256-GCM)** | ✅ PASS | Custos de IA sob a chave do usuário; chave criptografada em repouso com `AES-256-GCM` (IV de 12 bytes + tag de 16 bytes); descriptografia efêmera em memória. |
| **IV. Minimização Extrema de Tokens & Processamento Local Pré-LLM** | ✅ PASS | Sanitização local, descarte de ruídos, deduplicação em memória de nomes de estabelecimentos antes do envio ao Gemini; retorno reassociado localmente. |
| **V. Ingestão Dupla de Dados Financeiros (OFX/CSV Local & Sandbox Pluggy)** | ✅ PASS | Suporte a upload multipart de `.ofx` e `.csv` com encoding tolerante e sincronização de conta de teste no sandbox da Pluggy, ambos convertidos para esquema canônico. |
| **VI. Containerização Integral e Resiliência (Docker Compose & Healthcheck)** | ✅ PASS | Dockerfile multi-stage executando sob usuário `node` não-root; `docker-compose.yml` com healthcheck no MongoDB e dependência condicional `service_healthy`. Rota `/health`. |
| **VII. Autenticação Stateless e Conformidade Estrita com LGPD (JWT & Privacy-by-Design)** | ✅ PASS | Autenticação via JWT no header `Authorization: Bearer`; descarte sumário de PII e identificadores bancários no parsing; isolamento multi-tenant por `userId`. |

## Project Structure

### Documentation (this feature)

```text
specs/001-financial-backend-api/
├── plan.md              # Este arquivo de planejamento arquitetural
├── research.md          # Decisões tecnológicas da Fase 0
├── data-model.md        # Modelagem de dados, índices e entidades da Fase 1
├── quickstart.md        # Guia de execução e cenários de validação da Fase 1
├── contracts/           # Contratos de interface da Fase 1
│   └── openapi.yaml     # Especificação OpenAPI 3.0 completa
└── checklists/
    └── requirements.md  # Checklist de qualidade da especificação
```

### Source Code (repository root)

```text
src/
├── @types/                     # Declarações de tipos customizados (FastifyRequest user, etc.)
│   └── fastify.d.ts
├── config/
│   ├── env.ts                  # Esquema Zod e carregamento de variáveis de ambiente
│   ├── database.ts             # Inicialização e lifecycle da conexão Mongoose
│   └── constants.ts            # Categorias canônicas e constantes do sistema
├── models/
│   ├── user.model.ts           # Schema e modelo Mongoose para users
│   ├── transaction.model.ts    # Schema e modelo Mongoose para transactions com índice único
│   └── chat-session.model.ts   # Schema e modelo Mongoose para chat_sessions
├── plugins/
│   ├── auth.plugin.ts          # Plugin @fastify/jwt com decorators e guards
│   ├── swagger.plugin.ts       # Configuração de OpenAPI e Swagger UI
│   └── multipart.plugin.ts     # Configuração de upload de arquivos
├── routes/
│   ├── auth.routes.ts          # POST /register, POST /login, PUT /user/ai-key
│   ├── transactions.routes.ts  # POST /upload, GET /, POST /categorize
│   ├── pluggy.routes.ts        # POST /integrations/pluggy/sync
│   ├── chat.routes.ts          # POST /api/chat/stream (SSE)
│   └── health.routes.ts        # GET /health
├── services/
│   ├── auth.service.ts         # Registro, autenticação e geração de JWT
│   ├── crypto.service.ts       # Encriptação e decriptação AES-256-GCM via crypto nativo
│   ├── gemini.service.ts       # Validação ativa de chave, categorização e chat streaming via @google/genai
│   ├── parser.service.ts       # Parsing de OFX e CSV com sanitização e LGPD
│   ├── pluggy.service.ts       # Cliente e normalizador de dados do sandbox da Pluggy
│   └── transaction.service.ts  # Ingestão idempotente, deduplicação em memória e agregação mensal
├── schemas/
│   ├── auth.schemas.ts         # Schemas Zod de autenticação e chave BYOK
│   ├── transaction.schemas.ts  # Schemas Zod de transações e filtros
│   ├── chat.schemas.ts         # Schemas Zod de mensagens de chat
│   └── pluggy.schemas.ts       # Schemas Zod de sincronização Pluggy
├── app.ts                      # Fábrica da aplicação Fastify (registro de plugins e rotas)
└── server.ts                   # Bootstrapping e inicialização do servidor HTTP

tests/
├── unit/
│   ├── crypto.service.test.ts  # Testes de criptografia/decriptografia AES-256-GCM
│   ├── parser.service.test.ts  # Testes de parsing OFX/CSV e extração de FITID
│   └── sanitization.test.ts    # Testes de expurgo de dados sensíveis LGPD
└── integration/
    ├── auth.routes.test.ts     # Testes de registro, login e guarda BYOK
    ├── transactions.routes.test.ts # Testes de upload, idempotência e categorização
    └── chat.routes.test.ts     # Testes do fluxo de streaming SSE

Dockerfile                      # Multi-stage build com usuário non-root node
docker-compose.yml              # Orquestração de API e MongoDB 7.0 com healthchecks
tsconfig.json                  # Compilador TypeScript em modo strict
package.json                    # Dependências e scripts do projeto
```

**Structure Decision**: Aplicação única de backend em Node.js/TypeScript organizada em camadas desacopladas (`models`, `routes`, `services`, `schemas`, `plugins`), com separação nítida entre contratos HTTP, domínio de negócio e adaptadores de infraestrutura externa (MongoDB, Pluggy, Google Gemini).

## Complexity Tracking

> **Nenhuma violação identificada**. A arquitetura respeita com fidelidade integral todos os princípios definidos na Constituição v1.0.0.
