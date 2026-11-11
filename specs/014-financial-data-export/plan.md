# Implementation Plan: Central de Exportação de Dados Financeiros (CSV, XLSX e PDF)

**Branch**: `feature/014-financial-data-export` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-financial-data-export/spec.md`

## Summary

Implementação da Central de Exportação de Dados Financeiros no backend (`projeto-backend-dashboard`). Disponibiliza o endpoint autenticado `GET /api/transactions/export` capaz de filtrar transações por período (`month`, `startDate`, `endDate`), conta (`accountId`) e categoria (`category`), gerando relatórios em três formatos: CSV (UTF-8 com BOM e delimitador `;`), planilha formatada XLSX (`exceljs`) e relatório institucional PDF (`pdfkit`) com sumário consolidado de KPIs.

## Technical Context

**Language/Version**: Node.js 20+ com TypeScript em modo estrito (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`)

**Primary Dependencies**: Fastify 4.x/5.x, `fastify-type-provider-zod`, Zod 3.x, `@fastify/jwt`, Mongoose 8.x, `exceljs` (^4.4.0), `pdfkit` (^0.15.0)

**Storage**: MongoDB nativo gerenciado via Mongoose ODM (leitura filtrada e agregada de `transactions`, `accounts` e `users`)

**Testing**: Vitest (`vitest run`), supertest / Fastify inject para testes de integração de rota e testes unitários de renderização

**Target Platform**: Linux / Docker Compose, multi-stage container build

**Project Type**: REST Web Service

**Performance Goals**: Tempo de geração e resposta < 2 segundos para extratos com até 1.000 transações em qualquer formato; processamento 100% em streaming/buffers de memória volátil

**Constraints**:
- Zero dependências de bancos relacionais (Princípio II da Constituição)
- Processamento puramente em Node.js sem navegadores headless / Chromium / Puppeteer
- Conformidade estrita com LGPD (Princípio VII) e isolamento multi-tenant por `userId`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Princípio I (Escopo Estrito de Backend & TypeScript Strict)**: PASS. Todos os contratos de exportação e geradores são tipados estritamente em TypeScript sem uso de `any`.
- **Princípio II (Stack Sem Dependências Relacionais)**: PASS. Consultas realizadas exclusivamente no MongoDB via Mongoose ODM (`TransactionModel`, `AccountModel`, `UserModel`).
- **Princípio III & IV (BYOK e Minimização de Tokens)**: PASS. A exportação é uma operação determinística local de dados contábeis, com zero consumo de tokens de IA.
- **Princípio V (Ingestão e Dados Locais)**: PASS. Compatível com as transações oriundas de OFX, CSV e gerador sintético local.
- **Princípio VII (Autenticação Stateless e LGPD)**: PASS. Operação restrita ao `userId` autenticado no token JWT. PII mantida sob estrito isolamento multi-tenant.

## Project Structure

### Documentation (this feature)

```text
specs/014-financial-data-export/
├── plan.md              # Este arquivo
├── research.md          # Decisões técnicas (exceljs, pdfkit, CSV com BOM)
├── data-model.md        # Schemas Zod de query, DTOs de exportação e métricas
├── quickstart.md        # Guia prático de teste cURL e automatizado
├── contracts/           # Contratos REST de GET /api/transactions/export
│   └── export.contract.md
├── checklists/          # Validação de qualidade de requisitos
│   └── requirements.md
└── tasks.md             # Tarefas da feature (geradas na próxima etapa)
```

### Source Code (repository root)

```text
src/
├── schemas/
│   └── export.schemas.ts       # Validação Zod para ExportTransactionsQuery
├── services/
│   ├── export.service.ts       # Orquestrador de exportação, busca no MongoDB e métricas
│   ├── csv-export.service.ts   # Renderizador CSV (BOM, delimiter ;, locale BR)
│   ├── xlsx-export.service.ts  # Renderizador ExcelJS (estilos, numFmt R$)
│   └── pdf-export.service.ts   # Renderizador PDFKit (cabeçalho, KPIs, tabela paginada)
└── routes/
    └── export.routes.ts        # Rota GET /api/transactions/export com hook requireAuth

tests/
├── unit/
│   ├── csv-export.service.test.ts   # Testes unitários do gerador CSV
│   ├── xlsx-export.service.test.ts  # Testes unitários da planilha Excel
│   └── pdf-export.service.test.ts   # Testes unitários do relatório PDF
└── integration/
    └── export.routes.test.ts        # Testes de integração HTTP Fastify inject
```
