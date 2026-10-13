# Feature Specification: Reestruturação da Pluggy para Motor Interno de Seed e Amostragem de Dados

**Feature Branch**: `003-pluggy-sandbox-seed`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Reestruturar o uso da Pluggy para atuar exclusivamente como motor interno de amostragem de dados e seed: 1. Remover a rota pública de integração POST /api/integrations/pluggy/sync, mantendo a API do usuário final focada estritamente na ingestão de extratos OFX/CSV. 2. Evoluir o script de seed (npm run seed) para consumir a API da Pluggy criando dinamicamente uma conexão de sandbox (connectorId: 2 com credenciais de teste) e baixando a massa histórica completa de transações bancárias fictícias para popular o banco de desenvolvimento/testes. 3. Atualizar a documentação do README e Swagger refletindo a Pluggy como ferramenta de teste/amostragem e não como produto final de Open Finance."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - População Automatizada com Massa de Dados da Sandbox da Pluggy (Priority: P1) 🎯 MVP

Como desenvolvedor ou avaliador que precisa demonstrar e testar o dashboard financeiro com volumetria e riqueza de lançamentos bancários brasileiros, desejo que o script de seed (`npm run seed`) se conecte à API da Pluggy, crie dinamicamente uma conexão bancária na sandbox com credenciais simuladas e baixe o histórico completo de transações bancárias de teste, para que o MongoDB seja povoado instantaneamente com dados realistas sem depender de cadastros manuais nem de conexões estáticas criadas no painel da Pluggy.

**Why this priority**: É o objetivo central do uso da Pluggy no projeto: atuar como uma "fábrica de dados sintéticos do Open Finance" para enriquecer o banco de dados com dados autênticos para testes da IA, categorização e gráficos.

**Independent Test**: Pode ser testado executando `npm run seed` com uma chave ativa da Pluggy no `.env`. O script cria a conexão com a sandbox, aguarda a sincronização, baixa as transações e as persiste associadas ao usuário de teste. Execuções repetidas confirmam idempotência (0 duplicatas).

**Acceptance Scenarios**:

1. **Given** a variável `PLUGGY_API_KEY` configurada no `.env`, **When** o comando `npm run seed` é executado, **Then** o sistema aciona a API da Pluggy (`POST /items`) solicitando a criação de uma conexão no conector Sandbox (`connectorId: 2`) com credenciais de teste (`user-ok` / `password-ok`), aguarda o status `UPDATED`, baixa todas as contas e transações geradas, sanitiza via LGPD e persiste no MongoDB.
2. **Given** indisponibilidade de rede ou ausência de chave da Pluggy válida, **When** o script de seed é executado, **Then** o sistema exibe aviso amigável e aplica fixtures locais simuladas, garantindo que o provisionamento do ambiente nunca seja bloqueado.
3. **Given** que o comando de seed já foi executado anteriormente, **When** for acionado novamente, **Then** o sistema opera com idempotência estrita, ignorando transações já existentes com base no índice único `{ userId, externalId }`.

---

### User Story 2 - Foco Estrito da API Pública em Ingestão de Extratos (OFX/CSV) (Priority: P2)

Como usuário final ou desenvolvedor consumindo a API, desejo que os endpoints públicos da aplicação sejam focados unicamente nas capacidades reais de produto do usuário (ingestão de arquivos de extrato OFX e CSV, categorização inteligente, consultoria via chat e diagnósticos analíticos com cache), sem a exposição de rotas públicas confusas de integração Open Finance da Pluggy.

**Why this priority**: A Pluggy é uma ferramenta exclusiva de desenvolvimento e amostragem de dados para teste, não um produto voltado ao usuário final neste repositório. Manter endpoints públicos de sincronização da Pluggy polui o catálogo de APIs e cria falsas expectativas de integração para o cliente final.

**Independent Test**: Pode ser testado inspecionando o catálogo de rotas do Swagger UI em `/docs`: a rota `/api/integrations/pluggy/sync` não deve mais existir e chamadas HTTP a esse caminho devem responder com 404 Not Found.

**Acceptance Scenarios**:

1. **Given** o servidor em execução, **When** o catálogo Swagger (`/docs`) ou as rotas da aplicação são consultados, **Then** nenhuma rota sob `/api/integrations/pluggy` está listada ou acessível.
2. **Given** um cliente HTTP enviando requisição para `POST /api/integrations/pluggy/sync`, **When** a rota é processada, **Then** o servidor responde 404 (Not Found).
3. **Given** a ingestão de transações para usuários finais normais, **When** o usuário envia arquivos via `POST /api/transactions/upload`, **Then** extratos OFX e CSV continuam sendo processados normalmente com sanitização e deduplicação.

---

### User Story 3 - Documentação Arquitetural e Operacional Atualizada (Priority: P3)

Como desenvolvedor ou arquiteto avaliando a base de código, desejo que o `README.md` e a documentação dos serviços reflitam com precisão que a Pluggy é uma ferramenta de teste e amostragem de dados sintéticos para o script de seed, e não um conector de produção exposto aos clientes.

