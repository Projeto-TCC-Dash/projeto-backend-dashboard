# Quickstart: Validação da Feature 010

## Pré-requisitos
- Node.js >= 20.x e npm instalados.
- Instância do MongoDB ou suíte de testes automatizados.

---

## Cenário 1: Execução dos Testes Automatizados (TDD & Regressão)

```bash
# Executar testes da suíte de perfil de usuário
npm test -- tests/integration/user-profile.routes.test.ts tests/unit/user-service.test.ts

# Executar suíte completa
npm test
```

**Resultado Esperado**:
- Todos os testes passam (100% verdes).
- `GET /api/user/profile` retorna perfil cadastral e financeiro.
- `PUT /api/user/profile` atualiza os campos e invalida cache de análise.
- IA Gemini e Chatbot recebem o perfil do usuário como contexto.

---

## Cenário 2: Validação via API REST

### 1. Autenticar Usuário
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario@exemplo.com", "password": "Password123!"}' \
  | jq -r '.token')
```

### 2. Consultar Perfil Inicial
```bash
curl -i -X GET http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer $TOKEN"
```
**Resultado Esperado**: HTTP `200 OK` com dados cadastrais e `financialProfile: {}` ou preenchido.

### 3. Atualizar Perfil Financeiro
```bash
curl -i -X PUT http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "incomeType": "PJ_AUTONOMO",
    "declaredMonthlyIncome": 10000,
    "goals": ["RESERVA_EMERGENCIA", "INVESTIR_LONGO_PRAZO"],
    "riskProfile": "MODERATE"
  }'
```
**Resultado Esperado**: HTTP `200 OK` com os novos valores e `updatedAt`.
