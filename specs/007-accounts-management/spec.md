# Feature Specification: Gestão de Contas Bancárias e Cartões

**Feature Branch**: `007-accounts-management`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Feature 007: Gestão de Contas Bancárias e Cartões (specs/007-accounts-management) conforme o ROADMAP.md"

## Clarifications

### Session 2026-10-19
- Q: O endpoint de edição de transações (`PATCH /api/transactions/:id`) deve permitir alterar a conta à qual a movimentação pertence (`accountId`)? → A: Sim, o campo `accountId` é editável via `PATCH /api/transactions/:id`, validando se a nova conta existe e pertence ao mesmo usuário autenticado.
- Q: As contas devem possuir um campo opcional de saldo inicial (`initialBalance`), ou o saldo da conta deve ser calculado estritamente a partir da soma de suas transações? → A: Incluir campo opcional `initialBalance` (número decimal, padrão `0`), que é somado ao total de transações para compor o saldo consolidado da conta.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Criação e Listagem de Contas Financeiras com Resumo de Saldo (Priority: P1)

Como usuário da plataforma de finanças pessoais, desejo cadastrar minhas contas financeiras (conta corrente, poupança, cartão de crédito, investimentos, dinheiro ou outros) com nome amigável, instituição, cor temática e saldo inicial opcional, e visualizar uma listagem consolidada de todas as minhas contas ativas com seus respectivos saldos e contagem de transações, para que eu tenha visibilidade segmentada do meu patrimônio e fontes de gasto.

**Why this priority**: A criação e listagem de contas é o alicerce fundamental para viabilizar o suporte a múltiplas instituições no sistema. Sem essa capacidade, o usuário permanece limitado a uma visão genérica e indiferenciada de suas transações.

**Independent Test**: Pode ser testado de forma independente criando uma nova conta através da interface de serviços de contas e em seguida listando as contas do usuário, verificando que os dados cadastrados, a contagem de transações associadas e o resumo financeiro de saldo refletem fielmente a realidade.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** ele solicita a criação de uma conta informando nome (ex: "Nubank Principal"), tipo válido (ex: conta corrente), saldo inicial opcional (ex: 1500.00) e cor preferida, **Then** o sistema registra a nova conta vinculada exclusivamente àquele usuário e retorna os dados cadastrados com confirmação imediata.
2. **Given** um usuário com múltiplas contas cadastradas e transações associadas, **When** ele solicita a listagem de suas contas, **Then** o sistema retorna todas as contas ativas do usuário, exibindo para cada conta seu saldo total consolidado (saldo inicial somado ao balanço das transações vinculadas) e a contagem total de lançamentos vinculados.
3. **Given** um usuário autenticado tentando criar uma conta, **When** ele fornece um nome duplicado já existente em sua lista de contas ativas, **Then** o sistema rejeita a operação com erro de conflito, orientando o usuário a escolher um nome exclusivo.

---

### User Story 2 - Atualização e Edição de Propriedades da Conta (Priority: P2)

Como usuário da plataforma, desejo atualizar as propriedades de uma conta existente (como renomear de "Nubank" para "Nubank Reserva", modificar o tipo de conta, atualizar a instituição bancária ou alterar sua cor), para que eu possa ajustar a identificação visual e a classificação das minhas contas conforme minha rotina evolui.

**Why this priority**: Permite flexibilidade de gestão e correção de cadastros sem a necessidade de recriar contas e perder vínculos com transações já registradas.

**Independent Test**: Pode ser testado enviando uma solicitação de atualização para uma conta específica existente com novos valores para nome e cor, confirmando que a listagem subsequente reflete imediatamente os dados alterados.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado proprietário de uma conta, **When** ele altera o nome da conta e sua cor de exibição, **Then** o sistema persiste as alterações e retorna os dados atualizados da conta.
2. **Given** um usuário tentando alterar uma conta, **When** ele submete um identificador de conta inexistente ou pertencente a outro usuário, **Then** o sistema recusa a operação com notificação de recurso não encontrado, garantindo isolamento estrito entre usuários.
3. **Given** um usuário autenticado alterando uma conta, **When** ele tenta renomeá-la para um nome que já pertence a outra de suas contas ativas, **Then** o sistema impede a alteração e sinaliza o conflito de nomenclatura.

