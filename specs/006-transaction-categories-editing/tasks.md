# Tasks: Categorias Canônicas, Edição Manual de Transações e Configuração de Seed

**Input**: Design artifacts from `specs/006-transaction-categories-editing/` (`spec.md`, `plan.md`, `data-model.md`, `research.md`, `contracts/`, `quickstart.md`)  
**Status**: Ready for Implementation

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificação de dependências compartilhadas e estrutura de arquivos do projeto

- [X] T001 Verificar compatibilidade de dependências e tipagens para suporte a novos esquemas de transação em `package.json` e `src/config/constants.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Estruturas centrais e esquemas de dados compartilhados que bloqueiam a implementação das histórias de usuário

**⚠️ CRITICAL**: Nenhuma tarefa das histórias de usuário pode ser iniciada antes da conclusão desta fase.

- [X] T002 Atualizar a lista `CANONICAL_CATEGORIES` para `['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Educação', 'Receita', 'Outros', 'Não Categorizado']` e definir `SYSTEM_DEFAULTS.DEFAULT_CATEGORY` como `'Não Categorizado'` em `src/config/constants.ts`
- [X] T003 [P] Atualizar o enum de categorias do Mongoose `TransactionSchema` para `CANONICAL_CATEGORIES` com default `'Não Categorizado'` em `src/models/transaction.model.ts`
- [X] T004 [P] Criar esquemas Zod `UpdateTransactionBodySchema` (com `category` em `CategoryEnum`, `cleanDescription` min 1 max 255 caracteres, e refinamento exigindo ao menos um campo) e `TransactionIdParamSchema` (regex `/^[0-9a-fA-F]{24}$/`) em `src/schemas/transaction.schemas.ts`

**Checkpoint**: Base de dados e tipagens canônicas prontas - implementação das histórias de usuário desbloqueada.

---

## Phase 3: User Story 1 - Edição Manual de Transações (Priority: P1) 🎯 MVP

**Goal**: Permitir ao usuário autenticado atualizar parcialmente uma transação individual via `PATCH /api/transactions/:id` (categoria e/ou cleanDescription) com isolamento multi-tenant estrito e validação Zod.

**Independent Test**: Enviar requisição `PATCH /api/transactions/:id` com nova categoria válida e descrição limpa; verificar resposta HTTP 200 com os dados atualizados; verificar respostas HTTP 404 (transação inexistente ou de outro usuário) e HTTP 400 (corpo vazio, categoria inválida ou ID malformado).

### Tests for User Story 1

- [X] T005 [P] [US1] Criar testes de integração para a rota `PATCH /api/transactions/:id` cobrindo sucesso (200), isolamento multi-tenant (404), categoria inválida (400), payload vazio (400) e ID malformado (400) em `tests/integration/transactions.routes.test.ts`

### Implementation for User Story 1

- [X] T006 [US1] Implementar método `TransactionService.updateTransaction(userId: string, transactionId: string, updateData: UpdateTransactionBody)` utilizando `findOneAndUpdate` filtrado por `{ _id: transactionObjectId, userId: userObjectId }` com retorno do documento atualizado em `src/services/transaction.service.ts`
- [X] T007 [US1] Implementar rota `PATCH /api/transactions/:id` com `preHandler: [requireAuth]`, validação Zod de params, body e response, respondendo 200 no sucesso ou 404 com `{ statusCode: 404, error: 'Not Found', message: 'Transação não encontrada ou acesso não autorizado' }` em `src/routes/transactions.routes.ts`

**Checkpoint**: User Story 1 funcional e testável de forma 100% independente (MVP atingido).

---

## Phase 4: User Story 2 - Categoria Padrão Inicial "Não Categorizado" para Extratos Importados (Priority: P2)

**Goal**: Garantir que novas transações ingeridas via upload (.ofx e .csv) recebam a categoria inicial `"Não Categorizado"` e que a busca por estabelecimentos pendentes de categorização inteligente por IA filtre exclusivamente lançamentos com categoria `"Não Categorizado"`.

**Independent Test**: Fazer upload de extrato CSV/OFX e verificar que as novas transações registradas possuem `category: "Não Categorizado"`; invocar `POST /api/transactions/categorize` e validar que apenas itens em `"Não Categorizado"` são processados.

### Tests for User Story 2

- [X] T008 [P] [US2] Criar testes automatizados para verificar que a importação de extrato define `category: "Não Categorizado"` e que `getUniqueUncategorizedMerchants` busca transações em `"Não Categorizado"` em `tests/integration/categorization.routes.test.ts`

### Implementation for User Story 2

- [X] T009 [US2] Atualizar `TransactionService.importTransactions` para garantir `$setOnInsert` com `SYSTEM_DEFAULTS.DEFAULT_CATEGORY` (`'Não Categorizado'`) e atualizar `TransactionService.getUniqueUncategorizedMerchants` para filtrar por `SYSTEM_DEFAULTS.DEFAULT_CATEGORY` em `src/services/transaction.service.ts`
- [X] T010 [US2] Atualizar o prompt do sistema e o schema de retorno estruturado no método `GeminiService.categorizeMerchants` para incluir as categorias canônicas vigentes em `src/services/gemini.service.ts`

**Checkpoint**: Extratos importados nascem em "Não Categorizado" e integram-se perfeitamente com o fluxo de IA.

---

## Phase 5: User Story 3 - Suporte à Categoria Canônica "Receita" (Priority: P2)

**Goal**: Garantir suporte integral à categoria `"Receita"` em consultas filtradas por querystring, agregações de resumo financeiro e persistência manual ou automatizada.

**Independent Test**: Atualizar uma transação para `"Receita"` e consultar `GET /api/transactions?category=Receita`, confirmando que a transação é retornada e que totais mensais agregam receitas corretamente.

### Tests for User Story 3

- [X] T011 [P] [US3] Criar testes de integração para listagem de transações filtradas por `category=Receita` e verificação da soma de receitas em `tests/integration/transactions.routes.test.ts`

### Implementation for User Story 3

- [X] T012 [US3] Ajustar cômputo e agregação no método `TransactionService.getMonthlyFinancialSummary` para garantir que categorias de receita e despesa sejam contabilizadas sem conflito em `src/services/transaction.service.ts`

**Checkpoint**: Lançamentos de entrada financeira formalmente suportados como categoria canônica "Receita".

---

## Phase 6: User Story 4 - Documentação de Configuração do Ambiente de Teste e Seed (Priority: P3)

**Goal**: Documentar explicitamente a variável `GOOGLE_GENERATIVE_AI_API_KEY` no `.env.example` com comentários claros sobre seu uso opcional para o script `npm run seed`.

**Independent Test**: Inspecionar o arquivo `.env.example` e executar o seed com e sem a variável definida para validar seu comportamento resiliente.

### Tests for User Story 4

- [X] T013 [P] [US4] Adicionar asserção em teste de integração do seed verificando execução bem-sucedida com e sem `GOOGLE_GENERATIVE_AI_API_KEY` em `tests/integration/seed.test.ts`

### Implementation for User Story 4

- [X] T014 [US4] Documentar a variável `GOOGLE_GENERATIVE_AI_API_KEY` em `.env.example` com comentários explicativos sobre preenchimento opcional para testes locais e pré-aquecimento de cache pelo seed

**Checkpoint**: Documentação de onboarding e seed local completa e clara para novos operadores.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validação de regressão, conformidade de tipos e integridade da suíte de testes

- [X] T015 [P] Atualizar expectativas do teste unitário de categorização para o fallback `'Não Categorizado'` em `tests/unit/categorization.test.ts`
- [X] T016 Executar suíte completa de testes unitários e de integração via `npm test` para garantir 100% de aprovação sem regressões
- [X] T017 Executar verificação estática de tipos via `npm run typecheck` para garantir conformidade estrita do TypeScript sem `any`
- [X] T018 Executar os cenários de validação ponta a ponta descritos no guia em `specs/006-transaction-categories-editing/quickstart.md`
- [X] T019 [P] Atualizar README.md documentando a rota PATCH /api/transactions/:id, a categoria 'Receita', o estado inicial 'Não Categorizado' e a variável GOOGLE_GENERATIVE_AI_API_KEY

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências externas - início imediato.
- **Foundational (Phase 2)**: Depende da Phase 1 - **BLOQUEIA** todas as histórias de usuário.
- **User Story 1 (Phase 3)**: Depende da conclusão da Phase 2. Pode ser entregue como MVP independente.
- **User Story 2 (Phase 4)**: Depende da Phase 2. Independente de US1, mas compartilha `TransactionService`.
- **User Story 3 (Phase 5)**: Depende da Phase 2 e beneficia-se do endpoint de US1 para testes ponta a ponta.
- **User Story 4 (Phase 6)**: Depende da Phase 1. Pode ser executada em paralelo com as histórias de usuário.
- **Polish (Phase 7)**: Depende da conclusão de todas as histórias de usuário desejadas.

### User Story Dependencies

```text
Phase 1: Setup (T001)
         │
