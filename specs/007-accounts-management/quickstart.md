# Quickstart & Validation Guide: Gestão de Contas Bancárias e Cartões

**Feature**: `007-accounts-management`  
**Date**: 2026-10-19  
**Status**: Concluído (Phase 1)

Este guia descreve os cenários executáveis para validar ponta a ponta a funcionalidade de gestão de contas e sua integração com transações e importação de extratos.

---

## 1. Pré-requisitos e Ambiente

1. Servidor MongoDB ativo (via Docker Compose ou local):
   ```bash
   docker compose up -d mongodb
   ```
2. Dependências instaladas e TypeScript compilado:
   ```bash
   npm install
   npm run build
   ```
3. Usuário autenticado obtendo o token JWT:
   ```bash
   # Obter token de teste via login ou seed
   TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"teste@exemplo.com","password":"SenhaSegura123!"}' | jq -r '.token')
   ```

---

## 2. Cenários de Validação Ponta a Ponta

### Cenário 1: Listagem Inicial e Auto-provisionamento da "Conta Principal"
Ao listar contas pela primeira vez para um usuário que possui transações legadas:
```bash
curl -s -X GET http://localhost:3000/api/accounts \
  -H "Authorization: Bearer $TOKEN" | jq .
```
- **Resultado Esperado**:
  - `totalAccounts`: 1
  - Conta com nome `"Conta Principal"`, `type: "CHECKING"`, `initialBalance: 0`.
  - `balance`: reflete a soma de todas as transações pré-existentes.
  - `transactionCount`: igual ao total de transações associadas.

---

### Cenário 2: Criação de Nova Conta com Saldo Inicial
Cadastrar uma conta de cartão de crédito ou poupança:
```bash
ACCOUNT_RES=$(curl -s -X POST http://localhost:3000/api/accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nubank Roxinho",
    "type": "CREDIT_CARD",
    "initialBalance": 0,
    "institution": "Nu Pagamentos",
    "color": "#820AD1"
  }')

echo $ACCOUNT_RES | jq .
ACCOUNT_ID=$(echo $ACCOUNT_RES | jq -r '.id')
```
- **Resultado Esperado**: Status HTTP 201 Created com os dados da conta e `balance: 0`.

---

### Cenário 3: Validação de Unicidade de Nome (Conflito 409)
Tentar criar outra conta com o mesmo nome para o mesmo usuário:
```bash
curl -s -i -X POST http://localhost:3000/api/accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nubank Roxinho",
    "type": "CHECKING"
  }'
```
- **Resultado Esperado**: Status `HTTP 409 Conflict`.

---

### Cenário 4: Importação de Extrato Vinculado à Nova Conta
Importar um arquivo OFX ou CSV associando explicitamente o `accountId`:
```bash
curl -s -X POST "http://localhost:3000/api/transactions/upload?accountId=$ACCOUNT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@tests/fixtures/sample.ofx" | jq .
```
- **Resultado Esperado**: Transações importadas vinculadas à conta do Nubank.
- **Verificação**: `GET /api/accounts` agora exibe `Nubank Roxinho` com `transactionCount > 0` e `balance` atualizado.

---

### Cenário 5: Reatribuição de Transação via PATCH
Transferir uma transação de uma conta para outra:
```bash
# Obter ID da primeira transação
TX_ID=$(curl -s -X GET http://localhost:3000/api/transactions \
  -H "Authorization: Bearer $TOKEN" | jq -r '.transactions[0].id')

# Atualizar accountId da transação
curl -s -X PATCH "http://localhost:3000/api/transactions/$TX_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"accountId\": \"$ACCOUNT_ID\"}" | jq .
```
- **Resultado Esperado**: Status HTTP 200 OK com `accountId` atualizado.

---

### Cenário 6: Política de Exclusão Segura (Bloqueio 409 vs Cascata)
1. **Tentativa sem cascata (com transações vinculadas)**:
   ```bash
   curl -s -i -X DELETE "http://localhost:3000/api/accounts/$ACCOUNT_ID" \
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Resultado Esperado**: Status `HTTP 409 Conflict` (exclusão bloqueada).

2. **Exclusão confirmada com cascata (`?cascade=true`)**:
   ```bash
   curl -s -i -X DELETE "http://localhost:3000/api/accounts/$ACCOUNT_ID?cascade=true" \
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Resultado Esperado**: Status `HTTP 200 OK` ou `HTTP 204 No Content`. A conta e suas transações são eliminadas de forma atômica.

---

## 3. Execução dos Testes Automatizados da Feature

```bash
# Executar suíte de testes de contas e transações
npm test -- tests/accounts.test.ts tests/transactions.test.ts
```
- **Critério de Aceite**: 100% dos testes verdes sem falhas.
