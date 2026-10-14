# Feature Specification: Categorias Canônicas, Edição Manual de Transações e Configuração de Seed

**Feature Branch**: `006-transaction-categories-editing`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Adicionar categoria canônica 'Receita' e categoria padrão inicial 'Não Categorizado' para extratos importados, permitir edição manual de transações via PATCH /api/transactions/:id, e documentar GOOGLE_GENERATIVE_AI_API_KEY no .env.example para o seed."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edição Manual de Transações (Priority: P1)

Como usuário da plataforma financeira, desejo editar manualmente os dados de uma transação bancária individual (em especial sua categoria e descrição amigável), para que eu possa corrigir classificações imprecisas e manter meus lançamentos fiéis à minha realidade financeira.

**Why this priority**: A capacidade de corrigir ou redefinir categorias e descrições é o núcleo da gestão financeira pessoal. Sem a edição manual, qualquer classificação inadequada prejudica permanentemente os relatórios e a confiança do usuário no dashboard.

**Independent Test**: Pode ser testado de forma totalmente autônoma enviando uma requisição de atualização parcial (`PATCH /api/transactions/:id`) para uma transação existente com nova categoria e nova descrição amigável, confirmando que os novos valores foram persistidos e retornados imediatamente.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado proprietário de uma transação existente, **When** ele envia uma solicitação para atualizar a categoria da transação para uma categoria canônica válida (ex: "Receita" ou "Alimentação") e a descrição limpa, **Then** o sistema atualiza a transação com sucesso e retorna os dados atualizados com confirmação imediata.
2. **Given** um usuário autenticado tentando editar uma transação, **When** ele submete um identificador de transação inexistente ou pertencente a outro usuário, **Then** o sistema rejeita a operação com erro de recurso não encontrado, garantindo isolamento estrito entre usuários.
3. **Given** um usuário autenticado tentando editar uma transação, **When** ele submete uma categoria não reconhecida pelo catálogo canônico do sistema, **Then** o sistema rejeita a solicitação com erro de validação e informa as categorias aceitas.

---

### User Story 2 - Categoria Padrão Inicial "Não Categorizado" para Extratos Importados (Priority: P2)

Como usuário que realiza upload de extratos bancários (OFX ou CSV), desejo que as transações recém-importadas nasçam com a categoria inicial "Não Categorizado", para que eu possa distinguir imediatamente no dashboard e nos filtros quais lançamentos ainda aguardam classificação automática por IA ou revisão manual.

**Why this priority**: Substituir o valor padrão anterior ("Outros") por "Não Categorizado" elimina a ambiguidade entre despesas genéricas propositais ("Outros") e despesas pendentes de análise ("Não Categorizado"), tornando o fluxo de enriquecimento e categorização transparente e auditável.

**Independent Test**: Pode ser testado importando um arquivo de extrato bancário (OFX ou CSV) válido e verificando que todas as novas transações persistidas no banco possuem o valor "Não Categorizado" no campo de categoria.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado importando um extrato bancário com novas transações, **When** o processamento da importação é concluído, **Then** todas as transações inseridas são registradas com a categoria padrão "Não Categorizado".
2. **Given** transações com categoria "Não Categorizado" no banco de dados, **When** o usuário aciona o serviço de categorização inteligente via IA, **Then** o sistema seleciona exclusivamente esses lançamentos pendentes para envio ao motor de classificação.

---

### User Story 3 - Suporte à Categoria Canônica "Receita" (Priority: P2)

Como usuário que possui recebimentos de salários, transferências de entrada, proventos e rendimentos em seu extrato, desejo que o sistema reconheça a categoria canônica "Receita", para que entradas financeiras não sejam classificadas como despesas ou desvirtuem as categorias de gastos.

**Why this priority**: Um sistema financeiro necessita segregar receitas de gastos para cálculo preciso de fluxo de caixa, orçamento e análise de saldo. "Receita" é um pilar canônico essencial.

**Independent Test**: Pode ser testado atribuindo a categoria "Receita" a transações via edição manual ou categorização e filtrando lançamentos por categoria "Receita", validando o cômputo e agregação corretos.

**Acceptance Scenarios**:

