# Research & Technical Decisions: API REST do Backend Financeiro

**Feature**: `001-financial-backend-api`  
**Date**: 2026-10-13  
**Status**: Concluído (Fase 0)

Este documento registra as decisões de arquitetura e tecnologia adotadas para o backend da Plataforma de Inteligência Financeira Pessoal, em total alinhamento com a Constituição do projeto (`.specify/memory/constitution.md`) e os requisitos do usuário.

---

## 1. Runtime & Tipagem Estrita

### Decisão
- **Runtime**: Node.js 20 LTS (Iron).
- **Linguagem**: TypeScript 5.x em modo estrito (`strict: true`).
- **Configuração do Compilador (`tsconfig.json`)**:
  - `strict`: true
  - `noImplicitAny`: true
  - `strictNullChecks`: true
  - `noImplicitReturns`: true
  - `noUncheckedIndexedAccess`: true
  - `target`: "ES2022"
  - `module`: "NodeNext"
  - `moduleResolution`: "NodeNext"

### Justificativa
A gestão de dados financeiros e o manuseio de contratos polimórficos de extratos exigem previsibilidade e segurança de tipos em tempo de compilação. Node.js 20 oferece APIs nativas modernas (Fetch, Crypto nativo de alta performance) e suporte LTS corporativo.

---

## 2. Framework HTTP & Validação de Contratos

### Decisão
- **Framework**: Fastify 4.x / 5.x.
- **Ecossistema de Plugins**:
  - `@fastify/jwt`: Autenticação stateless com verificação de Bearer token em hook `onRequest`.
  - `@fastify/multipart`: Ingestão de uploads `.ofx` e `.csv` em stream/memória com limite de 10 MB.
  - `@fastify/cors`: Liberação controlada de cabeçalhos e origens para clientes da API.
  - `@fastify/swagger` + `@fastify/swagger-ui`: Geração automática de especificação OpenAPI 3.0 e console interativo em `/docs`.
  - `fastify-type-provider-zod`: Integração direta do Zod com o Fastify para tipagem estática e runtime de `params`, `query`, `body` e `response`.
- **Validação de DTOs e Ambiente**: Zod 3.x para schemas de ambiente (`env.ts`) e contratos de rotas.

### Justificativa
Fastify oferece rendimento até 2x superior ao Express com menor overhead de memória e suporte nativo a lifecycle hooks (`onRequest`, `preHandler`), essencial para os guards de autenticação JWT e verificação BYOK (HTTP 403). A integração com Zod unifica a fonte da verdade entre documentação OpenAPI e validação estrita.

---

## 3. Persistência de Dados & Modelagem NoSQL

### Decisão
- **Banco de Dados**: MongoDB 7.0 Community Edition executado via container Docker.
- **ODM**: Mongoose 8.x com TypeScript typesafe.
- **Collections**:
  1. `users`:
     - Identificador único (`_id`).
     - `email`: string única indexada.
     - `passwordHash`: string (derivada via `bcrypt` / `argon2` / `scrypt`).
     - `encryptedApiKey`: string (hex/base64 do texto cifrado da chave BYOK).
     - `iv`: string (vetor de inicialização de 12 bytes em hex).
     - `authTag`: string (tag de autenticação GCM de 16 bytes em hex).
     - `createdAt`: Date.
  2. `transactions`:
     - `userId`: ObjectId referenciando `users` (indexado).
     - `externalId`: string representando o `FITID` ou identificador externo.
     - `rawDescription`: string (descrição original recebida no extrato).
     - `cleanDescription`: string (descrição sanitizada e expurgada de PII).
     - `amount`: number (positivo para crédito, negativo para débito).
     - `date`: Date.
     - `category`: enum (`Alimentação`, `Transporte`, `Moradia`, `Saúde`, `Lazer`, `Educação`, `Outros`).
     - `source`: enum (`OFX`, `CSV`, `PLUGGY`).
     - **Índice Composto Único para Idempotência**: `{ userId: 1, externalId: 1 }` com `{ unique: true }`.
  3. `chat_sessions`:
     - `userId`: ObjectId referenciando `users` (indexado).
     - `messages`: array de subdocumentos `[{ role: 'user' | 'assistant', content: string, timestamp: Date }]`.
     - `createdAt` e `updatedAt`: Date.

### Justificativa
O modelo NoSQL de documentos do MongoDB acomoda a flexibilidade de transações originadas de múltiplos adaptadores heterogêneos. O índice único composto `(userId, externalId)` transfere a garantia definitiva de idempotência para o motor do banco de dados, prevenindo duplicidades em condições de corrida.

---

## 4. Criptografia BYOK com AES-256-GCM

### Decisão
- Utilizar exclusivamente o módulo nativo `crypto` do Node.js (`node:crypto`).
- **Algoritmo**: `aes-256-gcm`.
- **Chave Mestra**: `ENCRYPTION_KEY` definida via variável de ambiente (32 bytes / 256 bits).
- **Vetor de Inicialização (IV)**: 12 bytes (96 bits) gerados aleatoriamente a cada operação via `crypto.randomBytes(12)`.
- **Tag de Autenticação**: 16 bytes (128 bits) gerada por `cipher.getAuthTag()`.
- **Ciclo de Vida**: A chave descriptografada permanece em escopo local durante a chamada ao Gemini e é descartada logo em seguida, sem vazamento para variáveis globais ou logs.

