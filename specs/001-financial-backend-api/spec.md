# Feature Specification: API REST do Backend Financeiro

**Feature Branch**: `001-financial-backend-api`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Especifique a API REST do backend financeiro com os seguintes módulos: 1. Módulo de Autenticação e Onboarding BYOK: Registro e Login de usuários via JWT; Endpoint para salvar a API Key do Google AI Studio com validação ativa (disparando um ping mínimo na API do Gemini antes de aceitar) e armazenamento criptografado (AES-256-GCM); Bloqueio (HTTP 403) de acesso a rotas analíticas se o usuário não possuir chave cadastrada. 2. Módulo de Ingestão e Processamento OFX/CSV: Endpoint de upload multipart para arquivos .ofx e .csv; Extração local de ID externo (FITID), data, valor e descrição crua; Idempotência: ignorar transações duplicadas baseando-se no FITID e userId. 3. Módulo de Integração Open Finance Simulado (Pluggy): Endpoint para sincronizar transações de contas de teste do sandbox da Pluggy, normalizando-as para o mesmo esquema das transações de OFX. 4. Módulo de Categorização Inteligente via IA: Sanitização de descrições e deduplicação em memória para obter apenas o conjunto de nomes de estabelecimentos únicos; Requisição à API do Gemini usando a chave do usuário com schema JSON estrito contendo as categorias aceitas (Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Outros); Mapeamento das categorias retornadas de volta para todas as transações correspondentes e persistência no MongoDB. 5. Módulo de Consultoria Financeira (Chatbot): Endpoint POST /api/chat/stream entregando respostas via Server-Sent Events (SSE); Contexto injetado pelo backend: resumo financeiro do mês (entradas, saídas, totais por categoria), histórico da sessão e prompt de persona consultora."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Autenticação de Usuário e Configuração BYOK de Chave de IA (Priority: P1)

Como um novo usuário da plataforma de finanças, desejo me cadastrar, autenticar e configurar com segurança minha própria chave do Google AI Studio (modelo BYOK), para que eu possa usufruir dos recursos de inteligência financeira sem custos operacionais de servidor e com garantia de que meus acessos analíticos estarão protegidos.

**Why this priority**: A autenticação stateless e o registro validado da chave do usuário formam a base indispensável de segurança e operação de todo o sistema. Sem credencial de IA válida e autenticação, os módulos de categorização e consultoria não podem operar.

**Independent Test**: Pode ser testado de ponta a ponta criando um usuário, realizando login para obter o token de acesso, enviando uma chave de IA (válida e inválida) e verificando que a rota analítica responde 403 enquanto a chave não estiver configurada, passando a responder normalmente após o cadastro validado.

**Acceptance Scenarios**:

1. **Given** um visitante com e-mail e senha válidos, **When** ele solicita o registro no endpoint de autenticação, **Then** o sistema cria a conta de usuário e permite o login imediato retornando um token de acesso seguro.
2. **Given** um usuário autenticado sem chave de IA cadastrada, **When** ele tenta acessar qualquer rota analítica protegida ou de consultoria, **Then** o sistema bloqueia a requisição retornando status HTTP 403 com mensagem indicando a necessidade de cadastrar a chave BYOK.
3. **Given** um usuário autenticado fornecendo uma chave de API do Google AI Studio, **When** ele solicita o cadastro da chave, **Then** o backend executa um teste ativo mínimo de conectividade na API do Gemini; se a chave for válida, criptografa a credencial em repouso com algoritmo autenticado (AES-256-GCM) e confirma o salvamento.
4. **Given** um usuário autenticado fornecendo uma chave de API do Google AI Studio inválida ou revogada, **When** ele submete a chave, **Then** a validação ativa falha e o sistema rejeita a operação com erro HTTP 400 sem persistir a chave no banco de dados.

---

### User Story 2 - Ingestão e Processamento Idempotente de Extratos Bancários OFX e CSV (Priority: P2)

Como usuário financeiro, desejo fazer upload de arquivos de extrato bancário nos formatos OFX e CSV, para que minhas movimentações financeiras sejam lidas, sanitizadas e registradas na plataforma sem risco de duplicidade de transações em reenvios acidentais.

**Why this priority**: A ingestão de extratos locais é a fonte primária de dados financeiros dos usuários. Garantir a extração precisa de FITID, data, valor e descrição com idempotência estrita impede inconsistências de saldo.

