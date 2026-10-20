# Feature Specification: Novas Categorias Canônicas e Exclusão Pontual de Transações

**Feature Branch**: `feature/008-categories-and-deletion`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Feature 008: Novas Categorias Canônicas (\"Pagamento de Fatura\" e \"Investimentos\") e Exclusão Pontual de Transações (specs/008-categories-and-deletion) conforme o ROADMAP.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Exclusão Pontual de Transação com Sincronização de Métricas (Priority: P1)

Como usuário da plataforma de gestão financeira, quero poder excluir permanentemente uma transação específica da minha conta (por exemplo, um lançamento duplicado, estornado ou indesejado) para que meu histórico de transações e minhas métricas financeiras reflitam com precisão a minha realidade.

**Why this priority**: A exclusão pontual é essencial para a integridade dos dados financeiros do usuário. Sem ela, lançamentos duplicados ou erros de extrato distorcem indefinidamente os totais de despesas, receitas e diagnósticos gerados pelo sistema.

**Independent Test**: Pode ser testado criando uma transação para o usuário autenticado, executando a solicitação de exclusão para o identificador dessa transação e verificando que a transação deixou de existir no histórico e que análises financeiras geradas posteriormente não computam mais o valor excluído.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado com uma transação existente associada à sua conta, **When** o usuário solicita a exclusão definitiva dessa transação pelo seu identificador, **Then** a transação é removida com sucesso do sistema e nenhuma informação da transação excluída permanece recuperável.
2. **Given** um usuário autenticado que acabou de excluir uma transação de despesa, **When** ele solicita o resumo financeiro ou análise do mês correspondente, **Then** as métricas e totais retornados são recalculados imediatamente, refletindo a subtração da transação excluída sem exibir valores em cache desatualizados.
3. **Given** um usuário autenticado, **When** o usuário tenta excluir uma transação informando um identificador inexistente, **Then** o sistema recusa a operação informando que a transação não foi encontrada.
4. **Given** dois usuários distintos A e B, onde a transação T pertence exclusivamente ao usuário B, **When** o usuário A tenta excluir a transação T, **Then** o sistema recusa a operação com status de não encontrado, garantindo isolamento total de dados e impedindo a exposição de existência do recurso alheio.
5. **Given** um usuário autenticado, **When** o usuário envia um identificador de transação em formato inválido ou malformado, **Then** o sistema rejeita a requisição com erro de validação claro.

---

### User Story 2 - Expansão de Categorias Canônicas para Faturas e Investimentos (Priority: P2)

Como usuário da plataforma, quero que o sistema reconheça nativamente as categorias "Pagamento de Fatura" e "Investimentos" tanto nas minhas edições manuais de transação quanto na classificação automática inteligente, para que liquidações de cartão de crédito e aportes patrimoniais sejam distinguidos com clareza de despesas rotineiras de consumo.

**Why this priority**: A ausência dessas categorias forçava os usuários a classificar faturas e investimentos em "Outros" ou "Não Categorizado", gerando ambiguidade e distorcendo a análise de gastos operacionais da vida financeira.

**Independent Test**: Pode ser testado atualizando manualmente uma transação existente para a categoria "Pagamento de Fatura" ou "Investimentos", e também submetendo descrições típicas (ex: "PAGTO FATURA CARTAO", "APORTE TESOURO DIRETO") ao motor de categorização inteligente para validar que a resposta atribui as categorias corretas.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado com uma transação cadastrada, **When** o usuário atualiza a categoria dessa transação para "Pagamento de Fatura" ou "Investimentos", **Then** a alteração é aceita com sucesso e persistida no sistema.
2. **Given** um conjunto de lançamentos contendo descrições de pagamento ou liquidação de fatura de cartão de crédito, **When** o processo de categorização inteligente é executado, **Then** as transações correspondentes são classificadas na categoria canônica "Pagamento de Fatura".
3. **Given** um conjunto de lançamentos contendo aportes em corretoras, títulos públicos ou fundos de investimento, **When** o processo de categorização inteligente é executado, **Then** as transações correspondentes são classificadas na categoria canônica "Investimentos".
4. **Given** um usuário autenticado, **When** ele tenta atualizar uma transação informando uma categoria que não pertença à lista canônica homologada, **Then** o sistema rejeita a alteração com erro de validação.

---

### User Story 3 - Consulta e Filtragem por Novas Categorias Canônicas (Priority: P3)

Como usuário da plataforma, quero poder listar e filtrar minhas transações selecionando especificamente as categorias "Pagamento de Fatura" e "Investimentos" para acompanhar o histórico segregado de quitação de cartões e alocações de capital.

**Why this priority**: Permite visibilidade imediata e auditoria detalhada dos lançamentos alocados nas novas categorias criadas.

**Independent Test**: Pode ser testado realizando uma busca de transações com o parâmetro de filtro de categoria definido como "Pagamento de Fatura" ou "Investimentos", verificando que apenas os registros correspondentes são retornados na listagem.

**Acceptance Scenarios**:

1. **Given** uma lista de transações com categorias variadas, **When** o usuário solicita a listagem filtrando pela categoria "Pagamento de Fatura", **Then** o sistema retorna exclusivamente as transações associadas a essa categoria.
2. **Given** uma lista de transações com categorias variadas, **When** o usuário solicita a listagem filtrando pela categoria "Investimentos", **Then** o sistema retorna exclusivamente as transações associadas a essa categoria.

---

### Edge Cases

- **Exclusão de transação inexistente**: Retornar status de recurso não encontrado (404) de forma amigável e segura.
- **Tentativa de exclusão com ID sintaticamente inválido**: Retornar status de erro de validação de parâmetro (400) sem executar consulta profunda de banco.
- **Exclusão concorrente**: Se duas solicitações de exclusão para o mesmo identificador forem disparadas simultaneamente, a primeira é processada com sucesso e a segunda retorna recurso não encontrado, mantendo a consistência do estado.
- **Invalidação de cache sem análises prévias**: Se o usuário excluir uma transação antes de gerar qualquer análise mensal de inteligência, o processo de invalidação de cache não deve disparar erros e deve concluir pacificamente.
- **Exclusão da última transação de um mês**: Se o usuário excluir a única transação existente em determinado mês, futuras solicitações de análise mensal para aquele mês devem reportar adequadamente a ausência de transações.
- **Descrições ambíguas no enriquecimento**: Caso uma descrição contenha termos genéricos que impeçam certeza na categorização automática de fatura ou investimento, o sistema deve manter o comportamento seguro de classificar como "Outros" ou "Não Categorizado".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE fornecer uma funcionalidade protegida para exclusão definitiva de uma transação individual a partir do identificador da transação fornecido pelo usuário autenticado.
- **FR-002**: O sistema DEVE validar o formato do identificador da transação na rota de exclusão, rejeitando identificadores inválidos antes de processar a operação no repositório.
- **FR-003**: O sistema DEVE aplicar isolamento multi-tenant rigoroso na exclusão de transações, garantindo que usuários só possam excluir transações de sua própria titularidade e retornando status de não encontrado caso a transação pertença a outro usuário.
- **FR-004**: O sistema DEVE invalidar imediatamente todo o cache de análises financeiras armazenado para o usuário sempre que uma transação for excluída, impedindo a exibição de relatórios ou agregações com dados defasados.
- **FR-005**: O sistema DEVE expandir a lista oficial de categorias canônicas do domínio financeiro para incluir obrigatoriamente as categorias `"Pagamento de Fatura"` e `"Investimentos"`, totalizando 11 categorias canônicas válidas.
- **FR-006**: O sistema DEVE aceitar as novas categorias canônicas em todas as operações de edição manual de categoria de transação (`PATCH /api/transactions/:id`).
- **FR-007**: O sistema DEVE aceitar as novas categorias canônicas nos parâmetros de filtragem de listagem de transações (`GET /api/transactions?category=...`).
- **FR-008**: O motor de inteligência artificial de categorização automática DEVE ser calibrado com instruções e esquemas estritos para reconhecer descrições de quitação/liquidação de fatura de cartão de crédito e classificá-las na categoria `"Pagamento de Fatura"`.
- **FR-009**: O motor de inteligência artificial de categorização automática DEVE ser calibrado com instruções e esquemas estritos para reconhecer descrições de aplicações financeiras, corretoras, títulos e ativos de investimento e classificá-las na categoria `"Investimentos"`.
- **FR-010**: A operação de exclusão bem-sucedida de transação DEVE confirmar a conclusão ao cliente com código de status HTTP 204 (No Content).

### Key Entities *(include if feature involves data)*

- **Transação**: Registro financeiro individual de receita ou despesa. Contém identificador único, proprietário (usuário), valor, data, descrição original, descrição limpa, categoria canônica, fonte de ingestão e conta bancária/cartão associada.
- **Categoria Canônica**: Enumeração fechada de classificações contábeis e orçamentárias reconhecidas pela plataforma. Composta por: Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Receita, Outros, Não Categorizado, Pagamento de Fatura e Investimentos.
- **Análise Financeira (Cache)**: Documento sumarizado gerado com métricas consolidadas (receita total, despesa total, taxa de poupança, categorias principais) e diagnóstico por IA, indexado por usuário e mês, sensível a invalidação quando ocorrem mutações (adição, edição ou exclusão) de transações.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuários autenticados conseguem excluir qualquer uma de suas transações com tempo de resposta da operação inferior a 300 milissegundos.
- **SC-002**: 100% das transações excluídas deixam de ser computadas de forma imediata em relatórios, consultas e métricas do dashboard do usuário.
- **SC-003**: 0% de vazamento de dados ou permissão indevida em tentativas de exclusão de transações entre contas de usuários distintos.
- **SC-004**: O motor de categorização inteligente alcança acurácia superior a 90% na classificação de descrições típicas de faturas e investimentos durante testes padronizados.
- **SC-005**: 100% de compatibilidade retroativa com os registros de transações já existentes no banco de dados, sem quebra de integridade de schemas ou falhas de leitura.

## Assumptions

- O usuário já se encontra devidamente autenticado via token JWT para invocar qualquer operação de leitura, mutação ou exclusão de transações.
- A exclusão pontual de uma transação é uma ação destrutiva definitiva (hard delete), não sendo necessário nesta fase criar mecanismo de lixeira ou restauração.
- A exclusão da transação afeta as métricas do mês em que ela ocorreu, exigindo invalidação do cache de análise para que o próximo acesso recomputar o estado fiel dos dados.
- O tratamento de métricas específicas para faturas de cartão (evitar duplicidade de despesas primárias na agregação geral) será modelado e refinado na Feature 009, permanecendo na Feature 008 a disponibilização canônica do tipo e a capacidade de exclusão direta de qualquer transação.
