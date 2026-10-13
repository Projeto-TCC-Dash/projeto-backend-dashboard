# Implementation Plan: Validação Resiliente e Semântica de Erros da Chave Gemini (BYOK)

**Branch**: `feature/005-resilient-gemini-key-validation` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-resilient-gemini-key-validation/spec.md`

## Summary

Implementar classificação semântica e tratamento resiliente de erros na integração com o Google Gemini (BYOK). A solução introduz o módulo `GeminiErrorParser`, retentativas automáticas (`withGeminiRetry`) para falhas transitórias e altera o fluxo de cadastro da chave (`PUT /api/user/ai-key`) para que erros de infraestrutura upstream do Google (503 UNAVAILABLE ou 429 temporário) não bloqueiem o usuário, reconhecendo a chave como autenticada pelo gateway do Google e salvando-a criptografada com AES-256-GCM. Além disso, padroniza as rotas de categorização, chat SSE e análise mensal para emitirem códigos HTTP condizentes (503 / 429 / 400).

## Technical Context

**Language/Version**: Node.js 20 LTS, TypeScript 5.5 (Strict Mode: `strict: true`, sem `any`).

**Primary Dependencies**: Fastify 4.x, `@google/genai` 2.29+, `zod` 3.23+, `fastify-type-provider-zod`.

**Storage**: MongoDB 7.0 via Mongoose 8.x (`UserModel`, AES-256-GCM encryption).

**Testing**: Vitest 2.x (testes unitários e de integração com injeção HTTP).

**Target Platform**: Linux / Docker Compose / Node.js runtime.

**Project Type**: Web REST API Service.

**Performance Goals**:
- Resposta de validação de chave com retry em menos de 2,5 segundos.
- Classificação de erro em memória em menos de 1ms.

**Constraints**:
- Conformidade estrita com a Constituição do Projeto v2.0.0.
- Custo zero de IA no servidor (BYOK).
- Preservação da criptografia AES-256-GCM antes de persistir chaves no MongoDB.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Justificativa |
|---|:---:|---|
| **I. Escopo Estrito de Backend** | ✅ PASS | Código em TypeScript estrito, com tipagem forte para erros e respostas, sem frontend. |
| **II. Stack Tecnológica Sem Dependências Relacionais** | ✅ PASS | Persistência exclusiva no MongoDB NoSQL via Mongoose; sem Redis e sem SQL. |
| **III. Arquitetura BYOK & Custo Zero** | ✅ PASS | Chave do Gemini criptografada com AES-256-GCM mantida; o servidor nunca custeia IA. |
| **IV. Minimização Extrema de Tokens** | ✅ PASS | Pings de validação permanecem mínimos e otimizados; retries ocorrem apenas sob erros transitórios. |
| **V. Ingestão de Extratos e Provedor Local Sintético** | ✅ PASS | Total conformidade com a Constituição v2.0.0. |
| **VI. Containerização Integral** | ✅ PASS | Compatível com Docker Compose e execução local. |
| **VII. Autenticação Stateless e LGPD** | ✅ PASS | Nenhuma chave em texto claro ou PII é exposta em logs de erro. |

## Project Structure

### Documentation (this feature)

```text
specs/005-resilient-gemini-key-validation/
├── plan.md              # Este plano de implementação
├── research.md          # Decisões arquiteturais e mapeamento dos erros do Google AI Studio
├── data-model.md        # Tipos e contratos de resposta da API
├── quickstart.md        # Guia de cenários de teste e validação
├── checklists/
│   └── requirements.md  # Checklist de qualidade da especificação
└── tasks.md             # Tarefas de implementação (geradas no /speckit-tasks)
```

### Source Code Touchpoints

```text
src/
├── utils/
│   └── gemini-errors.ts        # [NOVO] Parser semântico de erros e utilitário withGeminiRetry
├── services/
│   └── gemini.service.ts       # Validação resiliente de chave e captura de erros semânticos
├── routes/
│   ├── auth.routes.ts          # Atualização do endpoint PUT /api/user/ai-key para 200 OK sob 503/429
│   ├── transactions.routes.ts  # Propagação correta de status HTTP 503/429 na categorização
│   ├── chat.routes.ts          # Eventos SSE coerentes sob falha upstream
│   └── analysis.routes.ts      # Diagnóstico com status HTTP correto sob indisponibilidade
└── schemas/
    └── auth.schemas.ts         # Schema atualizado de resposta para PUT /api/user/ai-key

tests/
├── unit/
│   └── gemini-errors.test.ts   # [NOVO] Testes unitários do parser de erros (503, 429, 400, 403, timeouts)
└── integration/
    ├── auth.routes.test.ts     # Testes cobrindo validação 200 OK, 503 (aceite sob alta demanda) e 400 (rejeição)
    └── ai-routes.test.ts       # Testes de propagação semântica em rotas de IA
```

## Complexity Tracking

*Nenhuma violação aos princípios constitucionais. A arquitetura ganha clareza semântica e resiliência sem adicionar bibliotecas externas.*