**Independent Test**: Pode ser testado fazendo upload de um arquivo OFX ou CSV sintético e verificando no banco que as transações foram criadas; ao submeter o mesmo arquivo uma segunda vez, nenhuma transação adicional é criada e os dados permanecem íntegros.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado com arquivo `.ofx` ou `.csv` válido, **When** ele faz upload multipart para o endpoint de ingestão de extratos, **Then** o backend faz o parsing dos dados, extrai o identificador externo da transação (FITID), a data, o valor monetário e a descrição, descartando quaisquer dados bancários sensíveis de agência/conta (LGPD).
2. **Given** um arquivo contendo transações já importadas anteriormente pelo mesmo usuário (mesmo FITID e identificador de usuário), **When** o processamento é executado, **Then** o sistema ignora os registros duplicados de forma transparente e importa apenas transações inéditas.
3. **Given** um arquivo com formato inválido, codificação ilegível ou corrompido, **When** o usuário tenta o upload, **Then** o sistema rejeita o payload informando erro descritivo de validação sem alterar o estado do banco.

---

### User Story 3 - Sincronização de Transações via Open Finance Simulado (Pluggy) (Priority: P3)

Como usuário financeiro com contas integradas, desejo sincronizar minhas transações a partir do sandbox Open Finance da Pluggy, para que meus lançamentos de teste sejam importados automaticamente e normalizados no mesmo formato unificado dos extratos manuais.

**Why this priority**: Oferece o canal automatizado de integração bancária simulada, garantindo que fontes distintas confluam para o mesmo modelo canônico de dados.

**Independent Test**: Pode ser testado acionando o endpoint de sincronização informando o identificador do item da Pluggy sandbox, validando que os dados retornados pelo provedor são convertidos para o esquema canônico idêntico ao gerado pelos extratos OFX/CSV.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado com uma conexão ativa na sandbox da Pluggy, **When** ele dispara a sincronização via endpoint dedicado, **Then** o backend busca as transações no provedor externo, converte-as para o esquema unificado de transações e aplica as regras de idempotência por identificador externo e usuário.
2. **Given** uma falha de comunicação ou identificador inválido no sandbox da Pluggy, **When** a sincronização é executada, **Then** o backend retorna erro HTTP adequado detalhando o problema de integração sem interromper outros serviços.

---

### User Story 4 - Categorização Inteligente de Transações com IA e Otimização de Tokens (Priority: P4)

Como usuário com transações importadas, desejo que a plataforma categorize automaticamente meus gastos por meio de inteligência artificial generativa utilizando minha própria chave BYOK, para que minhas finanças fiquem organizadas nas categorias padrão com máxima privacidade e menor consumo de tokens.

**Why this priority**: A inteligência financeira automatizada agrega o valor analítico central da plataforma, dependendo da higienização prévia e do uso eficiente da chave do usuário.

**Independent Test**: Pode ser testado fornecendo um lote de transações com descrições repetidas e dados ruidosos; o sistema sanitiza o texto, envia apenas os nomes de estabelecimentos únicos ao Gemini sob o schema fechado de categorias, e ao final todas as transações correspondentes no banco aparecem devidamente categorizadas.

**Acceptance Scenarios**:

1. **Given** um conjunto de transações pendentes de categorização contendo estabelecimentos repetidos e textos com números de agência ou documentos acidentais, **When** o processo de categorização é disparado, **Then** o backend sanitiza as descrições removendo dados sensíveis (LGPD) e deduplica os nomes em memória, enviando à API do Gemini apenas a lista única de estabelecimentos.
2. **Given** a requisição ao Gemini utilizando a chave de API do próprio usuário descriptografada temporariamente em memória, **When** a IA responde respeitando o schema JSON estrito, **Then** cada estabelecimento recebe uma das categorias permitidas: `Alimentação`, `Transporte`, `Moradia`, `Saúde`, `Lazer`, `Educação` ou `Outros`.
3. **Given** as categorias retornadas pela IA, **When** a etapa de reassociação local é executada, **Then** o backend atualiza em lote todas as transações associadas no MongoDB e descarta a chave do usuário da memória volátil.

---

### User Story 5 - Consultoria Financeira Personalizada em Tempo Real via Chat com Streaming (Priority: P5)

Como usuário com despesas categorizadas, desejo conversar com um consultor financeiro virtual via chat interativo que responda em tempo real por streaming, injetando automaticamente o resumo do meu mês atual para me fornecer diagnósticos e conselhos orçamentários precisos.

**Why this priority**: É a interface consultiva e interativa que transforma dados categorizados em recomendações práticas de tomada de decisão para o usuário.

