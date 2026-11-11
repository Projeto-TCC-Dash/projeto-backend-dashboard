# Feature Specification: Tratamento Contábil Inteligente de Faturas na IA & Métricas

**Feature Branch**: `feature/009-invoice-accounting-ai`

**Created**: 2026-10-19

**Status**: Implemented

**Input**: User description: "Feature 009: Tratamento Contábil Inteligente de Faturas na IA & Métricas (specs/009-invoice-accounting-ai) conforme o ROADMAP.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Segregação Contábil de Faturas no Cálculo de Despesas Primárias (Priority: P1) 🎯 MVP

Como usuário que importa tanto o extrato bancário da conta corrente quanto a fatura do cartão de crédito, quero que o sistema não compute o "Pagamento de Fatura" como uma despesa operacional primária de consumo, para que meu total de despesas, gráficos de distribuição e taxa de poupança não sejam distorcidos por contagem dupla dos mesmos gastos.

**Why this priority**: A contagem dupla de despesas é a maior falha de integridade em plataformas de inteligência financeira pessoal quando o usuário importa extratos e cartões. Se o usuário gastou R$ 2.000 no cartão e paga a fatura de R$ 2.000 da conta corrente, o sistema somaria R$ 4.000 em despesas se não houver segregação contábil, invalidando qualquer diagnóstico financeiro.

**Independent Test**: Pode ser testado calculando as métricas de um conjunto de transações contendo compras individuais (ex: Alimentação R$ 800, Transporte R$ 200) e uma transação de liquidação da fatura (Pagamento de Fatura R$ 1.000). O total de despesas de consumo deve ser exatamente R$ 1.000 (e não R$ 2.000), e a categoria "Pagamento de Fatura" não deve constar como categoria primária de consumo no ranking de despesas.

**Acceptance Scenarios**:

1. **Given** transações registradas no mês contendo despesas individuais categorizadas (ex: Alimentação, Lazer) e uma transação categorizada como `"Pagamento de Fatura"`, **When** o sistema calcula as métricas financeiras consolidadas (`calculateMetrics`), **Then** o valor da fatura é segregado e NÃO é somado ao montante de despesas operacionais primárias (`totalExpenses`).
2. **Given** o cálculo da distribuição percentual e ranking das maiores despesas (`topCategories`), **When** as categorias são consolidadas, **Then** a categoria `"Pagamento de Fatura"` não entra na disputa de despesas operacionais, permitindo que as categorias reais de estilo de vida apareçam no topo.
3. **Given** um mês onde ocorrem receitas de R$ 5.000, despesas primárias de R$ 2.000 e liquidação de fatura de R$ 2.000, **When** o indicador de taxa de poupança (`savingsRate`) é calculado, **Then** a taxa reflete a relação entre receitas e despesas de consumo reais, evitando distorções punitivas duplicadas.
4. **Given** o cálculo de métricas consolidadas, **When** existirem transações de pagamento de fatura, **Then** o sistema reporta o montante total destinado a faturas em um campo próprio segregado (`invoiceSettlements`), garantindo total rastreabilidade do fluxo de caixa.

---

### User Story 2 - Diagnóstico Financeiro Consciente de Faturas na IA (Priority: P2)

Como usuário que solicita relatórios e diagnósticos à inteligência artificial, quero que o assistente Gemini compreenda explicitamente que transações de "Pagamento de Fatura" são transferências de liquidação de dívida/cartão e não novas compras, para que seus conselhos, feedbacks orçamentários e alertas sejam precisos e coerentes.

**Why this priority**: A IA analisa as transações para gerar diagnósticos mensais. Se ela interpretar o pagamento da fatura como uma compra adicional, dará conselhos equivocados (ex: "você gastou muito em pagamentos"), gerando desconfiança e frustração no usuário.

**Independent Test**: Pode ser testado injetando transações com pagamentos de fatura no prompt de diagnóstico e verificando que a IA instruída: (a) não classifica o pagamento de fatura como consumo supérfluo, (b) analisa os gastos detalhados das categorias de origem e (c) orienta sobre o fluxo de caixa considerando a liquidação como quitação de ciclo.

**Acceptance Scenarios**:

1. **Given** um conjunto de transações enviado para análise no motor Gemini, **When** o prompt de diagnóstico é processado, **Then** o modelo recebe diretrizes contábeis explícitas explicando que lançamentos em `"Pagamento de Fatura"` representam quitação de saldo rotativo/cartão e não devem ser interpretados como novo consumo primário.
2. **Given** um relatório gerado pela IA para um mês onde houve quitação integral de fatura, **When** as recomendações são apresentadas, **Then** o texto parabeniza ou orienta a manutenção do pagamento integral sem acusar o usuário de "gastar o dobro".

---

### User Story 3 - Resumo Mensal Alinhado no Assistente de Chat (Priority: P3)

Como usuário interagindo com o chatbot financeiro, quero perguntar "quanto eu gastei este mês?" e receber uma resposta transparente que diferencie o consumo realizado dos valores pagos em faturas, para planejar meu orçamento semanal com clareza.

**Why this priority**: O chat utiliza o resumo financeiro (`getMonthlyFinancialSummary`) como contexto de sistema. Esse resumo deve fornecer à LLM os valores decompostos para respostas imediatas sem ambiguidade.

**Independent Test**: Pode ser testado chamando `TransactionService.getMonthlyFinancialSummary` para um mês contendo pagamentos de fatura e verificando que o resumo exporta o total de despesas reais de consumo e segrega o total de faturas pagas.

