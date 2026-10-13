# Feature Specification: Cache de Análises com TTL, Seed Pluggy e Expansão da Documentação

**Feature Branch**: `002-seed-cache-analysis`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Adicione suporte a: 1. Seed automático de usuários fictícios integrados à sandbox da Pluggy usando a chave do Google AI Studio padrão do .env. 2. Camada de cache e persistência com TTL para diagnósticos e análises financeiras geradas por IA, invalidada apenas por novas transações, reduzindo drasticamente o consumo de tokens no Gemini. 3. Atualização e expansão completa do README.md com diagramas, arquitetura e instruções de uso."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cache Inteligente de Análises Financeiras com TTL e Invalidação por Transações (Priority: P1)

Como um usuário que consulta frequentemente o panorama e diagnósticos do meu orçamento mensal, desejo que as análises financeiras geradas por inteligência artificial fiquem salvas em cache com tempo de expiração e sejam reaproveitadas enquanto não houver novos lançamentos, para que eu receba respostas instantâneas e poupe ao máximo a cota de tokens da minha chave de IA.

**Why this priority**: A minimização extrema de tokens é um dos pilares centrais da plataforma. Sem cache de diagnósticos, consultas repetidas sobre o mesmo mês geram desperdício de cota do usuário e aumentam a latência desnecessariamente.

**Independent Test**: Pode ser testado solicitando a análise financeira de um mês; na primeira chamada, o sistema aciona a IA, persiste o diagnóstico e retorna `cached: false`. Na segunda chamada para o mesmo mês, o retorno é instantâneo com `cached: true` e 0 requisições externas ao Gemini. Ao importar uma nova transação naquele mês, a análise é invalidada e a chamada seguinte regenera o diagnóstico.

**Acceptance Scenarios**:

1. **Given** um usuário com transações no mês corrente e sem análise cacheada, **When** ele solicita a análise financeira via endpoint dedicado, **Then** o sistema gera o diagnóstico via Gemini utilizando a chave BYOK, armazena o resultado com prazo de validade (TTL de 24h) e hash do estado atual das transações, e retorna a resposta com indicador `cached: false`.
2. **Given** um usuário com análise financeira válida em cache para o mês, **When** ele solicita a análise novamente sem ter adicionado nenhuma nova transação, **Then** o sistema entrega os dados diretamente do cache sem acionar o Gemini, com indicador `cached: true` e tempo de resposta inferior a 100ms.
3. **Given** um usuário com análise em cache, **When** novas transações são importadas ou atualizadas no mesmo mês, **Then** o sistema invalida automaticamente o cache daquele mês, garantindo que a próxima consulta gere um diagnóstico atualizado.
4. **Given** um usuário solicitando a análise de um mês sem nenhuma movimentação financeira registrada, **When** a requisição é processada, **Then** o sistema retorna mensagem clara de ausência de dados sem disparar chamadas ao modelo de IA.

---

### User Story 2 - População Automatizada de Ambiente de Teste (Seed Pluggy e Chave .env) (Priority: P2)

Como desenvolvedor ou avaliador da plataforma, desejo executar um comando de seed automatizado que crie usuários de teste fictícios com transações reais da sandbox da Pluggy e a chave do Gemini configurada a partir do `.env`, para que eu possa testar e demonstrar todas as funcionalidades do backend imediatamente sem precisar realizar cadastros manuais repetitivos.

**Why this priority**: Elimina fricção no ciclo de desenvolvimento e avaliação, permitindo que a API e o banco de dados estejam prontos para testes de ponta a ponta com dados realistas logo após subir os containers.

**Independent Test**: Pode ser testado executando o script de seed (`npm run seed`) em um banco limpo ou existente; ao final, o script confirma a criação do usuário fictício, a vinculação criptografada da chave BYOK e a importação das transações da Pluggy Sandbox, permitindo login imediato e listagem de transações.

**Acceptance Scenarios**:

1. **Given** o arquivo `.env` configurado com `GOOGLE_GENERATIVE_AI_API_KEY` e `PLUGGY_API_KEY`, **When** o comando de seed é disparado, **Then** o sistema cria um usuário de teste pré-definido, criptografa e associa a chave BYOK nativa (AES-256-GCM) e sincroniza transações simuladas da sandbox da Pluggy.
2. **Given** que o comando de seed já foi executado previamente, **When** ele é executado novamente, **Then** o sistema opera com idempotência, atualizando o usuário existente e ignorando transações repetidas sem gerar registros duplicados.
3. **Given** a ausência de chaves de API no `.env` no momento do seed, **When** o script é executado, **Then** ele emite um alerta informativo claro e cria dados locais sintéticos de contingência para viabilizar testes básicos.

---

### User Story 3 - Expansão da Documentação Arquitetural e Operacional no README (Priority: P3)

Como um desenvolvedor ou arquiteto avaliando o repositório, desejo encontrar um README.md completo, bem estruturado e com diagramas visuais, para que eu compreenda a arquitetura, as premissas de segurança BYOK e LGPD, e consiga executar o projeto em poucos minutos.

**Why this priority**: O `README.md` é a porta de entrada do projeto. Uma documentação clara e diagramada valoriza a engenharia da solução, facilita a colaboração e assegura a transparência técnica da arquitetura.

**Independent Test**: Pode ser testado revisando o documento gerado contra a especificação para garantir que todos os 5 módulos originais mais os novos módulos (Cache e Seed), diagramas Mermaid de arquitetura e instruções do Docker Compose estejam presentes e corretos.

**Acceptance Scenarios**:

1. **Given** o repositório clonado, **When** um novo desenvolvedor lê o `README.md`, **Then** ele visualiza a proposta de valor, a stack tecnológica, os diagramas de arquitetura em camadas e o fluxo de dados do modelo BYOK.
2. **Given** as instruções de execução no `README.md`, **When** seguidas à risca, **Then** o desenvolvedor consegue subir o ecossistema com Docker Compose e rodar os testes de ponta a ponta sem erros.

---

### Edge Cases

- **Invalidação parcial em meses diferentes**: A importação de transações referentes ao mês de Setembro só deve invalidar o cache de Setembro, mantendo intacto o cache de Outubro.
- **Expiração natural do TTL (24h) sem novas transações**: Ao atingir a data limite de expiração (`expiresAt`), o sistema deve tratar a análise como expirada e regenerá-la na próxima solicitação, garantindo frescor temporal.
- **Indisponibilidade momentânea da API do Gemini durante a renovação da análise**: Se a IA falhar e houver uma análise em cache recém-expirada, o sistema deve fornecer a análise anterior com aviso de contingência antes de falhar completamente.
- **Falha de rede com a Pluggy Sandbox durante o seed**: O script de seed deve capturar o erro, exibir mensagem amigável e criar transações sintéticas locais para não bloquear o desenvolvedor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE fornecer endpoint protegido (`GET /api/analysis/:month`) para consulta e geração de análises financeiras mensais agregadas via IA.
- **FR-002**: O sistema DEVE persistir análises financeiras geradas na coleção `financial_analyses` no MongoDB, armazenando: `userId`, `month` (formato YYYY-MM), `diagnosis`, `recommendations`, `metrics` (receitas, despesas, saldo, maiores categorias), `transactionStateHash`, `generatedAt` e `expiresAt`.
- **FR-003**: O sistema DEVE calcular um hash determinístico do estado das transações do mês (`transactionStateHash`) baseado na quantidade de transações, total de receitas, total de despesas e data da última movimentação.
- **FR-004**: O sistema DEVE reaproveitar a análise existente no MongoDB sem efetuar requisições ao Gemini quando o `transactionStateHash` for idêntico e a data atual for menor que `expiresAt`, retornando a resposta com `cached: true`.
- **FR-005**: O sistema DEVE invalidar e regenerar a análise quando o hash do estado for alterado (novas transações inseridas/atualizadas) ou quando o TTL expirar, retornando a nova resposta com `cached: false`.
- **FR-006**: O TTL padrão de validade de uma análise financeira DEVE ser de 24 horas a partir da sua geração.
- **FR-007**: O sistema DEVE disponibilizar script executável de seed (`npm run seed` em `scripts/seed.ts`) para criação automática de usuários e dados de teste.
- **FR-008**: O script de seed DEVE criar um usuário de teste pré-definido e associar automaticamente a chave `GOOGLE_GENERATIVE_AI_API_KEY` do `.env` criptografada com `AES-256-GCM`.
- **FR-009**: O script de seed DEVE acionar a sincronização com o sandbox da Pluggy API para carregar lançamentos simulados, aplicando as regras de normalização e idempotência canônicas.
- **FR-010**: O script de seed DEVE ser estritamente idempotente, não duplicando usuários nem transações em execuções repetidas.
- **FR-011**: O arquivo `README.md` DEVE ser reformulado para incluir:
  - Visão geral da plataforma e proposta de valor.
  - Diagrama Mermaid de arquitetura em camadas e modelo de dados.
  - Diagrama Mermaid do fluxo de segurança BYOK (criptografia AES-256-GCM e ping ativo).
  - Descrição técnica detalhada de todos os módulos (Autenticação, Ingestão, Pluggy, Categorização IA, Consultoria Chat SSE, Cache com TTL e Seed).
  - Guia de início rápido com Docker Compose e execução do script de seed.
  - Documentação das variáveis de ambiente e documentação Swagger.