### Justificativa
O modo Galois/Counter Mode (GCM) fornece confidencialidade e integridade autenticada, impedindo ataques de manipulação de ciphertext. O uso de IV aleatório por documento impede que chaves idênticas gerem cifras iguais.

---

## 5. Ingestão e Processamento de Extratos (OFX e CSV)

### Decisão
- **Parser OFX**: Utilizar biblioteca especializada `node-ofx-parser` (ou `ofx-data-extractor`) acoplada a um adaptador interno com tratamento de tolerância para tags SGML não fechadas (padrão de bancos brasileiros como Itaú, Bradesco, BB, Nubank).
- **Parser CSV**: Utilizar `csv-parse` com detecção de delimitador (`,`, `;`, `\t`) e tratamento de encoding UTF-8 / ISO-8859-1 (Latin1) via `iconv-lite`.
- **Pipeline de Sanitização (LGPD)**:
  - Expressões regulares para remoção de padrões de CPF (`\d{3}\.?\d{3}\.?\d{3}-?\d{2}`), CNPJ (`\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}`), agência/conta (`AG\s*\d+`, `CC\s*\d+`, etc.).
  - Remoção de códigos de autorização bancária e ruídos de transferências PIX.
- **Idempotência**:
  - Transações identificadas por `(userId, externalId)`. Operação de inserção via `bulkWrite` com `ordered: false` ignorando erros de duplicidade (`E11000 duplicate key`), garantindo que o processamento continue para transações inéditas.

### Justificativa
Extratos brasileiros apresentam inconsistências notórias de encoding e formatos. O pipeline local determinístico assegura conformidade total com a LGPD e garante que apenas descrições limpas sigam para a etapa de IA.

---

## 6. Integração Open Finance Simulado (Pluggy)

### Decisão
- Integração via API REST da Pluggy Sandbox utilizando credenciais `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` (ou `PLUGGY_API_KEY`).
- Normalização de transações retornadas pelo endpoint `/transactions` da Pluggy:
  - `externalId` = `transaction.id`.
  - `rawDescription` = `transaction.description`.
  - `amount` = `transaction.amount`.
  - `date` = `new Date(transaction.date)`.
  - `source` = `'PLUGGY'`.
- Submissão ao mesmo pipeline de idempotência e persistência das transações OFX/CSV.

---

## 7. Categorização com IA e Minimização de Tokens

### Decisão
- **SDK**: `@google/genai` (SDK oficial do Google Gen AI para Node.js).
- **Modelo Homologado**: `gemini-2.5-flash` (ou `gemini-1.5-flash`), combinando latência mínima (<1s) e custo insignificante.
- **Minimização Pré-LLM**:
  1. Sanitização local das descrições.
  2. Deduplicação em memória: agrupar 500 transações em um conjunto enxuto de estabelecimentos únicos (ex: 20 a 50 nomes).
  3. Envio à API do Gemini usando a chave descriptografada do usuário.
- **Structured Outputs**:
  - Configuração de `responseMimeType: "application/json"` e `responseSchema` com enumeração restrita das 7 categorias:
    `["Alimentação", "Transporte", "Moradia", "Saúde", "Lazer", "Educação", "Outros"]`.
- **Reassociação Local**:
  - Dicionário `Map<cleanDescription, Category>` utilizado para atualizar em lote todas as transações correspondentes no MongoDB.

---

## 8. Consultoria Financeira com Streaming Server-Sent Events (SSE)

### Decisão
- **Endpoint**: `POST /api/chat/stream`.
- **Protocolo**: Server-Sent Events (SSE) com headers:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
- **Injeção de Contexto**:
  - Agregação MongoDB calculando: total de entradas do mês, total de saídas do mês, saldo consolidado e distribuição de gastos por categoria.
  - Histórico de mensagens anteriores da sessão do chat.
  - Prompt de sistema configurando a persona de Consultor Financeiro Pessoal analítico, empático e prático.
- **Streaming**:
  - Consumo via `ai.models.generateContentStream(...)` do SDK `@google/genai`.
  - Encaminhamento de chunks formatados como `data: {"text": "..."}\n\n`.
  - Tratamento de aborto de requisição quando o cliente desconectar (`reply.raw.on('close', ...)`).

---

## 9. Containerização & Deploy (Docker Compose)

### Decisão
- **Dockerfile Multi-Stage**:
  - Estágio de build (`node:20-alpine`) instalando dependências e compilando TypeScript para `dist/`.
  - Estágio de produção enxuto (`node:20-alpine`) executando sob usuário sem privilégios `node`.
- **docker-compose.yml**:
  - Serviço `mongodb`: imagem `mongo:7.0`, volume persistente, healthcheck com `mongosh --eval 'db.adminCommand("ping")'`.
  - Serviço `api`: dependência condicional `depends_on: { mongodb: { condition: service_healthy } }`.
- **Healthcheck Endpoint**: Rota `GET /health` que verifica a conectividade ativa com o MongoDB.
