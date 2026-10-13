# Quickstart & Validation Guide: API REST do Backend Financeiro

**Feature**: `001-financial-backend-api`  
**Date**: 2026-10-13  
**Status**: Concluído (Fase 1)

Este guia fornece instruções práticas para executar o ambiente local e validar de ponta a ponta os fluxos da API REST do backend financeiro utilizando Docker Compose ou execução direta com Node.js.

---

## 1. Pré-Requisitos

- **Docker & Docker Compose** (versão 20.10+ e Compose v2+)
- **Node.js 20+** e **npm 10+** (para execução fora do container)
- **Chave de API do Google AI Studio** (para teste de BYOK e categorização/chat)
- Arquivo `.env` configurado na raiz do projeto (baseado em `.env.example`)

---

## 2. Configuração de Variáveis de Ambiente

Crie o arquivo `.env` na raiz do projeto com as chaves obrigatórias:

```env
# Porta do Servidor
PORT=3000
HOST=0.0.0.0

# Conexão MongoDB
MONGODB_URI=mongodb://localhost:27017/financial_db

# Segredos Criptográficos e de Sessão
JWT_SECRET=super_secret_jwt_key_minimum_32_characters_long_12345
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Integração Pluggy Sandbox (opcional para testes de extrato local)
PLUGGY_CLIENT_ID=seu_client_id_sandbox
PLUGGY_CLIENT_SECRET=seu_client_secret_sandbox
```

---

## 3. Inicialização do Ambiente

### Opção A: Execução via Docker Compose (Recomendado)

Inicie todos os serviços com healthcheck automático:

```bash
docker compose up --build -d
```

Verifique o status dos containers:

```bash
docker compose ps
```

O container `api` aguardará o healthcheck saudável do container `mongodb` antes de aceitar conexões.

### Opção B: Execução Local para Desenvolvimento

1. Suba apenas o MongoDB via Docker:
   ```bash
   docker compose up -d mongodb
   ```
2. Instale as dependências e inicie em modo watch:
   ```bash
   npm install
   npm run dev
   ```

---

## 4. Roteiro de Validação Ponta a Ponta

### Cenário 1: Verificação de Prontidão da API (Healthcheck)

```bash
curl -X GET http://localhost:3000/health
```

**Resultado Esperado**:
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

### Cenário 2: Registro e Autenticação de Usuário (JWT)

1. **Registrar usuário**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email": "usuario@exemplo.com", "password": "SenhaForte#123"}'
   ```
2. **Obter Token no Login**:
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "usuario@exemplo.com", "password": "SenhaForte#123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
   echo "Token JWT: $TOKEN"
   ```

---

### Cenário 3: Validação do Bloqueio de Rotas Analíticas (HTTP 403)

Tentar categorizar transações antes de configurar a chave BYOK:

```bash
curl -i -X POST http://localhost:3000/api/transactions/categorize \
  -H "Authorization: Bearer $TOKEN"
```

**Resultado Esperado**:
`HTTP/1.1 403 Forbidden` com indicação de que o usuário não possui chave BYOK cadastrada.

---

### Cenário 4: Configuração da Chave BYOK com Ping Ativo

Cadastrar a chave do Google AI Studio com validação ativa no Gemini:

```bash
curl -X PUT http://localhost:3000/api/user/ai-key \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "SUA_API_KEY_DO_GOOGLE_AI_STUDIO"}'
```

**Resultado Esperado**:
```json
{
  "success": true,
  "message": "Chave BYOK do Google Gemini validada e armazenada com criptografia."
}
```

---

### Cenário 5: Ingestão de Extrato OFX e Teste de Idempotência

1. **Upload inicial de extrato**:
   ```bash
   curl -X POST http://localhost:3000/api/transactions/upload \
     -H "Authorization: Bearer $TOKEN" \
     -F "file=@caminho/para/extrato.ofx"
   ```
   **Resultado Esperado**:
   ```json
   {
     "totalExtracted": 10,
     "imported": 10,
     "duplicatesIgnored": 0
   }
   ```

2. **Reenvio do mesmo extrato (Teste de Idempotência)**:
   ```bash
   curl -X POST http://localhost:3000/api/transactions/upload \
     -H "Authorization: Bearer $TOKEN" \
     -F "file=@caminho/para/extrato.ofx"
   ```
   **Resultado Esperado**:
   ```json
   {
     "totalExtracted": 10,
     "imported": 0,
     "duplicatesIgnored": 10
   }
   ```

---

### Cenário 6: Categorização Inteligente via IA

Disparar a categorização das transações importadas:

```bash
curl -X POST http://localhost:3000/api/transactions/categorize \
  -H "Authorization: Bearer $TOKEN"
```

**Resultado Esperado**:
```json
{
  "uniqueMerchantsAnalyzed": 5,
  "transactionsUpdated": 10
}
```

---

### Cenário 7: Consultoria Financeira com Streaming SSE

Enviar pergunta ao consultor e receber resposta em tempo real via Server-Sent Events:

```bash
curl -N -X POST http://localhost:3000/api/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Qual foi a minha maior categoria de despesa este mês e como posso economizar?"}'
```

**Resultado Esperado**:
Fluxo contínuo de eventos no terminal:
```text
data: {"text": "Olá! "}
data: {"text": "Analisando seu extrato de outubro..."}
data: {"done": true}
```
