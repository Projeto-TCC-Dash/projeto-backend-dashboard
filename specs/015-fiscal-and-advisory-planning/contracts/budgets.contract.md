# API Contract: Orçamentos Mensais (Budgets)

**Base Path**: `/api/budgets`  
**Authentication**: Bearer JWT (`requireAuth`)  

---

### 1. `GET /api/budgets/:month`

Retorna o orçamento configurado e o consumo real consolidado para o mês informado (`YYYY-MM`).

#### Parâmetros de Rota (`params`)
- `month` (string, obrigatório): Formato `YYYY-MM` (ex: `2026-11`).

#### Resposta de Sucesso (`200 OK`)
```json
{
  "month": "2026-11",
  "totalLimitAmount": 6500.00,
  "totalSpentAmount": 4820.50,
  "totalRemainingAmount": 1679.50,
  "globalPercentConsumed": 74.2,
  "globalStatus": "WARNING",
  "categories": [
    {
      "category": "Alimentação",
      "limitAmount": 2000.00,
      "spentAmount": 1850.00,
      "remainingAmount": 150.00,
      "percentConsumed": 92.5,
      "status": "WARNING"
    },
    {
      "category": "Lazer",
      "limitAmount": 800.00,
      "spentAmount": 920.00,
      "remainingAmount": -120.00,
      "percentConsumed": 115.0,
      "status": "EXCEEDED"
    },
    {
      "category": "Transporte",
      "limitAmount": 1200.00,
      "spentAmount": 650.00,
      "remainingAmount": 550.00,
      "percentConsumed": 54.2,
      "status": "REGULAR"
    }
  ]
}
```

#### Respostas de Erro
- `400 Bad Request`: Formato de mês inválido.
- `401 Unauthorized`: Token JWT ausente ou expirado.
- `404 Not Found`: Nenhum orçamento configurado para o mês (retorna estrutura com `totalLimitAmount: 0`).

---

### 2. `PUT /api/budgets/:month`

Cria ou substitui o plano orçamentário do usuário para o mês informado.

#### Parâmetros de Rota (`params`)
- `month` (string, obrigatório): Formato `YYYY-MM`.

#### Corpo da Requisição (`body`)
```json
{
  "totalLimitAmount": 6500.00,
  "categoryBudgets": [
    { "category": "Alimentação", "limitAmount": 2000.00 },
    { "category": "Moradia", "limitAmount": 2500.00 },
    { "category": "Transporte", "limitAmount": 1200.00 },
    { "category": "Lazer", "limitAmount": 800.00 }
  ]
}
```

#### Resposta de Sucesso (`200 OK`)
Retorna o mesmo payload detalhado de `GET /api/budgets/:month` recalculado com o estado financeiro atual.
