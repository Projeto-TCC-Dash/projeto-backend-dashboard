# Tasks: Fiscal Planning & Advanced Financial Advisory

**Input**: Design documents from `/specs/015-fiscal-and-advisory-planning/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`  

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Tarefa executável em paralelo (arquivos distintos, sem dependências incompletas)
- **[Story]**: Mapeamento para a respectiva história de usuário (ex: `[US1]`, `[US2]`, `[US3]`, `[US4]`, `[US5]`, `[US6]`)
- Todas as tarefas incluem caminhos de arquivos absolutos ou relativos à raiz do projeto

---

## Phase 1: Setup (Constantes, Schemas Compartilhados e Configurações)

**Purpose**: Definição de constantes de domínio, tipos canônicos e schemas Zod para todos os novos módulos

- [X] T001 Adicionar constantes canônicas `TAX_CATEGORIES`, `FISCAL_VERIFICATION_STATUSES`, `ASSET_MACRO_CLASSES` e `BUDGET_CONSUMPTION_STATUSES` em `src/config/constants.ts`
- [X] T002 [P] Criar esquemas Zod de validação para planos e consumo orçamentário (`SetBudgetBodySchema`, `BudgetOverviewResponseSchema`) em `src/schemas/budget.schemas.ts`
- [X] T003 [P] Criar esquemas Zod de validação para classificação fiscal, OCR e dossiê (`UpdateTransactionFiscalBodySchema`, `FiscalAnnualSummaryResponseSchema`) em `src/schemas/fiscal.schemas.ts`
- [X] T004 [P] Criar esquemas Zod de validação para carteira de investimentos (`UpsertInvestmentHoldingBodySchema`, `InvestmentPortfolioSummarySchema`) em `src/schemas/investment.schemas.ts`
- [X] T005 [P] Configurar diretório de upload de comprovantes fiscais `uploads/receipts` e constantes de limite (10MB, MIME types permitidos) em `src/config/constants.ts`

---

## Phase 2: Foundational (Modelos MongoDB e Subschemas)

**Purpose**: Estruturas de dados no MongoDB necessárias antes de implementar as rotas e serviços

**⚠️ CRITICAL**: Nenhuma história de usuário pode ser implementada antes da conclusão desta fase

- [X] T006 Atualizar `TransactionModel` adicionando o subdocumento `fiscal: ITransactionFiscalMetadata` e índices compostos de busca em `src/models/transaction.model.ts`
- [X] T007 [P] Criar modelo Mongoose `BudgetPlanModel` (`budgets`) com índice composto único `{ userId: 1, month: 1 }` em `src/models/budget.model.ts`
- [X] T008 [P] Criar modelo Mongoose `FiscalProofDocumentModel` (`fiscal_proofs`) com metadados do arquivo e dados extraídos em `src/models/fiscal-proof.model.ts`
- [X] T009 [P] Criar modelo Mongoose `InvestmentHoldingModel` (`investment_holdings`) com índice composto único `{ userId: 1, accountId: 1, macroClass: 1 }` em `src/models/investment-holding.model.ts`

**Checkpoint**: Camada de modelos persistentes pronta e validada. As histórias de usuário podem iniciar.

---

## Phase 3: User Story 1 - Triagem e Classificação Fiscal de Despesas Dedutíveis (Priority: P1) 🎯 MVP

**Goal**: Permitir ao usuário classificar transações dedutíveis (saúde, educação, etc.), associar CPF/CNPJ de prestadores sem vazamento para IA e visualizar o sumário fiscal anual consolidado.

**Independent Test**: Atualizar uma transação com dados fiscais via `PATCH /api/transactions/:id/fiscal` e consultar `GET /api/fiscal/summary?year=2026` verificando o acúmulo de deduções e a integridade de dados.

### Tests for User Story 1
- [ ] T010 [P] [US1] Criar suite de testes unitários para os métodos de classificação fiscal e agregação de deduções em `tests/unit/fiscal.service.test.ts`
- [ ] T011 [P] [US1] Criar suite de testes de integração para as rotas `/api/transactions/:id/fiscal` e `/api/fiscal/summary` em `tests/integration/fiscal.routes.test.ts`

### Implementation for User Story 1
- [ ] T012 [US1] Implementar serviço `FiscalService.updateTransactionFiscal(userId, transactionId, data)` garantindo validação de CPF/CNPJ limpos e isolamento multi-tenant em `src/services/fiscal.service.ts`
- [ ] T013 [US1] Implementar serviço `FiscalService.getAnnualSummary(userId, year)` agregando despesas dedutíveis confirmadas e pendentes por categoria em `src/services/fiscal.service.ts`
- [ ] T014 [US1] Implementar rotas Fastify `PATCH /api/transactions/:id/fiscal` e `GET /api/fiscal/summary` protegidas por JWT em `src/routes/fiscal.routes.ts`
- [ ] T015 [US1] Registrar plugin `fiscalRoutes` no servidor em `src/app.ts`

