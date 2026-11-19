# Implementation Plan: Fiscal Planning & Advanced Financial Advisory

**Branch**: `015-fiscal-and-advisory-planning` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/015-fiscal-and-advisory-planning/spec.md`

---

## Summary

Implementação dos módulos integrados de **Planejamento Fiscal** e **Consultoria Financeira Avançada** no backend (`projeto-backend-dashboard`). 
A feature abrange:
1. **Triagem Fiscal e Deduções (IRPF/Livro-Caixa)**: classificação e guarda de despesas dedutíveis com metadados estruturados protegidos (CPF/CNPJ, comprovantes) e geração de Dossiê Fiscal auditável.
2. **Leitura Inteligente de Comprovantes (OCR)**: extração estruturada de dados de recibos médicos e notas fiscais (NFS-e) via Gemini Vision com chave BYOK do usuário e conciliação automática com transações bancárias.
3. **Painel Fiscal PJ / Autônomo**: controle de faturamento acumulado, proximidade de tetos tributários (MEI/Simples Nacional) e segregação de pró-labore vs. lucros.
4. **Orçamentos Mensais com Metas Quantificadas (Budgets)**: limites monetários por categoria canônica, monitoramento de consumo em tempo real e injeção de alertas no consultor inteligente.
5. **Diagnóstico Multi-Mês**: agregação histórica em janelas de 3, 6 e 12 meses, detecção de aumentos em custos fixos e médias móveis.
6. **Carteira de Investimentos por Macroclasses**: alocação patrimonial calibrada com o perfil de risco do usuário (`CONSERVATIVE`, `MODERATE`, `AGGRESSIVE`).

---

## Technical Context

**Language/Version**: Node.js 20 LTS com TypeScript configurado em modo estrito (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`).

**Primary Dependencies**: Fastify 4.x/5.x, `fastify-type-provider-zod`, Zod 3.x, `@fastify/jwt`, `@fastify/multipart`, Mongoose 8.x, `@google/genai` (^2.29.1), `pdfkit`, `exceljs`.

**Storage**: MongoDB 7.0 gerenciado via Mongoose ODM (coleções `transactions`, `users`, `budgets`, `fiscal_proofs`, `investment_holdings`).

**Testing**: Vitest (`vitest run`), Fastify inject para testes de integração HTTP e testes unitários com mocks dos serviços de domínio.

**Target Platform**: Linux / Docker Compose, multi-stage build.

**Project Type**: REST Web Service.

**Performance Goals**:
- Resposta de consultas agregadas de orçamento e painel fiscal < 50ms.
- Extração de comprovantes via Gemini OCR em streaming/buffer com tempo total < 3 segundos.
- Geração do dossiê anual PDF/XLSX < 2 segundos.

**Constraints**:
- Zero dependências de bancos relacionais (Princípio II da Constituição).
- Custo zero de IA no servidor com criptografia AES-256-GCM para chaves BYOK (Princípio III).
- Minimização extrema de tokens: envio de imagens restrito ao acionamento explícito do OCR (Princípio IV).
- Conformidade estrita com LGPD: expurgo de CPFs/CNPJs em prompts genéricos e isolamento multi-tenant rígido por `userId` (Princípio VII).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Princípio I (Escopo Estrito de Backend & TypeScript Strict)**: PASS. Toda a implementação é 100% backend em TypeScript estrito, com esquemas Zod para validação em runtime e inferência estática. Nenhum uso de `any`.
- **Princípio II (Stack Sem Dependências Relacionais)**: PASS. Todas as novas entidades (`budgets`, `fiscal_proofs`, `investment_holdings`) são persistidas no MongoDB nativo via Mongoose ODM.
- **Princípio III (Arquitetura BYOK & Custo Zero)**: PASS. A extração de comprovantes utiliza a chave Google Gemini descriptografada volátilmente em memória do próprio usuário.
- **Princípio IV (Minimização Extrema de Tokens)**: PASS. Prompts utilizam JSON Schema com Structured Outputs; cálculos orçamentários, fiscais e agregados são processados deterministicamente no código local em TypeScript.
- **Princípio V (Ingestão de Extratos e Provedor Sintético)**: PASS. O script `npm run seed` será expandido para provisionar orçamentos de exemplo, alocações de investimentos e transações com tags fiscais.
- **Princípio VI (Containerização Integral)**: PASS. O diretório de armazenamento de comprovantes (`uploads/receipts/`) é montado em volume Docker com permissões de usuário não-root.
- **Princípio VII (Autenticação Stateless & LGPD)**: PASS. Autenticação via JWT; identificadores sensíveis (CPF/CNPJ) armazenados em campos protegidos dedicados do MongoDB e expressamente excluídos de prompts corriqueiros de IA.

