# Implementation Plan: Autenticação em Dois Fatores (2FA via E-mail) e Revogação de Sessão

**Branch**: `012-two-factor-auth-session` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-two-factor-auth-session/spec.md`

## Summary

Implementação de autenticação multifator (2FA) via e-mail com código OTP numérico de 6 dígitos criptograficamente seguro, interceptação do fluxo de login para contas protegidas, proteção anti-brute force com limite de 5 tentativas e cooldown de 60 segundos para reenvios, associado a um mecanismo de logout seguro com revogação imediata de sessões em conformidade com a arquitetura JWT e MongoDB com índices TTL nativos.

## Technical Context

**Language/Version**: TypeScript 5.5.4 (Node.js 20+ em modo `strict: true`, `noImplicitAny: true`)

**Primary Dependencies**: Fastify 4.28.1, `fastify-type-provider-zod` 2.0.0, Zod 3.23.8, `@fastify/jwt` 8.0.1, Mongoose 8.5.1, `node:crypto`

**Storage**: MongoDB nativo via Mongoose ODM (coleções `users`, `two_factor_challenges` com índice TTL e `sessions` com índice TTL)

**Testing**: Vitest 2.0.4 com `supertest` / `app.inject()` (testes unitários e de integração)

**Target Platform**: Linux / Container Docker (Node.js LTS)

**Project Type**: REST Web Service (Fastify API backend)

**Performance Goals**: Tempo de resposta de validação e emissão < 50ms (p95); latência de entrega de e-mail < 10s; verificação de revogação de sessão em tempo $O(1)$ (< 2ms)

**Constraints**: Sem dependências de bancos relacionais ou Redis; expurgo automático via MongoDB TTL; código OTP nunca armazenado em texto plano; zero `any` no código

**Scale/Scope**: Suporte a dezenas de milhares de sessões ativas; 5 novos endpoints de API; 2 novas coleções Mongoose; 1 serviço de mensageria de e-mail

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio Constitucional | Status | Justificativa / Conformidade |
|--------------------------|--------|------------------------------|
| **I. Escopo Estrito de Backend (TS Strict, sem `any`)** | **PASS** | Tipagem estrita Zod e TypeScript em todas as interfaces, DTOs e entidades. Nenhum `any` utilizado. |
| **II. Stack Tecnológica Sem Dependências Relacionais** | **PASS** | Persistência exclusiva em MongoDB via Mongoose. Sessões e desafios usam índices TTL nativos do MongoDB sem requerer Redis ou PostgreSQL. |
| **III. Arquitetura BYOK & Custo Zero de IA** | **PASS** | Chaves BYOK e fluxo Gemini permanecem inalterados e protegidos com AES-256-GCM. |
| **IV. Minimização Extrema de Tokens & Pré-LLM** | **PASS** | Funcionalidade puramente de segurança e infraestrutura de autenticação; nenhum token LLM consumido. |
| **V. Ingestão OFX/CSV & Seed Local** | **PASS** | Sem impacto sobre os adaptadores bancários existentes. |
| **VI. Containerização Integral e Resiliência** | **PASS** | Não requer binários adicionais no host nem containers extras no Docker Compose. |
| **VII. Autenticação Stateless & LGPD (JWT & Privacy)** | **PASS** | JWT mantido no cabeçalho `Authorization: Bearer <token>`; revogação realizada via checagem de `sessionId` em MongoDB com TTL; nenhum PII exposto em logs ou retornos. |

## Project Structure

### Documentation (this feature)

```text
specs/012-two-factor-auth-session/
├── spec.md              # Especificação de requisitos funcionais e de negócio
├── plan.md              # Este plano de implementação técnica
├── research.md          # Pesquisa técnica e decisões de arquitetura (Phase 0)
├── data-model.md        # Modelo de dados e transições de estado (Phase 1)
├── quickstart.md        # Guia prático de execução e validação end-to-end (Phase 1)
├── contracts/           # Contratos formais da API Zod/Fastify (Phase 1)
│   └── auth-2fa.contract.md
├── checklists/
│   └── requirements.md  # Checklist de qualidade da especificação
└── tasks.md             # Tarefas de implementação (geradas no /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── @types/
│   └── fastify.d.ts                  # Atualização da interface FastifyJWT com sessionId
├── config/
│   ├── constants.ts                  # Constantes (TWO_FACTOR_CONFIG, SESSION_CONFIG)
│   └── env.ts                        # Variáveis de ambiente opcionais (SMTP_HOST, etc.)
├── models/
│   ├── user.model.ts                 # Campos isTwoFactorEnabled, twoFactorConfirmedAt
│   ├── two-factor-challenge.model.ts # Modelo TwoFactorChallenge com TTL index (10m)
│   └── session.model.ts              # Modelo Session com TTL index (7d) e status isRevoked
├── plugins/
│   └── auth.plugin.ts                # Validação em requireAuth para rejeição de sessões revogadas
├── routes/
│   └── auth.routes.ts                # Rotas /api/auth/login, /api/auth/2fa/*, /api/auth/logout
├── schemas/
│   └── auth.schemas.ts               # Schemas Zod de Login2FAResponse, Verify2FA, Resend, Logout
└── services/
    ├── auth.service.ts               # Orquestração do login com 2FA, OTP e ativação/desativação
    ├── email.service.ts              # Serviço desacoplado de envio de e-mails (Dev/Console e SMTP)
    └── session.service.ts            # Criação, validação e revogação de sessões ativas

tests/
├── integration/
│   └── auth.routes.test.ts           # Testes de integração cobrindo 2FA, interceptação e logout
└── unit/
    ├── auth.service.test.ts          # Testes unitários da lógica 2FA
    ├── email.service.test.ts         # Testes de envio e formatação de e-mail
    └── session.service.test.ts       # Testes de revogação e ciclo de vida de sessão
```

**Structure Decision**: Padrão modular em camada única de backend (`src/` com `models`, `routes`, `schemas`, `services`, `plugins`), preservando a consistência arquitetural de todo o repositório.

## Complexity Tracking

*Nenhuma violação constitucional identificada. Todas as soluções respeitam a stack Fastify + Zod + MongoDB e as restrições de segurança do projeto.*