**Checkpoint**: MVP Fiscal concluído — Usuários já conseguem organizar e auditar despesas dedutíveis do IRPF com segurança.

---

## Phase 4: User Story 2 - Orçamentos Mensais com Metas Quantificadas por Categoria (Priority: P1)

**Goal**: Permitir estipular tetos orçamentários mensais por categoria canônica, monitorar o consumo em tempo real com status (`REGULAR`, `WARNING`, `EXCEEDED`) e injetar alertas no consultor inteligente.

**Independent Test**: Configurar orçamento para o mês via `PUT /api/budgets/:month` e consultar `GET /api/budgets/:month` verificando os percentuais consumidos calculados contra os lançamentos reais de débito.

### Tests for User Story 2
- [ ] T016 [P] [US2] Criar suite de testes unitários para a lógica de consumo orçamentário e faixas de alerta em `tests/unit/budget.service.test.ts`
- [ ] T017 [P] [US2] Criar suite de testes de integração para as rotas `GET /api/budgets/:month` e `PUT /api/budgets/:month` em `tests/integration/budgets.routes.test.ts`

### Implementation for User Story 2
- [ ] T018 [US2] Implementar serviço `BudgetService.upsertBudgetPlan(userId, month, data)` e `BudgetService.getBudgetOverview(userId, month)` cruzando limites com despesas de `TransactionModel` em `src/services/budget.service.ts`
- [ ] T019 [US2] Implementar rotas Fastify `GET /api/budgets/:month` e `PUT /api/budgets/:month` em `src/routes/budget.routes.ts`
- [ ] T020 [US2] Registrar plugin `budgetRoutes` no servidor em `src/app.ts`
- [ ] T021 [US2] Integrar resumo de orçamentos em alerta (`WARNING` ou `EXCEEDED`) no prompt de sistema de `ChatService.buildSystemInstruction` em `src/services/chat.service.ts`

**Checkpoint**: Orçamentos operantes com alertas automáticos vinculados ao consultor de IA.

---

## Phase 5: User Story 3 - Diagnóstico Multi-Mês e Identificação de Tendências (Priority: P2)

**Goal**: Permitir análise agregada de 3, 6 e 12 meses com taxa de poupança média, média móvel de despesas e detecção de aumentos silenciosos em custos fixos.

**Independent Test**: Inserir lançamentos em meses consecutivos e consultar `GET /api/analysis/multi-month?range=6` verificando o cálculo correto das médias e flags de tendência.

### Tests for User Story 3
- [ ] T022 [P] [US3] Criar suite de testes unitários para o cálculo de médias móveis e detecção de variações de custo fixo em `tests/unit/analysis-multimonth.test.ts`
- [ ] T023 [P] [US3] Criar suite de testes de integração para a rota `GET /api/analysis/multi-month` em `tests/integration/analysis-multimonth.routes.test.ts`

### Implementation for User Story 3
- [ ] T024 [US3] Implementar método `AnalysisService.getMultiMonthSummary(userId, range)` com pipelines de agregação do MongoDB em `src/services/analysis.service.ts`
- [ ] T025 [US3] Adicionar rota `GET /api/analysis/multi-month` em `src/routes/analysis.routes.ts` com validação de query parameters via Zod

**Checkpoint**: Inteligência financeira multi-mês operante.

---

## Phase 6: User Story 4 - Planejamento de Ativos e Alocação da Carteira de Investimentos (Priority: P2)

**Goal**: Permitir ao investidor acompanhar sua distribuição patrimonial em 6 macroclasses e receber recomendações de rebalanceamento alinhadas ao seu perfil de risco.

**Independent Test**: Configurar posições patrimoniais via `PUT /api/investments/holdings` e consultar `GET /api/investments/holdings` verificando os percentuais e o diagnóstico de conformidade ao risco.

### Tests for User Story 4
- [ ] T026 [P] [US4] Criar suite de testes unitários para cálculo de percentuais de carteira e regras de calibração de risco em `tests/unit/investment.service.test.ts`
- [ ] T027 [P] [US4] Criar suite de testes de integração para as rotas `/api/investments/holdings` em `tests/integration/investments.routes.test.ts`

### Implementation for User Story 4
- [ ] T028 [US4] Implementar serviço `InvestmentService.upsertHolding(userId, data)` e `InvestmentService.getPortfolioSummary(userId)` confrontando com `riskProfile` em `src/services/investment.service.ts`
- [ ] T029 [US4] Implementar rotas Fastify `GET /api/investments/holdings` e `PUT /api/investments/holdings` em `src/routes/investment.routes.ts`
- [ ] T030 [US4] Registrar plugin `investmentRoutes` no servidor em `src/app.ts`

**Checkpoint**: Módulo de carteira de investimentos integrado e ativo.

---

## Phase 7: User Story 5 - Conciliação e Extração Inteligente de Comprovantes Fiscais (OCR) (Priority: P3)

**Goal**: Upload de recibos/notas fiscais (PDF/imagem), extração de dados com Gemini Vision BYOK e sugestão de conciliação automática com transações bancárias.