1. **Given** uma transação bancária positiva ou de entrada financeira, **When** o usuário ou a IA atribui a categoria "Receita", **Then** o sistema valida e aceita a transação como válida sob a categoria canônica "Receita".
2. **Given** uma consulta de transações filtrada pela categoria "Receita", **When** o usuário solicita a listagem, **Then** o sistema retorna apenas as transações classificadas como "Receita".

---

### User Story 4 - Documentação de Configuração do Ambiente de Teste e Seed (Priority: P3)

Como desenvolvedor ou operador configurando o projeto localmente, desejo consultar o arquivo de modelo de variáveis de ambiente (`.env.example`) e visualizar as orientações para preencher a chave `GOOGLE_GENERATIVE_AI_API_KEY` usada no seed, para que eu possa executar a geração sintética de dados e o pré-aquecimento de análises financeiras sem dúvidas sobre configuração.

**Why this priority**: A documentação clara das configurações de ambiente previne falhas na inicialização de desenvolvedores, reduz atritos de onboarding e assegura que scripts utilitários funcionem conforme o esperado.

**Independent Test**: Pode ser testado inspecionando o arquivo `.env.example` e confirmando a presença da variável documentada com texto explicativo e instruções de uso.

**Acceptance Scenarios**:

1. **Given** o arquivo `.env.example` do projeto, **When** um desenvolvedor o inspeciona, **Then** o arquivo exibe a variável `GOOGLE_GENERATIVE_AI_API_KEY` devidamente comentada, indicando sua finalidade opcional para o script de seed e instruções para obtenção no Google AI Studio.

---

### Edge Cases

- **Tentativa de atualização com corpo vazio**: Se o usuário enviar uma requisição de atualização sem nenhum campo no corpo (`{}`), o sistema deve retornar erro de validação indicando que ao menos um campo editável deve ser fornecido.
- **Tentativa de manipulação de campos imutáveis**: Se a requisição contiver campos protegidos como `id`, `userId`, `externalId`, `amount`, `date` ou `source`, o sistema deve ignorá-los ou rejeitar a requisição com validação de esquema estrita, impedindo violações de auditoria contábil.
- **Reimportação de extrato já importado e editado**: Quando um usuário importar novamente um extrato contendo transações já salvas e que foram manualmente editadas pelo usuário, o sistema deve preservar a categoria e dados previamente alterados, não sobrescrevendo-os com "Não Categorizado".
- **Identificador de transação em formato inválido**: Se o usuário fornecer um identificador na rota que não corresponda ao formato padrão do identificador de objeto do banco, o sistema deve responder com erro de validação (HTTP 400) em vez de falha interna (HTTP 500).
- **Execução do seed sem a chave de IA**: Se o desenvolvedor rodar o script de seed sem a variável `GOOGLE_GENERATIVE_AI_API_KEY` preenchida no arquivo `.env`, o seed deve executar com sucesso todas as etapas locais determinísticas (criação de usuário e geração de dados sintéticos), emitindo apenas um aviso informativo sobre a não execução do pré-aquecimento da IA.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE incluir "Receita" na lista oficial de categorias canônicas reconhecidas pela plataforma.
- **FR-002**: O sistema DEVE incluir "Não Categorizado" na lista oficial de categorias canônicas reconhecidas pela plataforma como marcador de transação pendente de classificação.
- **FR-003**: O sistema DEVE definir "Não Categorizado" como a categoria padrão inicial atribuída a qualquer nova transação extraída e persistida a partir de extratos bancários (.ofx e .csv).
- **FR-004**: O sistema DEVE disponibilizar uma rota protegida `PATCH /api/transactions/:id` acessível exclusivamente por usuários autenticados via JWT.
- **FR-005**: A rota de atualização parcial DEVE validar os dados recebidos via esquema estrito, permitindo a edição dos campos `category` (restrito às categorias canônicas vigentes) e `cleanDescription` (texto não vazio).
- **FR-006**: A rota de atualização parcial DEVE validar o formato do identificador da transação fornecido no parâmetro da URL, retornando erro de requisição inválida caso esteja em formato incompatível.
- **FR-007**: O sistema DEVE aplicar isolamento multi-tenant estrito na edição de transações: caso a transação solicitada pertença a outro usuário ou não exista, o sistema DEVE retornar status de recurso não encontrado (HTTP 404).
- **FR-008**: O processo de importação de extratos DEVE manter a garantia de idempotência, assegurando que o reenvio de transações pré-existentes não altere a categoria ou descrição de transações que o usuário tenha previamente editado.
- **FR-009**: O mecanismo de seleção de estabelecimentos para categorização inteligente via IA DEVE buscar prioritariamente lançamentos com a categoria "Não Categorizado" (em substituição ao antigo filtro por "Outros").
- **FR-010**: O arquivo `.env.example` DEVE conter a declaração da variável `GOOGLE_GENERATIVE_AI_API_KEY` com comentários explicativos sobre sua utilização opcional para vinculação de usuário e pré-aquecimento de análise no script de seed local.