### Key Entities *(include if feature involves data)*

- **FinancialAnalysis**: Representa o diagnóstico financeiro mensal consolidado gerado pela IA. Contém:
  - `_id`: ObjectId
  - `userId`: ObjectId referenciando `User` (indexado)
  - `month`: string ("YYYY-MM")
  - `transactionStateHash`: string (hash MD5/SHA-256 do estado financeiro do mês)
  - `diagnosis`: string (texto analítico de visão geral e saúde orçamentária)
  - `recommendations`: array de strings (dicas acionáveis de corte de custos ou economia)
  - `metrics`: objeto contendo `{ totalIncome, totalExpenses, netBalance, topCategories }`
  - `generatedAt`: Date (momento da geração da inferência)
  - `expiresAt`: Date (momento limite de validade do cache - TTL)
  - **Índice Único Composto**: `{ userId: 1, month: 1 }` com `{ unique: true }`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O sistema atinge redução mínima de 90% no volume de chamadas e tokens consumidos no Gemini para consultas recorrentes sobre o mesmo mês enquanto as transações estiverem inalteradas.
- **SC-002**: O tempo de resposta para entrega de análises financeiras que atingem o cache (cache hit) é inferior a 100ms.
- **SC-003**: O script de seed executa o provisionamento de contas e transações da Pluggy em menos de 10 segundos em condições normais de rede.
- **SC-004**: Execuções consecutivas do script de seed produzem exatamente 0 usuários duplicados e 0 transações duplicadas (taxa de duplicação de 0%).
- **SC-005**: 100% dos módulos do sistema, fluxos de segurança e passos de inicialização estão documentados com diagramas visuais claros no `README.md`.

## Assumptions

- O TTL padrão de 24 horas para o cache da análise financeira é suficiente para equilibrar frescor e economia de cota de tokens.
- O usuário possui acesso à internet e credenciais válidas da Pluggy e do Google AI Studio configuradas no `.env` para execução completa do seed.
- Caso o usuário não tenha transações suficientes no mês para uma análise completa, o sistema entrega orientações prévias de registro sem consumir cota de IA.
- O seed é destinado prioritariamente aos ambientes de desenvolvimento e testes locais.
