# Tasks: Central de Exportação de Dados Financeiros (CSV, XLSX e PDF)

**Input**: Design documents from `/specs/014-financial-data-export/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure & Dependencies)

**Purpose**: Instalação das bibliotecas de geração de relatórios e definição de schemas de validação Zod

- [X] T001 Instalar dependências de produção e tipos para geração de relatórios (`exceljs`, `pdfkit`, `@types/pdfkit`) no `package.json`
- [X] T002 [P] Criar schemas Zod de validação de query parameters `ExportTransactionsQuerySchema` (`format`, `month`, `startDate`, `endDate`, `accountId`, `category`) em `src/schemas/export.schemas.ts`

---

## Phase 2: Foundational (Core Query & Data Extraction Service)

**Purpose**: Serviço base de consulta multi-tenant ao MongoDB com filtros temporais, contas e categorias que alimenta todos os formatos

**⚠️ CRITICAL**: Nenhuma história de usuário de exportação pode ser testada sem este serviço de extração de dados

- [X] T003 Implementar método base de consulta, sanitização e mapeamento de contas `ExportService.getExportData(userId, query)` retornando `{ records: IExportRecord[], metrics: IExportSummaryMetrics }` em `src/services/export.service.ts`
- [X] T004 [P] Criar testes unitários para a extração, filtros e cálculo de métricas de `ExportService` em `tests/unit/export.service.test.ts`
- [X] T005 Registrar plugin e estrutura da rota `GET /api/transactions/export` com hook `requireAuth` e validação Zod em `src/routes/export.routes.ts` e plugar no `src/app.ts`

**Checkpoint**: Camada de extração de dados e validação de query parâmetros pronta — implementação dos formatos pode avançar

---

## Phase 3: User Story 1 - Exportação em Formato Aberto CSV (Priority: P1) 🎯 MVP

**Goal**: Permitir exportação das transações filtradas em arquivo CSV compatível com Excel no Brasil (UTF-8 com BOM, delimitador `;`, vírgula decimal e datas `DD/MM/YYYY`)

**Independent Test**: Requisição `GET /api/transactions/export?format=csv` retorna status 200, cabeçalhos `text/csv; charset=utf-8` com `Content-Disposition`, buffer com BOM `\uFEFF` e linhas delimitadas por ponto e vírgula com valores monetários em formato decimal brasileiro.

### Tests for User Story 1
- [X] T006 [P] [US1] Criar suite de testes unitários para o gerador de CSV em `tests/unit/csv-export.service.test.ts` (validação de BOM, delimitador `;`, escape de aspas e formatação numérica)

### Implementation for User Story 1
- [X] T007 [US1] Implementar serviço de renderização `CsvExportService.generate(records)` gerando Buffer UTF-8 com BOM em `src/services/csv-export.service.ts`
- [X] T008 [US1] Integrar o formato `csv` na rota `GET /api/transactions/export` em `src/routes/export.routes.ts`
- [X] T009 [US1] Adicionar teste de integração HTTP para download de CSV com autenticação e transações sintéticas em `tests/integration/export.routes.test.ts`

**Checkpoint**: MVP concluído — Usuários já conseguem baixar extrato financeiro em CSV totalmente funcional e compatível com Excel.

---

## Phase 4: User Story 2 - Exportação em Planilha Estruturada XLSX (Priority: P2)

**Goal**: Permitir exportação em planilha eletrônica `.xlsx` com células nativamente tipadas (moeda `R$ #,##0.00` e data), cabeçalhos estilizados e largura dinâmica de colunas