---

### User Story 3 - Exclusão Segura de Contas Financeiras (Priority: P2)

Como usuário da plataforma, desejo excluir contas financeiras que não pretendo mais utilizar, garantindo que o sistema trate de forma segura e explícita eventuais transações históricas que estejam associadas à conta a ser removida.

**Why this priority**: Manutenção da integridade histórica e prevenção de exclusão acidental de lançamentos financeiros críticos para relatórios e análises de longo prazo.

**Independent Test**: Pode ser testado tentando excluir uma conta sem transações (exclusão direta bem-sucedida) e testando a exclusão de uma conta com transações associadas de acordo com a política de segurança homologada.

**Acceptance Scenarios**:

1. **Given** um usuário proprietário de uma conta que não possui nenhuma transação associada, **When** ele solicita a exclusão da conta, **Then** o sistema remove a conta definitivamente e confirma a exclusão com sucesso.
2. **Given** um usuário solicitando a exclusão de uma conta que possui transações ativas vinculadas sem confirmação explícita de cascata, **When** a solicitação é processada pelo sistema, **Then** o sistema bloqueia a exclusão com status de conflito (HTTP 409) informando a existência de lançamentos associados.
3. **Given** um usuário solicitando a exclusão de uma conta com transações associadas e fornecendo confirmação explícita de cascata (`?cascade=true`), **When** a solicitação é processada, **Then** o sistema remove de forma atômica e definitiva a conta e todas as suas transações vinculadas.
4. **Given** um usuário tentando excluir uma conta inexistente ou pertencente a terceiro, **When** ele envia a solicitação, **Then** o sistema retorna erro informando que o recurso não foi localizado.

---

### User Story 4 - Associação de Transações e Importação de Extratos por Conta (Priority: P1)

Como usuário que importa extratos bancários (OFX ou CSV), desejo que os lançamentos importados sejam atribuídos à conta bancária correta, para que as movimentações de cartões e contas correntes diferentes fiquem organizadas e segregadas de forma precisa no painel financeiro.

**Why this priority**: A vinculação correta no momento da ingestão garante que o saldo de cada instituição e a conciliação bancária funcionem sem necessidade de intervenção manual transação por transação.

**Independent Test**: Pode ser testado importando um extrato indicando a conta de destino e confirmando que todas as novas transações geradas no sistema passam a referenciar essa conta específica, incrementando seu saldo e contagem de lançamentos.

**Acceptance Scenarios**:

1. **Given** um usuário com uma conta financeira cadastrada, **When** ele realiza o upload de um extrato associando expressamente o identificador dessa conta, **Then** todas as transações importadas válidas são persistidas com vínculo direto à conta informada.
2. **Given** um usuário realizando o upload de um extrato (OFX ou CSV) sem informar previamente um identificador de conta de destino, **When** o processamento é iniciado, **Then** o sistema associa automaticamente todos os lançamentos importados à "Conta Principal" padrão do usuário como fallback seguro.
3. **Given** um usuário tentando importar um extrato associando um identificador de conta pertencente a outro usuário ou inexistente, **When** a validação da importação é executada, **Then** o sistema rejeita a operação com erro de validação antes de processar o arquivo.
4. **Given** um usuário autenticado editando uma transação existente via atualização parcial, **When** ele altera o campo de conta (`accountId`) para outra conta válida de sua propriedade, **Then** o sistema atualiza o vínculo da transação para a nova conta e reflete a alteração no saldo de ambas as contas.

---

### User Story 5 - Provisionamento de Conta Padrão para Compatibilidade Histórica (Priority: P3)

Como usuário que já possui transações cadastradas antes da introdução do suporte a múltiplas contas (ou novo usuário recém-registrado), desejo que o sistema garanta automaticamente a existência de uma "Conta Principal" padrão, para que nenhuma transação fique órfã ou invisível nos relatórios e filtros.

