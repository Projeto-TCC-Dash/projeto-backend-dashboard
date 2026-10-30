# Feature Specification: Vínculo de Contas Sociais — Google OAuth 2.0

**Feature Branch**: `013-google-auth-linking`

**Created**: 2026-10-24

**Status**: Implemented

**Input**: User description: "Implemente a feature 013: Vínculo de Contas Sociais — Google OAuth 2.0 (specs/013-google-auth-linking) conforme detalhado no roadmap de evolução v1.2.0."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Vinculação de Conta Google ao Perfil Existente (Priority: P1)

Como usuário autenticado na plataforma, desejo vincular minha conta Google ao meu perfil existente apresentando uma credencial válida do Google (ID token), para que eu possa ter minha identidade associada com segurança e utilizar o login social em futuros acessos.

**Why this priority**: É a funcionalidade central de associação de identidade social. Permite que usuários com conta existente no sistema conectem sua conta do Google de forma unificada.

**Independent Test**: Pode ser testado autenticando um usuário regular, enviando uma requisição de vinculação com um ID token do Google válido e verificando se os metadados de vínculo são armazenados e refletidos no perfil do usuário.

**Acceptance Scenarios**:

1. **Given** um usuário devidamente autenticado sem conta Google vinculada, **When** ele submete um ID token do Google válido e íntegro, **Then** o sistema valida o token externamente, extrai o identificador único (`googleId`) e o e-mail Google (`googleEmail`), registra o vínculo com data/hora e confirma a operação com sucesso.
2. **Given** um usuário autenticado que tenta vincular uma conta Google cujo `googleId` já está associado a outra conta de usuário do sistema, **When** submete a solicitação de vínculo, **Then** o sistema rejeita a operação com erro de conflito (409 Conflict) e preserva as contas intactas.
3. **Given** um usuário autenticado que submete um ID token inválido, expirado ou forjado, **When** solicita a vinculação, **Then** o sistema rejeita a requisição com erro de validação (400 Bad Request) e não altera nenhum dado da conta.

---

### User Story 2 - Desvinculação de Conta Google com Guarda de Senha Local (Priority: P2)

Como usuário com conta Google vinculada, desejo desvincular minha conta Google a qualquer momento nas minhas configurações de segurança, com a garantia de que o sistema me impedirá de desvincular se o Google for meu único método de autenticação, evitando o bloqueio acidental da minha conta.

**Why this priority**: Garante soberania do usuário sobre seus dados de identidade social e protege contra o bloqueio irrevogável da conta através de guarda de segurança (prevent lock-out).

**Independent Test**: Pode ser testado tentando desvincular a conta Google de um usuário que possui senha local (sucesso esperado) e de um usuário sem senha local cadastrada (rejeição com erro 400 esperada).

**Acceptance Scenarios**:

1. **Given** um usuário autenticado com conta Google vinculada e com senha local cadastrada, **When** solicita a desvinculação da conta Google, **Then** o sistema remove os dados de vínculo social, atualiza o status de segurança e confirma a desvinculação com sucesso.
2. **Given** um usuário autenticado com conta Google vinculada mas sem nenhuma senha local cadastrada, **When** tenta solicitar a desvinculação da conta Google, **Then** o sistema recusa a solicitação com erro descritivo (400 Bad Request), instruindo o usuário a cadastrar uma senha local antes de desvincular.
3. **Given** um usuário que não possui conta Google vinculada, **When** solicita a desvinculação, **Then** o sistema rejeita a operação com erro de requisição inválida.

---

### User Story 3 - Consulta do Estado de Vínculo e Autenticação via Google Vinculado (Priority: P3)

Como usuário da plataforma, desejo visualizar claramente nas minhas configurações de segurança o status atual do vínculo com o Google (se está vinculado, qual e-mail e data do vínculo) e ser capaz de autenticar diretamente no sistema utilizando minha credencial do Google previamente vinculada.

**Why this priority**: Fornece transparência na interface do usuário e viabiliza a conveniência do login rápido via Google para contas vinculadas.

**Independent Test**: Pode ser testado consultando o endpoint de perfil de usuário e validando os campos de segurança social, bem como efetuando login via ID token Google com conta previamente vinculada.

**Acceptance Scenarios**:

1. **Given** um usuário com conta Google vinculada, **When** seus dados de perfil são consultados, **Then** a seção de segurança reporta `googleLinked: true`, o `googleEmail` mascarado/visível e a data `googleLinkedAt`.
2. **Given** um usuário com conta Google vinculada, **When** ele realiza login utilizando o ID token do Google correspondente, **Then** o sistema valida o token, localiza o usuário pelo `googleId` e emite uma sessão JWT válida.

---