---

## Project Structure

### Documentation (this feature)

```text
specs/015-fiscal-and-advisory-planning/
├── plan.md              # Este documento de planejamento de arquitetura
├── research.md          # Decisões arquiteturais (OCR, LGPD, Budgets, Multi-mês)
├── data-model.md        # Schemas Zod, subdocumentos e coleções MongoDB
├── quickstart.md        # Guia de validação ponta a ponta e testes cURL
├── contracts/           # Especificação formal das APIs REST
│   ├── budgets.contract.md
│   ├── fiscal.contract.md
│   ├── investments.contract.md
│   └── analysis-multimonth.contract.md
├── checklists/          # Checklist de qualidade de requisitos
│   └── requirements.md
└── tasks.md             # Tarefas de implementação (geradas via /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── config/
│   └── constants.ts                # Novas constantes: TAX_CATEGORIES, ASSET_MACRO_CLASSES, BUDGET_STATUSES
├── models/
│   ├── transaction.model.ts        # Adição do subschema fiscal: ITransactionFiscalMetadata
│   ├── budget.model.ts             # Nova coleção MongoDB: budgets
│   ├── fiscal-proof.model.ts       # Nova coleção MongoDB: fiscal_proofs
│   └── investment-holding.model.ts # Nova coleção MongoDB: investment_holdings
├── schemas/
│   ├── budget.schemas.ts           # Validações Zod para orçamentos e consumo
│   ├── fiscal.schemas.ts           # Validações Zod para deduções, OCR e dossiê
│   └── investment.schemas.ts       # Validações Zod para alocação patrimonial
├── services/
│   ├── budget.service.ts           # Lógica de tetos, cálculo de consumo e status
│   ├── fiscal.service.ts           # Classificação fiscal, cruzamento PJ e dossiê
│   ├── fiscal-ocr.service.ts       # Extração estruturada via Gemini Vision BYOK
│   ├── investment.service.ts       # Gestão de carteira e calibração por perfil de risco
│   ├── analysis.service.ts         # Expansão para suporte a getMultiMonthSummary
│   └── chat.service.ts             # Injeção de alertas orçamentários no prompt da IA
└── routes/
    ├── budget.routes.ts            # Rotas GET/PUT /api/budgets/:month
    ├── fiscal.routes.ts            # Rotas /api/fiscal/* e /api/transactions/:id/fiscal
    ├── investment.routes.ts        # Rotas GET/PUT /api/investments/holdings
    └── analysis.routes.ts          # Adição da rota GET /api/analysis/multi-month

tests/
├── unit/
│   ├── budget.service.test.ts      # Testes unitários de regras de consumo orçamentário
│   ├── fiscal.service.test.ts      # Testes unitários de cálculo dedutível e regras PJ
│   ├── fiscal-ocr.service.test.ts  # Testes unitários do parser de OCR Gemini
│   └── investment.service.test.ts  # Testes unitários de calibração de risco
└── integration/
    ├── budgets.routes.test.ts      # Testes de integração Fastify para orçamentos
    ├── fiscal.routes.test.ts       # Testes de integração Fastify para módulo fiscal
    ├── investments.routes.test.ts  # Testes de integração Fastify para investimentos
    └── analysis-multimonth.routes.test.ts # Testes de integração para análise multi-mês
```

---

## Complexity Tracking

> Nenhuma violação aos princípios constitucionais. Não há exceções ou complexidade injustificada adicionada.

| Princípio | Avaliação | Justificativa |
|-----------|-----------|---------------|
| Banco Relacional | Não utilizado | Mantida persistência exclusiva no MongoDB 7.0 via Mongoose ODM |
| Custo de IA | Zero | Todas as inferências multimodais de OCR utilizam chave BYOK do usuário |
| LGPD | Conforme | CPFs e CNPJs são mantidos no banco sob isolamento de tenant e nunca vazam em prompts abertos |