**Independent Test**: Requisição `GET /api/transactions/export?format=xlsx` retorna status 200, cabeçalho `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, buffer válido de planilha Excel com formatações nativas de células permitindo operações de soma no Excel.

### Tests for User Story 2
- [X] T010 [P] [US2] Criar suite de testes unitários para a geração de planilha Excel em `tests/unit/xlsx-export.service.test.ts` (validação de estilos, tipos de célula e numFmt monetário)

### Implementation for User Story 2
- [X] T011 [US2] Implementar serviço `XlsxExportService.generate(records, metrics)` com `exceljs` gerando buffer com cabeçalho estilizado, larguras ajustadas e formatação monetária em `src/services/xlsx-export.service.ts`
- [X] T012 [US2] Integrar o formato `xlsx` na rota `GET /api/transactions/export` em `src/routes/export.routes.ts`
- [X] T013 [US2] Adicionar teste de integração HTTP para download de XLSX em `tests/integration/export.routes.test.ts`

**Checkpoint**: Planilhas Excel profissionais prontas e integradas à API.

---

## Phase 5: User Story 3 - Relatório Executivo Diagramado em PDF (Priority: P3)

**Goal**: Permitir geração de relatório financeiro diagramado em PDF com cabeçalho institucional, sumário de KPIs consolidados (Receitas, Despesas, Saldo Líquido), tabela detalhada e paginação

**Independent Test**: Requisição `GET /api/transactions/export?format=pdf` retorna status 200, cabeçalho `application/pdf`, buffer binário de documento PDF com layout institucional e sumário de métricas.

### Tests for User Story 3
- [X] T014 [P] [US3] Criar suite de testes unitários para geração do documento PDF em `tests/unit/pdf-export.service.test.ts` (validação de integridade de buffer PDFKit e ausência de travamentos de stream)

### Implementation for User Story 3
- [X] T015 [US3] Implementar serviço de diagramação `PdfExportService.generate(user, records, metrics)` com `pdfkit` contendo cabeçalho, tabela paginada e rodapé numerado em `src/services/pdf-export.service.ts`
- [X] T016 [US3] Integrar o formato `pdf` na rota `GET /api/transactions/export` em `src/routes/export.routes.ts`
- [X] T017 [US3] Adicionar teste de integração HTTP para download de PDF em `tests/integration/export.routes.test.ts`

**Checkpoint**: Todos os três formatos de exportação operantes e independentes.

---

## Phase 6: User Story 4 - Validação de Filtros Contextuais e Segurança Multi-Tenant (Priority: P4)

**Goal**: Garantir que combinações de filtros (`month`, `startDate`/`endDate`, `accountId`, `category`) sejam respeitadas em todos os formatos e que tentativas de violar multi-tenancy sejam bloqueadas

**Independent Test**: Requisição com `startDate > endDate` retorna 400 Bad Request; requisição com `accountId` de outro usuário retorna 404/403; requisições filtradas contêm exclusivamente as transações compatíveis.

### Implementation for User Story 4
- [X] T018 [US4] Adicionar validação de posse de conta (`AccountModel.findOne({ _id: accountId, userId })`) com retorno de 404/403 caso a conta pertença a outro usuário em `src/services/export.service.ts`
- [X] T019 [US4] Adicionar testes de integração cobrindo filtros combinados e tentativas de acesso multi-tenant em `tests/integration/export.routes.test.ts`

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verificação estática de tipos, suite de regressão e documentação

- [X] T020 [P] Documentar os endpoints e exemplos de exportação no `README.md`
- [X] T021 [P] Atualizar status da Feature 014 no `ROADMAP.md` para Concluída
- [X] T022 Executar checagem estrita de tipos com `npx tsc --noEmit` garantindo zero erros de compilação TypeScript
- [X] T023 Executar a suíte completa de testes com `npx vitest run` garantindo regressão zero em todo o projeto

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Sem dependências — instalação imediata de `exceljs` e `pdfkit`.
- **Foundational (Phase 2)**: Depende da Phase 1 — BLOQUEIA a implementação dos formatos.
- **User Stories (Phases 3 a 6)**:
  - US1 (CSV - P1) pode ser executada imediatamente após a Phase 2 (MVP).
  - US2 (XLSX - P2) e US3 (PDF - P3) dependem da Phase 2 e dos dados de `ExportService`.
  - US4 (Filtros & Multi-tenant) consolida as regras de segurança e filtros.
- **Polish (Phase 7)**: Executada após a conclusão das histórias de usuário.

---

## Parallel Opportunities

- T001 e T002 podem ser executados em paralelo.
- Os testes unitários dos renderizadores (T006, T010, T014) podem ser executados em paralelo às implementações de serviço.
- As implementações dos serviços de renderização (CsvExportService, XlsxExportService, PdfExportService) são isoladas em arquivos diferentes e podem ser desenvolvidas em paralelo.

---

## Implementation Strategy

### MVP First (User Story 1 - CSV)
1. Instalar dependências e criar schemas Zod (Phase 1).
2. Construir `ExportService` base e rota com autenticação (Phase 2).
3. Implementar `CsvExportService` e rota CSV (Phase 3).
4. **Validação**: Testar download e abertura do CSV com delimitador `;` e BOM.
5. Avançar incrementalmente para XLSX (US2) e PDF (US3).