**Independent Test**: Enviar arquivo via `POST /api/fiscal/ocr` e receber JSON estruturado contendo CNPJ, Razão Social, Valor e transação bancária sugerida com score de confiança.

### Tests for User Story 5
- [ ] T031 [P] [US5] Criar suite de testes unitários para a extração estruturada de comprovantes com mock do Gemini em `tests/unit/fiscal-ocr.service.test.ts`
- [ ] T032 [P] [US5] Criar suite de testes de integração para o upload multipart de comprovantes em `tests/integration/fiscal-ocr.routes.test.ts`

### Implementation for User Story 5
- [ ] T033 [US5] Implementar serviço `FiscalOcrService.extractReceiptData(apiKey, fileBuffer, mimeType)` utilizando Gemini Vision e JSON Schema estrito em `src/services/fiscal-ocr.service.ts`
- [ ] T034 [US5] Implementar método de busca de transações bancárias compatíveis por data e valor em `src/services/fiscal.service.ts`
- [ ] T035 [US5] Implementar rota `POST /api/fiscal/ocr` multipart com guardas `requireAuth` e `requireAiKey` em `src/routes/fiscal.routes.ts`

**Checkpoint**: Extração inteligente e conciliação de comprovantes pronta.

---

## Phase 8: User Story 6 - Painel de Controle Fiscal para Autônomos e PJ (Priority: P3)

**Goal**: Acompanhar faturamento bruto PJ/Autônomo acumulado, proximidade de tetos (MEI/Simples Nacional) e exportar Dossiê Fiscal anual em PDF e XLSX.

**Independent Test**: Consultar `GET /api/fiscal/summary?year=2026` com conta PJ e requisitar `GET /api/fiscal/dossier?year=2026&format=pdf` verificando o download do arquivo diagramado.

### Tests for User Story 6
- [ ] T036 [P] [US6] Criar suite de testes unitários para apuração de faturamento bruto PJ e cálculo de tetos tributários em `tests/unit/fiscal-pj.service.test.ts`
- [ ] T037 [P] [US6] Criar suite de testes de integração para o download do dossiê fiscal em `tests/integration/fiscal-dossier.routes.test.ts`

### Implementation for User Story 6
- [ ] T038 [US6] Implementar apuração de receitas de prestação de serviços e segregação de pró-labore em `FiscalService.getPjSummary(userId, year)` em `src/services/fiscal.service.ts`
- [ ] T039 [US6] Implementar serviço de geração de dossiê em PDF e planilha XLSX `FiscalDossierExportService.generate(user, summary, records, format)` em `src/services/fiscal-dossier-export.service.ts`
- [ ] T040 [US6] Implementar rota `GET /api/fiscal/dossier` com cabeçalhos de download em `src/routes/fiscal.routes.ts`

**Checkpoint**: Suporte completo para Autônomos/PJ e exportação do Dossiê Fiscal entregues.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Provisionamento sintético, validação de contratos e garantia de qualidade integral

- [ ] T041 Atualizar script de seed `scripts/seed.ts` provisionando dados sintéticos com metadados fiscais, orçamentos mensais e posições de investimentos
- [ ] T042 [P] Atualizar documentação OpenAPI / Swagger para todos os novos endpoints e tags em `src/server.ts`
- [ ] T043 Executar suíte completa de testes unitários e de integração (`npm test`) garantindo 100% de aprovação
- [ ] T044 Executar verificação estática de tipos estritos do TypeScript (`npm run typecheck`) garantindo zero erros de compilação
- [ ] T045 Executar roteiro prático do `quickstart.md` validando todos os cenários ponta a ponta

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: Sem dependências — execução imediata.
- **Phase 2 (Foundational)**: Depende da Phase 1 — **Bloqueia todas as histórias de usuário**.
- **Phase 3 (US1 - Deduções Fiscais)**: Depende da Phase 2 — MVP primordial.
- **Phase 4 (US2 - Orçamentos)**: Depende da Phase 2 — Pode ser executada em paralelo com a Phase 3.
- **Phase 5 (US3 - Multi-Mês)**: Depende da Phase 2.
- **Phase 6 (US4 - Investimentos)**: Depende da Phase 2.
- **Phase 7 (US5 - OCR de Comprovantes)**: Depende da Phase 3 (US1) e Phase 2.
- **Phase 8 (US6 - Painel PJ & Dossiê)**: Depende da Phase 3 (US1) e Phase 2.
- **Phase 9 (Polish)**: Depende de todas as fases anteriores concluídas.

---

## Implementation Strategy: MVP First

1. **Passo 1**: Concluir Phase 1 (Setup) e Phase 2 (Foundational).
2. **Passo 2**: Implementar **User Story 1** (Deduções Fiscais) e **User Story 2** (Orçamentos).
3. **Passo 3 (Validação MVP)**: Testar independentemente a triagem de despesas dedutíveis e os tetos orçamentários.
4. **Passo 4**: Avançar incrementalmente para US3 (Multi-mês), US4 (Investimentos), US5 (OCR) e US6 (PJ & Dossiê).
