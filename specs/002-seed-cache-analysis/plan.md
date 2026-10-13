# Implementation Plan: Cache de Análises com TTL, Seed Pluggy e Expansão da Documentação

**Branch**: `002-seed-cache-analysis` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-seed-cache-analysis/spec.md`

## Summary

Implementação da camada de cache e persistência de análises financeiras mensais geradas por IA utilizando o MongoDB com TTL nativo de 24 horas (`financial_analyses`) e invalidação baseada em hash determinístico do estado das transações (`transactionStateHash`), garantindo redução drástica de tokens do Gemini em consultas repetidas. Criação do script de automação de seed de dados (`scripts/seed.ts` e `npm run seed`) para provisionamento imediato de usuários de teste com a chave do `.env` e transações da sandbox da Pluggy. Atualização abrangente do `README.md` com diagramas arquiteturais Mermaid, fluxos de segurança BYOK e guia de execução.

## Technical Context

**Language/Version**: Node.js 20 LTS, TypeScript 5.x (`strict: true`)

**Primary Dependencies**: Fastify, Zod, Mongoose, `@google/genai`, `fastify-type-provider-zod`

**Storage**: MongoDB 7.0 (Coleção `financial_analyses` com índice composto único `{ userId: 1, month: 1 }` e índice TTL `{ expiresAt: 1 }`)

**Testing**: Vitest para testes unitários do serviço de hash/cache e testes de integração do endpoint `/api/analysis/:month`

**Target Platform**: Linux / Docker Compose

**Performance Goals**:
- Cache Hit: tempo de resposta < 50ms (zero chamadas e zero tokens no Gemini)
- Execução do seed de dados: < 10 segundos

**Constraints**:
- TTL de 24 horas gerenciado nativamente pelo MongoDB
- Invalidação determinística orientada ao conjunto de transações do mês
- Conformidade integral com os 7 princípios da Constituição v1.0.0

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Justificativa |
|---|:---:|---|
| **I. Escopo Estrito de Backend** | ✅ PASS | Código puramente em Node.js/TypeScript estrito, sem acoplamento de frontend. |
| **II. Stack Tecnológica Sem Dependências Relacionais** | ✅ PASS | Persistência do cache feita exclusivamente no MongoDB via Mongoose; sem adicionar Redis ou bancos SQL. |
| **III. Arquitetura BYOK & Custo Zero** | ✅ PASS | Quando houver cache miss, a chamada de análise utiliza a chave BYOK descriptografada efemeramente. |
| **IV. Minimização Extrema de Tokens** | ✅ PASS | Cache elimina chamadas redundantes em mais de 90%, conservando a cota do usuário. |
| **V. Ingestão Dupla** | ✅ PASS | O seed integra a sandbox da Pluggy e transações no esquema canônico unificado. |
| **VI. Containerização Integral** | ✅ PASS | Dockerfile e Docker Compose já configurados e mantidos. |
| **VII. Autenticação Stateless e LGPD** | ✅ PASS | Todas as análises são associadas estritamente ao `userId` autenticado via JWT; PII nunca é persistido ou enviado à IA. |

## Project Structure

### Documentation (this feature)

```text
specs/002-seed-cache-analysis/
├── plan.md              # Este plano de implementação
├── research.md          # Decisões arquiteturais de cache, TTL e seed
├── data-model.md        # Esquema da coleção financial_analyses e índices
├── quickstart.md        # Guia de validação do cache e comando de seed
├── contracts/
│   └── openapi.yaml     # Contrato OpenAPI do endpoint GET /api/analysis/:month
└── checklists/
    └── requirements.md  # Checklist de qualidade da especificação
```

### Source Code Touchpoints

```text
src/
├── models/
│   └── analysis.model.ts       # Novo modelo Mongoose FinancialAnalysis com índice TTL
├── schemas/
│   └── analysis.schemas.ts     # Novos schemas Zod para GET /api/analysis/:month
├── services/
│   ├── analysis.service.ts     # Lógica de cálculo de hash de estado, verificação de cache e geração via Gemini
│   └── gemini.service.ts       # Extensão para geração estruturada de diagnósticos
├── routes/
│   └── analysis.routes.ts      # Nova rota GET /api/analysis/:month
└── app.ts                      # Registro da nova rota de análise

scripts/
└── seed.ts                     # Script executável de seed da Pluggy e usuário com chave do .env

README.md                       # Reescrita completa e diagramada do repositório
package.json                    # Novo script "seed": "tsx scripts/seed.ts"
```

## Complexity Tracking

> Nenhuma violação da Constituição. A arquitetura de cache com índice TTL no MongoDB respeita a restrição de manter apenas Fastify + MongoDB sem introduzir Redis ou novas dependências de infraestrutura.
