# Feature Specification: Autenticação em Dois Fatores (2FA via E-mail) e Revogação de Sessão

**Feature Branch**: `012-two-factor-auth-session`

**Created**: 2026-10-24

**Status**: Implemented

**Input**: User description: "Criar especificação para Autenticação em Dois Fatores (2FA via E-mail com código OTP de 6 dígitos), interceptação no login e logout seguro com revogação de sessão."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Interceptação no Login com Desafio 2FA via E-mail (Priority: P1)

Como usuário com proteção em duas etapas ativa, ao realizar login com minhas credenciais corretas (e-mail e senha), desejo que o sistema intercepte o acesso direto e me solicite um código numérico de 6 dígitos enviado ao meu e-mail, para que terceiros não consigam acessar meus dados financeiros mesmo se descobrirem minha senha.

**Why this priority**: É o núcleo de segurança da autenticação multifator (2FA). Garante que a posse exclusiva da senha não seja suficiente para comprometer a conta e os dados confidenciais do usuário.

**Independent Test**: Pode ser testado independentemente configurando uma conta com 2FA ativado, submetendo credenciais válidas, confirmando o recebimento do código de 6 dígitos por e-mail e validando o código para obter acesso pleno à aplicação.

**Acceptance Scenarios**:

1. **Given** um usuário cadastrado com 2FA ativado, **When** submete e-mail e senha corretos na tela de login, **Then** o sistema não emite a sessão completa imediatamente, mas retorna um desafio de verificação pendente e envia um código OTP de 6 dígitos para o e-mail cadastrado.
2. **Given** um usuário na etapa de desafio 2FA com código válido enviado, **When** informa o código de 6 dígitos correto dentro do prazo de validade de 10 minutos, **Then** o sistema valida a identidade, invalida o código utilizado e emite uma sessão autorizada de acesso à plataforma.
3. **Given** um usuário na etapa de desafio 2FA, **When** tenta acessar qualquer área protegida da aplicação utilizando apenas os dados temporários do desafio sem concluir o segundo fator, **Then** o sistema nega o acesso com recusa explícita de autorização.

---

### User Story 2 - Logout Seguro com Revogação Imediata de Sessão (Priority: P2)

Como usuário autenticado na plataforma, desejo acionar o encerramento da minha sessão (logout) para que meu acesso seja imediatamente invalidado no servidor, garantindo que nenhum dispositivo ou terceiro consiga reutilizar credenciais ou identificadores anteriores.

**Why this priority**: Evita o sequestro de sessões e acessos residuais pós-logout, especialmente em dispositivos compartilhados ou redes públicas.

**Independent Test**: Pode ser testado independentemente autenticando um usuário, acionando o endpoint de encerramento de sessão (logout) e, em seguida, tentando realizar uma nova consulta a dados protegidos com a mesma credencial anterior, comprovando que o acesso é recusado de imediato.

**Acceptance Scenarios**:

1. **Given** um usuário com sessão ativa, **When** solicita o logout da aplicação, **Then** o sistema registra a revogação explícita daquela sessão e confirma o encerramento com sucesso.
2. **Given** uma sessão que acabou de ser revogada via logout, **When** qualquer requisição tenta utilizar o identificador dessa sessão revogada, **Then** o sistema rejeita a operação com erro de sessão inválida/revogada.
3. **Given** um usuário com múltiplas sessões em diferentes dispositivos, **When** opta pelo encerramento global de sessões, **Then** todas as sessões ativas do usuário são marcadas como revogadas simultaneamente.

---

### User Story 3 - Ativação, Desativação e Reenvio de Código OTP (Priority: P3)

Como usuário da plataforma, desejo habilitar ou desabilitar a verificação em duas etapas nas minhas configurações de segurança e solicitar um novo código caso não o receba a tempo, mantendo o controle sobre meu método de acesso com proteções contra abusos.

**Why this priority**: Permite gestão soberana da segurança da conta e recuperação em casos de atraso na entrega de mensagens, prevenindo bloqueios indevidos de usuários legítimos.

**Independent Test**: Pode ser testado ativando a funcionalidade nas configurações do perfil, confirmando a posse do e-mail com um código de teste antes da ativação final, e testando o botão de reenvio de código respeitando o intervalo de tempo mínimo.

**Acceptance Scenarios**:

1. **Given** um usuário com 2FA desativado, **When** solicita a ativação do 2FA em seu perfil, **Then** o sistema envia um código de verificação ao seu e-mail e só marca o 2FA como ativo após a confirmação bem-sucedida desse código.
2. **Given** um usuário em processo de desafio 2FA que não recebeu o e-mail, **When** solicita o reenvio após o intervalo de espera obrigatório (60 segundos), **Then** um novo código é gerado, o anterior é invalidado e uma nova mensagem é disparada.
3. **Given** um usuário com 2FA ativo que deseja desativá-lo, **When** solicita a desativação e confirma sua senha atual, **Then** o sistema desativa a exigência do segundo fator para os próximos logins.

---

### Edge Cases

- O que acontece se o usuário informar um código OTP expirado (mais de 10 minutos após o envio)?
  O sistema rejeita o código com aviso claro de código expirado e instrui o usuário a solicitar um novo código OTP.
- O que acontece se houver 5 tentativas incorretas consecutivas de digitação do código OTP?
  O desafio de autenticação em andamento é bloqueado e invalidado para evitar ataques de força bruta, exigindo que o usuário reinicie o fluxo de login desde o início.
