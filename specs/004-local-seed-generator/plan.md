# Implementation Plan: Gerador Local de Seed e Desacoplamento da Pluggy

**Branch**: `004-local-seed-generator` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-local-seed-generator/spec.md`

## Summary

Desacoplamento e remoção definitiva de todas as dependências, serviços, schemas e rotas associadas à Pluggy, estabelecendo a ingestão de extratos bancários manuais (OFX SGML e CSV) como canal exclusivo de produção. Transformação do script `scripts/seed.ts` (`npm run seed`) em um gerador 100% autônomo, determinístico e offline de dados sintéticos realistas brasileiros (cobrindo mais de 35 transações em múltiplos meses e todas as 7 categorias canônicas), com associação da chave BYOK do `.env` e pré-aquecimento do cache de análise mensal com TTL. Atualização do `README.md` e suíte de testes.

## Technical Context

**Language/Version**: Node.js 20 LTS, TypeScript 5.5 (`strict: true`)

**Primary Dependencies**: Fastify, Zod, Mongoose, `@google/genai`, `fastify-type-provider-zod`

**Storage**: MongoDB 7.0 (Coleções `users`, `transactions`, `financial_analyses`, `chat_sessions`)

**Testing**: Vitest para testes unitários e de integração

**Target Platform**: Linux / Docker Compose

**Performance Goals**:
- Execução do seed completo: < 1 segundo
- Disponibilidade do seed: 100% offline (zero chamadas externas de rede para Open Finance)

**Constraints**:
- Conformidade integral com a Constituição do Projeto v2.0.0
- Nenhuma dependência externa para geração de dados de teste

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Justificativa |
|---|:---:|---|
| **I. Escopo Estrito de Backend** | ✅ PASS | Código em TypeScript estrito, sem `any`, sem frontend. |
| **II. Stack Tecnológica Sem Dependências Relacionais** | ✅ PASS | Persistência exclusiva no MongoDB NoSQL via Mongoose; sem Redis e sem SQL. |
| **III. Arquitetura BYOK & Custo Zero** | ✅ PASS | Chave do Gemini criptografada com AES-256-GCM mantida e vinculada no seed. |
| **IV. Minimização Extrema de Tokens** | ✅ PASS | Transações sintéticas possuem categorias pré-atribuídas e sanitizadas; análise mensal cacheada no MongoDB com TTL. |
| **V. Ingestão de Extratos e Seed Sintético Local** | ✅ PASS | Em total conformidade com a Constituição v2.0.0: ingestão via OFX/CSV e seed 100% local. |
| **VI. Containerização Integral** | ✅ PASS | Executável em Docker Compose e via comandos locais. |
| **VII. Autenticação Stateless e LGPD** | ✅ PASS | Dados sintéticos utilizam descrições comerciais limpas, sem PII. |

## Project Structure

### Documentation (this feature)

```text
specs/004-local-seed-generator/
├── plan.md              # Este plano de implementação
├── research.md          # Decisões arquiteturais do seed local e remoção da Pluggy
├── data-model.md        # Modelos canônicos atualizados (TRANSACTION_SOURCES)
├── quickstart.md        # Guia de validação do seed e da API
├── checklists/
│   └── requirements.md  # Checklist de qualidade da especificação
└── tasks.md             # Tarefas de implementação (geradas no /speckit-tasks)
```

### Source Code Touchpoints

```text
src/
├── config/
│   ├── env.ts                  # Remoção de PLUGGY_API_KEY, PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET
│   └── constants.ts            # Atualização de TRANSACTION_SOURCES para ['OFX', 'CSV', 'SEED']
├── models/
│   └── transaction.model.ts    # Atualização da tipagem de source para ['OFX', 'CSV', 'SEED']
├── services/
│   └── pluggy.service.ts       # [EXCLUSÃO DEFINITIVA]
├── routes/
│   └── pluggy.routes.ts        # [EXCLUSÃO DEFINITIVA se ainda presente]
├── schemas/
│   └── pluggy.schemas.ts       # [EXCLUSÃO DEFINITIVA se ainda presente]
└── app.ts                      # Garantir ausência de qualquer rota da Pluggy

scripts/
└── seed.ts                     # Reformulação completa para gerador sintético local rico

tests/
└── integration/
    ├── pluggy.routes.test.ts   # [EXCLUSÃO DEFINITIVA]
    ├── seed.test.ts            # Atualização para validar o gerador sintético local
    └── swagger.test.ts         # Garantir rotas limpas no Swagger

README.md                       # Atualização completa: remoção da Pluggy e documentação do seed local
```

## Complexity Tracking

> A arquitetura é substancialmente simplificada ao eliminar dependências de terceiros, diminuindo arquivos e removendo variáveis de ambiente obsoletas.