**Acceptance Scenarios**:

1. **Given** uma requisição de resumo financeiro mensal para o chatbot, **When** o serviço agrega os dados do mês, **Then** o retorno inclui o montante de despesas primárias e informa o total de quitações de fatura de forma identificada.
2. **Given** uma conversa no chat questionando os gastos do mês, **When** a IA elabora a resposta, **Then** ela esclarece com precisão: "Seus gastos de consumo somaram R$ X, e você liquidou R$ Y em faturas de cartão".

---

### Edge Cases

- **Mês com apenas pagamento de fatura sem despesas detalhadas**: Caso o usuário tenha importado apenas o extrato da conta corrente e ainda não tenha submetido o extrato do cartão, o sistema deve manter as despesas primárias zeradas (ou indicar que o detalhamento da fatura não foi importado) e registrar a liquidação em `invoiceSettlements`.
- **Pagamento parcial de fatura**: O valor pago é tratado como liquidação do montante efetivamente amortizado, sem impactar o cálculo contábil das despesas individuais já lançadas.
- **Estorno ou crédito em fatura**: Se um valor de pagamento de fatura for positivo (estorno), deve abater proporcionalmente as liquidações de fatura.
- **Transações com categoria 'Investimentos'**: Devem continuar existindo e sendo computadas conforme o domínio patrimonial (alocação de capital), mantendo foco na segregação de faturas para o problema de duplicidade de consumo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE segregar transações categorizadas como `"Pagamento de Fatura"` no cálculo de métricas financeiras mensais (`AnalysisService.calculateMetrics`), excluindo seus valores do montante acumulado de despesas operacionais primárias (`totalExpenses`).
- **FR-002**: O sistema DEVE expor o valor total acumulado das liquidações de fatura no objeto de métricas financeiras através de um campo dedicado (ex: `invoiceSettlements`), preservando a visibilidade contábil completa do fluxo de saída de caixa.
- **FR-003**: O sistema DEVE excluir a categoria `"Pagamento de Fatura"` do cálculo e ordenação das maiores categorias de despesa de consumo (`topCategories`), garantindo que apenas categorias reais de gastos do usuário figurem no ranking.
- **FR-004**: O cálculo do percentual de cada categoria no ranking `topCategories` DEVE utilizar como denominador a soma das despesas operacionais primárias reais (`totalExpenses`), evitando que o percentual das categorias reais seja artificialmente diluído pelo pagamento da fatura.
- **FR-005**: O cálculo da taxa de poupança (`savingsRate`) DEVE basear-se na relação entre a receita total e as despesas operacionais primárias reais, prevenindo quedas artificiais no índice de poupança por conta da liquidação de faturas de compras já computadas.
- **FR-006**: O serviço de resumo mensal (`TransactionService.getMonthlyFinancialSummary`) DEVE segregar os pagamentos de fatura, fornecendo ao assistente de chat o valor das despesas de consumo desvinculado das liquidações de cartão.
- **FR-007**: As instruções de sistema da IA generativa em `GeminiService.generateFinancialDiagnosis` DEVEM conter regras contábeis explícitas instruindo o modelo a tratar `"Pagamento de Fatura"` como quitação de saldo rotativo e não como novo consumo.
- **FR-008**: O prompt do assistente de chat financeiro (`ChatService`) DEVE receber a instrução de distinguir despesas de consumo de liquidações de fatura ao responder ao usuário sobre gastos e orçamento.

### Key Entities *(include if feature involves data)*

- **Métricas Financeiras (`IFinancialMetrics`)**: Estrutura de dados contendo `totalIncome`, `totalExpenses` (despesas primárias de consumo, sem faturas duplicadas), `invoiceSettlements` (montante total pago em faturas de cartão no período), `netBalance`, `savingsRate` e `topCategories`.
- **Resumo Financeiro Mensal**: Objeto contextual injetado no assistente conversacional contendo totais de receita, despesas primárias, liquidação de faturas e discriminação por categoria.
- **Diretrizes Contábeis da IA**: Conjunto de instruções semânticas no prompt do Gemini estabelecendo o princípio da não-duplicação de despesas na análise de faturas de cartão de crédito.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0% de duplicidade na contagem de despesas operacionais quando usuários importam extrato bancário e faturas de cartão no mesmo período de faturamento.
- **SC-002**: 100% dos diagnósticos gerados pela IA identificam corretamente pagamentos de fatura como liquidações de passivo, sem classificar a quitação do cartão como consumo adicional.
- **SC-003**: 100% de consistência entre os totais apresentados nos endpoints de análise (`/api/analysis/:month`) e os números reportados pelo assistente conversacional (`/api/chat`).
- **SC-004**: 100% de compatibilidade retroativa com clientes e contratos de API existentes, permitindo que campos novos de segregação contábil sejam adicionados sem quebrar esquemas legados.

## Assumptions

- O usuário categoriza a quitação da fatura na conta corrente como `"Pagamento de Fatura"` (seja manualmente ou via classificação automática calibrada na Feature 008).
- As despesas individuais do cartão de crédito continuam sendo categorizadas em suas categorias finais de destino (ex: Alimentação, Lazer, etc.).
- A segregação contábil atua exclusivamente na camada de consolidação de métricas e raciocínio de inteligência artificial, mantendo todos os registros individuais de transações intactos no banco de dados.