**Independent Test**: Pode ser testado enviando uma mensagem via POST para `/api/chat/stream`, verificando que a conexão mantém protocolo Server-Sent Events (SSE) transmitindo blocos de texto contínuos, e que a resposta reflete métricas consolidadas de entradas, saídas e categorias do usuário.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado com chave BYOK ativa, **When** ele envia uma mensagem para `POST /api/chat/stream`, **Then** o backend estabelece uma conexão Server-Sent Events (SSE) e transmite os fragmentos de texto gerados pela IA progressivamente até o encerramento do evento.
2. **Given** a geração do prompt de consultoria, **When** o backend prepara a requisição ao Gemini, **Then** ele injeta automaticamente o resumo financeiro mensal do usuário (total de entradas, total de saídas, saldos e totais agregados por categoria), o histórico recente de mensagens da sessão e as diretrizes da persona de consultor financeiro.
3. **Given** um usuário sem chave de IA configurada que tenta abrir o chat, **When** a requisição chega em `POST /api/chat/stream`, **Then** o backend bloqueia a conexão imediatamente com status HTTP 403 Forbidden.

---

### Edge Cases

- **Chave de IA sem saldo ou com cota excedida**: O ping de validação detecta erro de cota ou autorização e rejeita a chave antes de salvar, informando o usuário com mensagem amigável.
- **Desconexão do cliente durante o streaming SSE**: O backend deve interromper a chamada em andamento ao Gemini e liberar os recursos de conexão imediatamente.
- **Arquivo de extrato com todas as transações duplicadas**: O processamento deve concluir com sucesso reportando que 0 novas transações foram inseridas e N transações foram ignoradas por já existirem.
- **Arquivos CSV com separadores distintos (vírgula ou ponto e vírgula) ou codificações distintas (UTF-8 e ISO-8859-1)**: O parser deve identificar e tratar as variações sem lançar exceções não tratadas.
- **Transação com valor zerado ou data inválida**: O parser descarta ou assinala a linha com erro de formato sem invalidar todo o restante do lote de transações válidas.
- **Indisponibilidade temporária da API do Gemini durante a categorização**: O sistema não corrompe os dados existentes, mantendo as transações não categorizadas com categoria padrão de contingência (`Outros`) ou preservando-as como pendentes para nova tentativa.
- **Presença de números de CPF/CNPJ ou dados de conta na descrição de transferências (ex: "PIX TRANSF 123.456.789-00 AG 1234 CC 5678")**: O sanitizador remove deterministicamente esses fragmentos antes de qualquer persistência ou transmissão para a LLM, assegurando conformidade com a LGPD.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE fornecer endpoints para registro (`POST /api/auth/register`) e autenticação (`POST /api/auth/login`) de usuários, retornando um token de acesso stateless (JWT).
- **FR-002**: O sistema DEVE prover endpoint protegido (`PUT /api/user/ai-key`) para cadastro da API Key do Google AI Studio fornecida pelo usuário (arquitetura BYOK).
- **FR-003**: Antes de aceitar e armazenar a API Key, o sistema DEVE realizar validação ativa obrigatória, disparando uma chamada mínima de verificação à API do Gemini; se a chamada falhar, a chave DEVE ser rejeitada com código HTTP 400.
- **FR-004**: O sistema DEVE criptografar a API Key aceita utilizando o padrão `AES-256-GCM` com vetor de inicialização (IV) e tag de autenticação antes de persisti-la no MongoDB, nunca mantendo a chave em texto plano no banco de dados nem em logs.
- **FR-005**: O sistema DEVE bloquear o acesso com código HTTP 403 Forbidden a qualquer rota analítica, de enriquecimento por IA ou de consultoria se o usuário autenticado não possuir uma chave BYOK válida cadastrada.
- **FR-006**: O sistema DEVE disponibilizar endpoint de upload multipart (`POST /api/transactions/upload`) para arquivos nos formatos `.ofx` e `.csv`.
- **FR-007**: O sistema DEVE realizar o parsing local de extratos extraindo com precisão: identificador externo (`FITID`), data do lançamento, valor monetário e descrição textual original.
- **FR-008**: O sistema DEVE descartar obrigatoriamente na camada de parsing qualquer metadado bancário sensível (número de agência, conta, código de banco e CPF/CNPJ do titular) em conformidade com o princípio de minimização de dados da LGPD.
- **FR-009**: O sistema DEVE implementar idempotência na persistência de transações: transações com a mesma combinação de `FITID` e `userId` DEVEM ser ignoradas sem duplicar registros no MongoDB.
- **FR-010**: O sistema DEVE disponibilizar endpoint (`POST /api/integrations/pluggy/sync`) para sincronizar transações a partir da sandbox da Pluggy API, normalizando os registros retornados para o mesmo esquema canônico das transações oriundas de extratos manuais.
- **FR-011**: O sistema DEVE sanitizar as descrições das transações removendo ruídos, caracteres especiais desnecessários e números de documentos/contas antes do processamento de categorização.
- **FR-012**: O sistema DEVE realizar agrupamento e deduplicação em memória das descrições das transações pendentes, isolando apenas a lista de nomes únicos de estabelecimentos comerciais a ser enviada ao Gemini.
- **FR-013**: O sistema DEVE solicitar a categorização ao Gemini utilizando a chave BYOK do próprio usuário descriptografada sob demanda e aplicando schema JSON estrito restrito às 7 categorias canônicas: `Alimentação`, `Transporte`, `Moradia`, `Saúde`, `Lazer`, `Educação` e `Outros`.
- **FR-014**: O sistema DEVE reassociar localmente no backend as categorias retornadas pela IA com todas as transações correspondentes do usuário e persistir as alterações em lote no MongoDB.
- **FR-015**: O sistema DEVE fornecer endpoint `POST /api/chat/stream` com suporte a Server-Sent Events (SSE) para transmissão de respostas em fluxo contínuo geradas pelo modelo Gemini com a chave BYOK do usuário.
- **FR-016**: O sistema DEVE calcular e injetar dinamicamente no contexto do chatbot o resumo financeiro consolidado do mês (total de receitas/entradas, total de despesas/saídas e distribuição totalizada por categoria), juntamente com o histórico de mensagens da sessão e instruções da persona de consultor financeiro.
- **FR-017**: Todas as rotas e consultas no banco de dados DEVEM garantir isolamento multi-tenant estrito baseado no identificador do usuário (`userId`) extraído do token JWT verificado.

