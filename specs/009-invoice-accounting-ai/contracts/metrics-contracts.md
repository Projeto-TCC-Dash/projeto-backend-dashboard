# API Contracts: Feature 009

## `GET /api/analysis/:month`

Retorna a análise e diagnóstico financeiro do mês com as métricas consolidadas, contendo o campo segregado `invoiceSettlements`.

### Resposta HTTP 200 OK
```json
{
  "cached": true,
  "month": "2026-10",
  "diagnosis": "No mês de outubro de 2026, seu perfil de gastos apresentou forte disciplina financeira...",
  "recommendations": [
    "Mantenha a pontualidade na liquidação integral da fatura do seu cartão de crédito para evitar encargos rotativos.",
    "Avalie oportunidades de otimização nos gastos com alimentação que representaram 45% do orçamento primário."
  ],
  "metrics": {
    "totalIncome": 8500.00,
    "totalExpenses": 3200.00,
    "invoiceSettlements": 2400.00,
    "netBalance": 5300.00,
    "savingsRate": 62.4,
    "topCategories": [
      {
        "category": "Alimentação",
        "amount": 1440.00,
        "percentage": 45.0
      },
      {
        "category": "Transporte",
        "amount": 800.00,
        "percentage": 25.0
      },
      {
        "category": "Lazer",
        "amount": 500.00,
        "percentage": 15.6
      }
    ]
  },
  "generatedAt": "2026-10-19T21:00:00.000Z",
  "expiresAt": "2026-10-20T21:00:00.000Z"
}
```

#### Regras Contábeis Validadas no Contrato:
1. `metrics.totalExpenses` é a soma das despesas operacionais primárias e NÃO inclui o valor de `metrics.invoiceSettlements`.
2. A categoria `"Pagamento de Fatura"` NUNCA é retornada em `metrics.topCategories`.
3. A soma das porcentagens em `metrics.topCategories` tem como base 100% de `metrics.totalExpenses`.