Phase 2: Foundational: Constants, Model & Schemas (T002, T003, T004)
         │
         ├───────────────────────┬───────────────────────┬───────────────────────┐
         ▼                       ▼                       ▼                       ▼
Phase 3: US1 (P1) 🎯 MVP   Phase 4: US2 (P2)       Phase 5: US3 (P2)       Phase 6: US4 (P3)
Edição Manual PATCH       Default Não Categorizado Categoria Receita       .env.example & Seed
(T005, T006, T007)        (T008, T009, T010)      (T011, T012)            (T013, T014)
         │                       │                       │                       │
         └───────────────────────┴───────────────────────┴───────────────────────┘
                                         │
                                         ▼
                            Phase 7: Polish & CI Verification
                            (T015, T016, T017, T018)
```

---

## Parallel Opportunities

- **Phase 2 (Foundational)**: `T003` (Mongoose Model) e `T004` (Zod Schemas) podem ser executadas em paralelo após `T002`.
- **Phase 3 (US1)**: O teste `T005` pode ser escrito em paralelo com a definição de contratos.
- **Phase 4 & 5 (US2 & US3)**: Os testes `T008` e `T011` podem rodar em paralelo.
- **Phase 6 (US4)**: `T013` e `T014` podem ser desenvolvidas em paralelo a qualquer momento após Phase 1.
- **Phase 7 (Polish)**: `T015` pode ser ajustada em paralelo antes da execução de `T016` e `T017`.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Concluir Phase 1 (Setup) e Phase 2 (Foundational: constantes, modelo e esquemas Zod).
2. Concluir Phase 3 (User Story 1: testes de integração, método no serviço e rota `PATCH /api/transactions/:id`).
3. **VALIDAÇÃO MVP**: Executar `npm test tests/integration/transactions.routes.test.ts` e confirmar edição manual com isolamento multi-tenant funcional.

### Incremental Delivery

1. Setup + Foundational concluídos → Taxonomia base pronta para 9 categorias.
2. US1 concluída → Edição manual de lançamentos entregue (MVP).
3. US2 concluída → Extratos importados nascem em "Não Categorizado" e alimentam a IA.
4. US3 concluída → Categoria "Receita" validada em filtros e relatórios consolidados.
5. US4 concluída → `.env.example` documentado e validado com o script de seed.
6. Polish → Regressão completa com `npm test` e `npm run typecheck`.