**Why this priority**: Garante retrocompatibilidade contínua e sem atritos com dados existentes, prevenindo quebras em transações pré-existentes da base.

**Independent Test**: Pode ser testado verificando que um usuário recém-criado ou com dados preexistentes sem conta associada possui automaticamente uma "Conta Principal" ativa e que suas transações órfãs são vinculadas a ela.

**Acceptance Scenarios**:

1. **Given** um usuário existente com transações que não possuem conta associada, **When** o serviço de contas é inicializado ou consultado, **Then** o sistema assegura a criação de uma conta padrão denominada "Conta Principal" (tipo conta corrente) e associa as transações legadas a ela.
2. **Given** um novo usuário registrando-se na plataforma, **When** sua conta de usuário é criada, **Then** o sistema provisiona automaticamente sua "Conta Principal" inicial para uso imediato em importações.

---

### Edge Cases

- **Criação de conta com espaços em branco no nome**: Se o usuário enviar um nome contendo apenas espaços ou com espaços extras nas extremidades, o sistema deve sanitizar a string e rejeitar nomes vazios.
- **Formato inválido de cor hexadecimal**: Se o usuário fornecer uma cor fora do formato hexadecimal válido (ex: não correspondente a `#RRGGBB`), o sistema deve retornar erro de validação.
- **Exclusão da Conta Principal do usuário**: O sistema deve impedir a exclusão da "Conta Principal" padrão se ela for a única conta restante do usuário, garantindo que o usuário sempre mantenha ao menos uma conta ativa.
- **Concorrência na criação de contas com mesmo nome**: Se duas requisições simultâneas tentarem criar uma conta com o mesmo nome para o mesmo usuário, o sistema deve garantir atomicidade e rejeitar a segunda por unicidade no escopo do usuário.
- **Identificador de conta com formato malformado**: Qualquer requisição que forneça um identificador que não respeite o formato padrão de identificadores do sistema deve retornar erro de formato inválido (HTTP 400).
- **Conformidade LGPD e privacidade nos nomes de conta**: O sistema não deve exigir nem aceitar números reais de agência ou conta bancária em campos cadastrais públicos, estimulando nomes de exibição (ex: "Nubank Débito").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir a criação de contas financeiras associadas a um usuário autenticado com os atributos: nome, tipo de conta (Conta Corrente, Cartão de Crédito, Investimento, Dinheiro ou Outros), saldo inicial (`initialBalance`, opcional, padrão 0), instituição financeira (opcional) e cor hexadecimal representativa (opcional).
- **FR-002**: O sistema DEVE garantir a unicidade de nome da conta por usuário, impedindo que o mesmo usuário tenha duas contas ativas com o mesmo nome.
- **FR-003**: O sistema DEVE fornecer uma funcionalidade de listagem de contas que retorne para cada conta os dados cadastrais, a contagem de transações associadas e o somatório consolidado de saldo (saldo inicial somado ao balanço de transações vinculadas).
- **FR-004**: O sistema DEVE permitir a atualização parcial de propriedades da conta (nome, tipo, instituição, cor, saldo inicial), validando regras de unicidade de nome e restrições de formato.
- **FR-005**: O sistema DEVE fornecer funcionalidade de exclusão de conta protegida: por padrão, se a conta possuir transações ativas vinculadas, o sistema DEVE bloquear a operação com erro de conflito (HTTP 409); caso o usuário envie explicitamente a confirmação de cascata (`?cascade=true`), o sistema DEVE excluir de forma atômica a conta e todas as suas transações vinculadas.
- **FR-006**: O sistema DEVE impedir a exclusão da última conta ativa do usuário caso ela seja sua única referência contábil.
- **FR-007**: O sistema DEVE suportar a associação de transações financeiras a um identificador de conta válido, mantendo a integridade referencial entre lançamentos e contas.
- **FR-008**: O fluxo de importação de extratos (OFX e CSV) DEVE aceitar a especificação do identificador de conta de destino (`accountId`) como parâmetro opcional; caso nenhum identificador seja informado na requisição, o sistema DEVE associar automaticamente os lançamentos importados à "Conta Principal" padrão do usuário.
- **FR-009**: O sistema DEVE assegurar que todo usuário possua ao menos uma conta padrão denominada "Conta Principal", provisionada de forma automática durante o cadastro ou no primeiro acesso com dados legados.
- **FR-010**: O sistema DEVE garantir que transações legadas sem conta explicitamente vinculada sejam mapeadas para a conta padrão do respectivo usuário, preservando a continuidade de relatórios e dashboards.
- **FR-011**: O gerador de dados sintéticos (seed local) DEVE ser atualizado para provisionar contas padrão estruturadas e associar todas as transações geradas a essas contas, sem dependências de serviços externos.
- **FR-012**: O processamento de extratos OFX em nenhuma hipótese DEVE persistir identificadores reais de agência ou número completo de conta bancária, respeitando a diretriz de Privacy-by-Design da constituição.
- **FR-013**: O endpoint de edição parcial de transações (`PATCH /api/transactions/:id`) DEVE suportar a atualização do campo de conta (`accountId`), validando estritamente se o identificador fornecido corresponde a uma conta existente e pertencente ao usuário autenticado, rejeitando contas inexistentes ou pertencentes a outros usuários.