### Edge Cases

- O que acontece se a requisição de validação do ID token do Google falhar por instabilidade de rede com o provedor OAuth?
  O sistema trata a falha de comunicação retornando erro de serviço externo indisponível sem corromper o estado do usuário.
- O que acontece se o token do Google pertencer a uma conta cujo e-mail é diferente do e-mail principal cadastrado pelo usuário?
  O vínculo é aceito normalmente, pois o identificador canônico de vinculação é o `googleId` e o `googleEmail` é registrado como metadado social associado, não substituindo o e-mail principal do usuário.
- O que acontece se o usuário tentar vincular a mesma conta Google repetidas vezes para o mesmo perfil?
  O sistema é idempotente: atualiza a data de vínculo e confirma o sucesso sem duplicações.
- O que acontece se o token do Google estiver expirado?
  A validação criptográfica do token falha imediatamente e retorna 400 Bad Request com mensagem indicando token inválido ou expirado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE fornecer um endpoint autenticado (`POST /api/auth/google/link`) para vincular uma conta Google ao perfil do usuário atual.
- **FR-002**: O sistema DEVE validar a autenticidade e validade temporal do `idToken` do Google fornecido, rejeitando tokens expirados, com assinatura inválida ou gerados para outro público/client_id.
- **FR-003**: O sistema DEVE extrair com segurança o identificador único do usuário no Google (`googleId`) e o endereço de e-mail associado (`googleEmail`) a partir do token validado.
- **FR-004**: O sistema DEVE impedir a vinculação caso o `googleId` já esteja associado a outro usuário no banco de dados, retornando código HTTP 409 (Conflict).
- **FR-005**: O sistema DEVE persistir os metadados de vínculo social (`googleId`, `googleEmail`, `linkedAt`) em subdocumento dedicado no modelo de usuário.
- **FR-006**: O sistema DEVE fornecer um endpoint autenticado (`DELETE /api/auth/google/unlink`) para remover o vínculo com a conta Google.
- **FR-007**: O sistema DEVE aplicar uma regra de guarda rigorosa no endpoint de desvinculação, rejeitando com HTTP 400 a tentativa de desvinculação caso o usuário não possua senha local cadastrada (`hasLocalPassword` falso).
- **FR-008**: O sistema DEVE expor no endpoint de consulta de perfil (`GET /api/user/profile`) dentro do objeto `security` os campos `googleLinked: boolean`, `googleEmail?: string` e `googleLinkedAt?: Date`.
- **FR-009**: O sistema DEVE fornecer um endpoint de login social (`POST /api/auth/google`) que permita autenticar usuários cuja conta Google já esteja vinculada ao sistema.
- **FR-011**: O sistema DEVE registrar em logs de auditoria interna as ações de vínculo e desvinculação de contas sociais, sem expor tokens ou dados sensíveis (LGPD).
- **FR-012**: O sistema DEVE suportar configuração desacoplada de `GOOGLE_CLIENT_ID` via variáveis de ambiente com validação pelo schema Zod de inicialização.

### Key Entities *(include if feature involves data)*

- **User**: Entidade central de usuário que ganha o subdocumento `googleAccount` contendo:
  - `googleId`: Identificador único e imutável fornecido pelo Google (indexado e esparso/único).
  - `googleEmail`: E-mail associado à conta Google no momento da vinculação.
  - `linkedAt`: Timestamp do momento em que o vínculo foi realizado.
- **UserSecuritySettings**: DTO/Schema de configurações de segurança contendo os indicadores `googleLinked`, `googleEmail`, `googleLinkedAt` e `hasLocalPassword`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuários com conta existente conseguem concluir a vinculação de sua conta Google em uma única requisição com tempo de resposta inferior a 1,5 segundos (incluindo validação de token).
- **SC-002**: 100% das tentativas de desvinculação por usuários sem senha local cadastrada são interceptadas e rejeitadas, prevenindo perda acidental de acesso.
- **SC-003**: 100% das tentativas de vincular uma conta Google já utilizada por outro usuário resultam em conflito 409 sem corrupção de dados.
- **SC-004**: O endpoint de perfil (`GET /api/user/profile`) reflete o estado do vínculo social imediatamente após qualquer operação de link ou unlink.

## Assumptions

- O frontend é responsável por interagir com o SDK do Google Identity Services (GIS / Google Sign-In) e obter o `idToken` JWT gerado pelo Google para envio à API backend.
- A validação do token do Google pode ser realizada via biblioteca oficial (`google-auth-library`) ou validação de chave pública do Google OAuth2.
- A variável de ambiente `GOOGLE_CLIENT_ID` é opcional em desenvolvimento (permitindo mock em testes automatizados), mas validada em produção.
