# Quickstart: Validação da Feature 008

## Pré-requisitos
- Node.js >= 20.x e npm instalados.
- Instância do MongoDB em execução (via Docker Compose ou local) ou suíte de testes com banco em memória.
- Variáveis de ambiente configuradas (`.env` ou variáveis de teste).

---

## Cenário 1: Execução dos Testes Automatizados (TDD & Regressão)
Executar a suíte de testes unitários e de integração para validar as novas categorias canônicas, o endpoint de exclusão pontual e a invalidação de cache.

```bash
# Executar testes da suíte de transações
npm test -- tests/integration/transactions.test.ts tests/unit/categorization.test.ts

# Executar suíte completa de testes
npm test
```

**Resultado Esperado**:
- Todos os testes passam (100% verdes).
- `DELETE /api/transactions/:id` retorna `204` para transações do próprio usuário.
- `DELETE /api/transactions/:id` retorna `404` para ID inexistente ou de outro usuário.
- `DELETE /api/transactions/:id` retorna `400` para ID malformado.
- Invalidação de cache executa sem falhas.

---

## Cenário 2: Validação Manual via API

### 1. Autenticar e Obter Token JWT
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "teste@usuario.com", "password": "Password123!"}' \
  | jq -r '.token')
```

### 2. Atualizar Transação para Nova Categoria Canônica
```bash
curl -i -X PATCH http://localhost:3000/api/transactions/<TRANSACTION_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category": "Pagamento de Fatura"}'
```
**Resultado Esperado**: HTTP `200 OK` com `category: "Pagamento de Fatura"`.

### 3. Filtrar Transações pela Nova Categoria
```bash
curl -i -X GET "http://localhost:3000/api/transactions?category=Pagamento%20de%20Fatura" \
  -H "Authorization: Bearer $TOKEN"
```
**Resultado Esperado**: HTTP `200 OK` listando apenas transações com a categoria selecionada.

### 4. Excluir Transação
```bash
curl -i -X DELETE http://localhost:3000/api/transactions/<TRANSACTION_ID> \
  -H "Authorization: Bearer $TOKEN"
```
**Resultado Esperado**: HTTP `204 No Content`.

### 5. Verificar Exclusão
```bash
curl -i -X DELETE http://localhost:3000/api/transactions/<TRANSACTION_ID> \
  -H "Authorization: Bearer $TOKEN"
```
**Resultado Esperado**: HTTP `404 Not Found`.