### Key Entities

- **Conta Financeira (Account)**: Representa uma fonte de recursos, banco ou cartão sob posse do usuário.
  - *Identificador*: Identificador único no sistema.
  - *Identificador de Usuário*: Vínculo com o usuário proprietário da conta (isolamento multi-tenant).
  - *Nome*: Rótulo amigável definido pelo usuário (ex: "Nubank Principal", "Itaú Corrente").
  - *Tipo de Conta*: Categoria financeira da conta (Conta Corrente, Cartão de Crédito, Investimento, Dinheiro, Outros).
  - *Saldo Inicial*: Valor numérico decimal opcional (padrão 0) que compõe o saldo consolidado da conta.
  - *Instituição*: Identificação opcional da instituição bancária (ex: "Nu Pagamentos", "Banco Itaú").
  - *Cor*: Valor hexadecimal representativo para visualização em dashboards e gráficos.
  - *Datas de Auditoria*: Registro temporal de criação e última atualização.
- **Transação Financeira (Transaction)**:
  - *Identificador de Conta*: Vínculo referencial opcional ou obrigatório indicando a qual conta a movimentação pertence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuários conseguem cadastrar uma nova conta e visualizá-la na listagem em menos de 1 segundo.
- **SC-002**: 100% das transações importadas com especificação de conta são corretamente vinculadas à conta indicada sem lançamentos órfãos.
- **SC-003**: 100% dos dados históricos de transações pré-existentes permanecem acessíveis e associados à conta padrão após a migração/inicialização.
- **SC-004**: Nenhuma operação sobre contas permite leitura, edição ou exclusão de dados pertencentes a outro usuário (taxa zero de vazamento multi-tenant).
- **SC-005**: 100% dos testes determinísticos de unidade e integração do módulo de contas e da importação associada executam com sucesso.
- **SC-006**: Nenhum dado sensível de identificação de agência ou conta bancária real é persistido no banco de dados durante a importação de extratos (100% de conformidade com LGPD).

## Assumptions

- O usuário pode possuir tantas contas quantas forem necessárias (sem limite artificial restritivo).
- Cores de conta não fornecidas assumirão um tom neutro padrão do sistema.
- O saldo de cada conta é calculado de forma determinística a partir da soma do saldo inicial da conta (`initialBalance`) com o somatório de todas as transações vinculadas a ela.
- A exclusão de uma conta não exclui o usuário titular.
- As transações geradas pelo motor sintético local (seed) incluirão contas diversificadas (como conta corrente e cartão de crédito) para refletir o comportamento real do usuário brasileiro.