### Key Entities *(include if feature involves data)*

- **User**: Representa a identidade cadastrada na plataforma. Contém identificador único (`_id`), nome, e-mail único, hash da senha de acesso, credencial BYOK criptografada (texto cifrado, IV, tag de autenticação e data de validação) e timestamps de criação/atualização.
- **Transaction**: Representa um lançamento financeiro unificado no sistema. Contém identificador único (`_id`), referência ao usuário proprietário (`userId`), identificador externo único (`fitId`), data da movimentação (`date`), valor monetário com sinal (`amount`), descrição sanitizada (`description`), categoria atribuída (`category`: `Alimentação` | `Transporte` | `Moradia` | `Saúde` | `Lazer` | `Educação` | `Outros`), origem dos dados (`source`: `OFX` | `CSV` | `PLUGGY`) e timestamps.
- **OpenFinanceConnection**: Representa uma vinculação de conta com o agregador financeiro Pluggy. Contém identificador (`_id`), referência ao usuário (`userId`), identificador do item na Pluggy (`itemId`), status da sincronização e timestamp da última coleta.
- **ChatSession / ChatMessage**: Representa a trilha de interação de consultoria financeira. Contém identificador da sessão, identificador do usuário (`userId`), histórico ordenado de mensagens (papel: `user` | `assistant`, conteúdo textual) e timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O tempo de resposta para validação ativa e registro da chave BYOK é inferior a 3 segundos sob condições normais de conectividade com a API externa.
- **SC-002**: O sistema realiza o parsing local, sanitização e normalização de extratos contendo até 500 transações em menos de 2 segundos.
- **SC-003**: A taxa de duplicação de transações em reenvios de arquivos ou sincronizações repetidas é de exatamente 0%, garantida pela idempotência por identificador externo e usuário.
- **SC-004**: O pipeline de pré-processamento de IA atinge redução mínima de 70% na quantidade de itens enviados ao Gemini em extratos convencionais através da deduplicação de nomes de estabelecimentos em memória.
- **SC-005**: 100% das transações submetidas ao enriquecimento por IA recebem uma das 7 categorias canônicas especificadas, sem exceções de esquema inválido.
- **SC-006**: O início da transmissão de tokens na rota de streaming do consultor financeiro (`POST /api/chat/stream`) ocorre em menos de 1,5 segundos após a requisição do usuário.
- **SC-007**: 100% dos dados bancários sensíveis de agência/conta e documentos de identificação pessoal (CPF/CNPJ) presentes em arquivos brutos são expurgados, resultando em zero registros de PII persistidos ou transmitidos para serviços de IA.

## Assumptions

- Os usuários possuem conexão ativa com a internet e têm acesso ao Google AI Studio para obter uma API Key do Gemini com cota operacional disponível.
- Os arquivos OFX e CSV importados seguem padrões comuns da indústria financeira brasileira (extensões válidas, cabeçalhos legíveis em CSV com campos identificáveis de data, valor e histórico).
- O ambiente de testes da Pluggy Sandbox disponibiliza credenciais e endpoints acessíveis para recuperação de dados de contas conectadas simuladas.
- O catálogo de categorias é fechado nas 7 categorias pré-definidas (`Alimentação`, `Transporte`, `Moradia`, `Saúde`, `Lazer`, `Educação`, `Outros`).
- O resumo financeiro injetado no prompt de consultoria considera as transações do mês calendário vigente por padrão, salvo instrução específica na mensagem do usuário.
- A aplicação é exclusivamente uma API de backend, e as respostas aos clientes são entregues em formato JSON ou fluxo Server-Sent Events (SSE).