**Why this priority**: Clareza documental evita mal-entendidos sobre o modelo de negócio da aplicação e evidencia as escolhas arquiteturais pragmáticas do projeto.

**Independent Test**: Revisão visual do `README.md` confirmando a explicação do papel da Pluggy no script de seed e a ausência do endpoint nas tabelas de rotas públicas do usuário final.

**Acceptance Scenarios**:

1. **Given** o `README.md`, **When** um desenvolvedor lê a seção de módulos e catálogo de APIs, **Then** ele identifica a Pluggy como motor interno do script de seed e visualiza apenas os endpoints de usuário final na tabela da API.

---

### Edge Cases

- **Tempo excessivo de sincronização da Pluggy Sandbox**: Caso o polling do item na Pluggy ultrapasse 30 segundos sem atingir o status `UPDATED`, o script deve abortar graciosamente o polling e chavear para a fixture simulada local com mensagem explicativa.
- **Rate Limit na API da Pluggy**: Se a Pluggy responder com HTTP 429 ou erro de cota, o fallback de fixtures locais assume o controle para não quebrar o pipeline de seed.
- **Paginação de transações**: Se a sandbox retornar mais de 100 transações divididas em páginas, o coletor deve iterar pelas páginas até baixar a massa de dados completa ou o limite razoável estipulado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE desativar e remover a rota pública `POST /api/integrations/pluggy/sync` e seus schemas associados da camada de rotas HTTP do Fastify.
- **FR-002**: O módulo `PluggyService` DEVE ser mantido como serviço utilitário interno para consumo pelo script de seed (`scripts/seed.ts`), não sendo registrado como rota HTTP pública.
- **FR-003**: O `PluggyService` DEVE implementar método para criar dinamicamente itens na sandbox da Pluggy (`POST https://api.pluggy.ai/items`) com conector Sandbox (`connectorId: 2`) e credenciais padrão simuladas (`user-ok` / `password-ok`), autenticado via `PLUGGY_API_KEY`.
- **FR-004**: O `PluggyService` DEVE executar polling consultando periodicamente o status do item (`GET /items/:id`) até atingir `UPDATED` (com timeout máximo de 30 segundos).
- **FR-005**: O `PluggyService` DEVE buscar todas as contas bancárias associadas ao item (`GET /accounts?itemId=:id`) e todas as transações de cada conta (`GET /transactions?accountId=:id`).
- **FR-006**: O sistema DEVE submeter as transações obtidas da Pluggy ao `SanitizerService` para expurgo de dados sensíveis e converter os lançamentos para o modelo canônico `ParsedTransaction`.
- **FR-007**: O script `scripts/seed.ts` DEVE acionar o método autônomo do `PluggyService` para popular o usuário de teste `teste.pluggy@exemplo.com` diretamente com os lançamentos da sandbox.
- **FR-008**: Em caso de falha de conexão ou ausência de chave da Pluggy, o `scripts/seed.ts` DEVE utilizar automaticamente as fixtures simuladas locais de contingência.
- **FR-009**: O processo de importação DEVE ser estritamente idempotente via `TransactionService.importTransactions`, garantindo que múltiplas execuções do seed não dupliquem transações no MongoDB.
- **FR-010**: O `README.md` DEVE ser atualizado removendo a menção à rota pública da Pluggy e descrevendo a Pluggy como motor de amostragem de dados no guia do seed.

### Key Entities *(include if feature involves data)*

- **Pluggy Sandbox Item**: Representa a conexão bancária simulada criada na sandbox da Pluggy (`id`, `status: 'UPDATED' | 'UPDATING' | 'LOGIN_ERROR'`).
- **ParsedTransaction**: Estrutura canônica interna contendo `externalId`, `rawDescription`, `cleanDescription`, `amount`, `date` e `source: 'PLUGGY'`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 rotas públicas da Pluggy expostas na documentação Swagger (`/docs`) ou acessíveis na API HTTP.
- **SC-002**: O comando `npm run seed` conecta e baixa transações simuladas da Pluggy Sandbox em menos de 20 segundos em condições normais de rede.
- **SC-003**: 0 transações duplicadas em execuções repetidas do comando de seed (100% de idempotência).
- **SC-004**: 100% dos testes da suíte (`vitest`) passam com sucesso após a remoção da rota pública e refatoração do seed.

## Assumptions

- O desenvolvedor possui conexão com a internet e `PLUGGY_API_KEY` válida no `.env` para usar a API ao vivo, mas o fallback garante funcionamento offline caso necessário.
- O conector Sandbox da Pluggy (`connectorId: 2`) com credenciais `user-ok` e `password-ok` é o ambiente oficial homologado pela documentação da Pluggy para simulações bancárias.
- O usuário final continua utilizando a ingestão por extratos bancários em arquivo (OFX e CSV), que é a funcionalidade de produto pretendida.
