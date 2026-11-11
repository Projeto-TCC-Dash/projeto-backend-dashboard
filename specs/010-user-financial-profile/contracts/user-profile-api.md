# API Contracts: Feature 010

## 1. Obter Perfil do Usuário

### `GET /api/user/profile`
Retorna as informações cadastrais básicas e o perfil financeiro do usuário autenticado.

#### Autenticação
- Cabeçalho: `Authorization: Bearer <JWT_TOKEN>`
- Plugin: `preHandler: [requireAuth]`

#### Resposta HTTP 200 OK
```json
{
  "id": "67140f...",
  "email": "usuario@exemplo.com",
  "hasAiKey": true,
  "financialProfile": {
    "incomeType": "PJ_AUTONOMO",
    "declaredMonthlyIncome": 9500.00,
    "goals": [
      "RESERVA_EMERGENCIA",
      "INVESTIR_LONGO_PRAZO"
    ],
    "riskProfile": "MODERATE",
    "updatedAt": "2026-10-19T21:00:00.000Z"
  }
}
```

---

## 2. Atualizar Perfil Financeiro do Usuário

### `PUT /api/user/profile`
Atualiza os campos voluntários do perfil financeiro do usuário autenticado e invalida o cache de análises financeiras.

#### Autenticação
- Cabeçalho: `Authorization: Bearer <JWT_TOKEN>`
- Plugin: `preHandler: [requireAuth]`

#### Request Body
```json
{
  "incomeType": "CLT",
  "declaredMonthlyIncome": 6500.00,
  "goals": [
    "RESERVA_EMERGENCIA",
    "QUITAR_DIVIDAS"
  ],
  "riskProfile": "CONSERVATIVE"
}
```

#### Respostas HTTP

- **200 OK**: Retorna o perfil atualizado do usuário conforme `UserProfileResponseSchema`.
- **400 Bad Request**:
  ```json
  {
    "statusCode": 400,
    "error": "Bad Request",
    "message": "body/declaredMonthlyIncome: A renda declarada deve ser maior ou igual a zero"
  }
  ```
- **401 Unauthorized**:
  ```json
  {
    "statusCode": 401,
    "error": "Unauthorized",
    "message": "Token ausente ou inválido"
  }
  ```