### Key Entities

- **Transação Bancária**: Representa um lançamento financeiro individual associado a um usuário específico.
  - *Identificador*: Identificador único da transação no sistema.
  - *Identificador de Usuário*: Referência ao titular da transação (isolamento multi-tenant).
  - *Identificador Externo*: Código único de conciliação bancária do extrato.
  - *Descrição Bruta*: Texto original contido no arquivo de extrato.
  - *Descrição Limpa*: Texto sanitizado e editável representando o nome amigável do lançamento ou estabelecimento comercial.
  - *Valor*: Montante monetário da transação.
  - *Data*: Timestamp de ocorrência do lançamento financeiro.
  - *Categoria*: Categoria canônica associada ao lançamento (ex: Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Receita, Outros, Não Categorizado).
  - *Origem*: Identificador do canal de ingestão (OFX, CSV ou SEED).

- **Catálogo de Categorias Canônicas**: Vocabulário controlado e padronizado contendo o conjunto exato de categorias aceitas pelo sistema:
  - `Alimentação`
  - `Transporte`
  - `Moradia`
  - `Saúde`
  - `Lazer`
  - `Educação`
  - `Receita`
  - `Outros`
  - `Não Categorizado`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos novos lançamentos bancários ingeridos via upload de extratos (.ofx e .csv) são registrados inicialmente sob a categoria "Não Categorizado".
- **SC-002**: Uma requisição válida de edição de transação via `PATCH /api/transactions/:id` é processada e confirmada pelo sistema em menos de 500 milissegundos.
- **SC-003**: 100% das tentativas de acesso ou alteração em transações de terceiros são bloqueadas, sem qualquer vazamento de metadados ou alteração de dados entre usuários (isolamento de 100%).
- **SC-004**: O reenvio de um arquivo de extrato já importado preserva 100% das categorias e descrições personalizadas manualmente pelo usuário.
- **SC-005**: 100% dos novos desenvolvedores conseguem identificar as variáveis de ambiente necessárias para o seed local e IA a partir da leitura direta do `.env.example`.
- **SC-006**: A categorização manual e por IA suporta todas as 9 categorias canônicas definidas, incluindo "Receita" e "Não Categorizado".

## Assumptions

- **Campos Editáveis na Edição Manual**: A edição de transações via `PATCH /api/transactions/:id` restringe-se primariamente aos campos `category` e `cleanDescription`. Campos contábeis de auditoria bancária (`amount`, `date`, `rawDescription`, `externalId`, `source`) são mantidos inalterados na edição manual padrão para preservar a integridade histórica dos extratos originais.
- **Comportamento de "Não Categorizado"**: A categoria "Não Categorizado" atua simultaneamente como o marcador inicial de novas importações e como uma categoria canônica formalmente válida na tipagem do sistema, permitindo que o usuário reverta uma transação a esse estado se desejar reavaliá-la futuramente.
- **Preservação de Dados no Seed**: O script de geração de massa de dados sintéticos (`seed.ts`) continuará gerando transações com categorias preenchidas representativas (para fins de demonstração instantânea do dashboard e gráficos), mas a suite de testes de extratos testará o fluxo de novas importações que nascem em "Não Categorizado".
- **Opcionalidade da Chave no Seed**: A variável `GOOGLE_GENERATIVE_AI_API_KEY` no `.env.example` é estritamente opcional para o funcionamento básico da aplicação e do seed local, mantendo a conformidade com a Constituição (Princípio V - 100% autônomo localmente sem rede, e Princípio III - BYOK).