- O que acontece se o usuário solicitar múltiplos reenvios em menos de 60 segundos?
  O sistema bloqueia a requisição de reenvio informando os segundos restantes para o próximo reenvio permitido (controle de taxa/cooldown).
- O que acontece se um código já utilizado for reenviado na mesma sessão ou em outra?
  O sistema rejeita sumariamente, pois cada código OTP é de uso estritamente único (*single-use*).
- O que acontece se o usuário abandonar o fluxo de login na tela de 2FA?
  O desafio temporário expira naturalmente sem gerar sessão persistida e sem conceder qualquer privilégio ao cliente.
- O que acontece se uma credencial revogada for reapresentada antes da sua expiração natural de tempo?
  O sistema consulta a lista de sessões revogadas e nega o acesso de imediato, garantindo que o logout seja irrevogável.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE identificar no momento da validação de e-mail e senha se a conta possui a autenticação em dois fatores (2FA) habilitada.
- **FR-002**: Se o 2FA estiver ativo, o sistema DEVE interceptar o fluxo regular de login, impedindo a emissão imediata da sessão definitiva e estabelecendo um estado de desafio pendente.
- **FR-003**: O sistema DEVE gerar um código numérico de 6 dígitos criptograficamente seguro e associá-lo ao desafio de login em aberto.
- **FR-004**: O sistema DEVE enviar o código de 6 dígitos gerado para o endereço de e-mail verificado do usuário, com prazo de validade de 10 minutos.
- **FR-005**: O sistema DEVE disponibilizar mecanismo para recepção e validação do código de 6 dígitos vinculado ao desafio pendente.
- **FR-006**: Ao validar com sucesso o código informado dentro da janela de 10 minutos, o sistema DEVE promover o desafio a uma sessão de usuário plenamente autorizada e marcar o código OTP como consumido.
- **FR-007**: O sistema DEVE invalidar imediatamente qualquer código OTP após seu primeiro uso, impedindo reutilização.
- **FR-008**: O sistema DEVE limitar as tentativas de verificação a no máximo 5 erros por desafio; ultrapassado esse limite, o desafio DEVE ser cancelado e o login invalidado.
- **FR-009**: O sistema DEVE oferecer funcionalidade de reenvio de código OTP com tempo de espera mínimo (cooldown) de 60 segundos entre disparos.
- **FR-010**: O sistema DEVE permitir a ativação de 2FA pelo usuário, exigindo validação prévia de um código de teste enviado por e-mail antes de efetivar a obrigatoriedade.
- **FR-011**: O sistema DEVE permitir a desativação do 2FA pelo usuário autenticado mediante confirmação de sua senha de acesso.
- **FR-012**: O sistema DEVE disponibilizar ação de encerramento seguro de sessão (logout) que revogue explicitamente o identificador da sessão ativa no servidor.
- **FR-013**: O sistema DEVE recusar qualquer requisição subsequente que apresente uma sessão revogada, independentemente de sua validade temporal nominal.
- **FR-014**: O sistema DEVE permitir ao usuário revogar todas as suas sessões ativas simultaneamente ("encerrar em todos os dispositivos").
- **FR-015**: O identificador transitório de desafio 2FA NÃO DEVE conceder acesso a nenhuma rota de dados de negócios (contas, extratos, transações, perfil ou inteligência financeira).

### Key Entities *(include if feature involves data)*

- **Usuário (User)**: Representa o titular da conta na plataforma; atributos relevantes incluem status de 2FA (ativo/inativo), e-mail verificado e carimbo de data/hora de alteração de credenciais.
- **Desafio 2FA (TwoFactorChallenge)**: Representa uma solicitação de validação de segundo fator em andamento; atributos incluem identificador único do desafio, referência ao usuário, código OTP gerado (armazenado de forma segura e protegida), quantidade de tentativas realizadas, carimbo de expiração (10 minutos), carimbo do último envio (cooldown de 60s) e status (pendente, verificado, expirado, bloqueado).
- **Sessão Ativa (UserSession)**: Representa a autorização concedida após autenticação completa; atributos incluem identificador único de sessão, referência ao usuário titular, data de emissão, data de expiração, status (ativa, revogada) e data/hora de revogação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das tentativas de login em contas com 2FA ativo são interceptadas e impedidas de acessar dados protegidos até a validação bem-sucedida do código de 6 dígitos.
- **SC-002**: O código OTP de 6 dígitos é entregue na caixa de entrada do usuário em até 10 segundos em condições operacionais normais do serviço de e-mail.
- **SC-003**: 100% das requisições subsequentes utilizando uma sessão revogada são rejeitadas imediatamente (latência de propagação de revogação de 0 segundos).
- **SC-004**: O tempo médio necessário para um usuário legítimo receber o código e completar a verificação 2FA é inferior a 45 segundos.
- **SC-005**: 100% dos desafios que atingem 5 tentativas incorretas são imediatamente cancelados, impedindo ataques automatizados de força bruta.
- **SC-006**: 100% dos códigos OTP utilizados são inutilizados de imediato, impossibilitando ataques de repetição (*replay attacks*).

## Assumptions

- O usuário possui acesso contínuo à sua caixa de e-mail cadastrada para visualização imediata do código OTP.
- O serviço externo de entrega de e-mails transacionais (provedor de mensageria) possui taxa de disponibilidade adequada para envios operacionais.
- A ativação do 2FA é opcional e gerenciada pelo usuário no painel de configurações de segurança da conta.
- O código de segundo fator é estritamente numérico e composto por 6 dígitos decimais.
- A revogação de sessões mantém compatibilidade com os clientes web da aplicação, sem exigir alterações no padrão de comunicação das requisições autorizadas.
