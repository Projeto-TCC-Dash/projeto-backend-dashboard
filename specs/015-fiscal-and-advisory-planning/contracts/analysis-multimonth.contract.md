# API Contract: Diagnóstico Multi-Mês & Tendências Históricas

**Base Path**: `/api/analysis/multi-month`  
**Authentication**: Bearer JWT (`requireAuth`)  

---

### 1. `GET /api/analysis/multi-month`

Calcula métricas de agregação histórica em janelas temporais de 3, 6 ou 12 meses, identificando tendências de padrão de vida, taxa de poupança média e desvios de custo fixo.

#### Parâmetros de Busca (`querystring`)
- `range` (string opcional, enum: `"3" | "6" | "12"`, default: `"6"`): Número de meses retroativos a analisar a partir do mês corrente.

#### Resposta de Sucesso (`200 OK`)
```json
{
  "rangeMonths": 6,
  "averageSavingsRate": 21.8,
  "averageMonthlyExpenses": 6430.00,
  "averageMonthlyIncome": 8220.00,
  "fixedCostTrend": {
    "status": "GROWING",
    "percentageChange": 18.4,
    "alertCategory": "Moradia"
  },
  "monthlyHistory": [
    {
      "month": "2026-06",
      "totalIncome": 8000.00,
      "totalExpenses": 6100.00,
      "netBalance": 1900.00,
      "savingsRate": 23.7
    },
    {
      "month": "2026-07",
      "totalIncome": 8000.00,
      "totalExpenses": 6250.00,
      "netBalance": 1750.00,
      "savingsRate": 21.8
    },
    {
      "month": "2026-08",
      "totalIncome": 8500.00,
      "totalExpenses": 6400.00,
      "netBalance": 2100.00,
      "savingsRate": 24.7
    },
    {
      "month": "2026-09",
      "totalIncome": 8200.00,
      "totalExpenses": 6600.00,
      "netBalance": 1600.00,
      "savingsRate": 19.5
    },
    {
      "month": "2026-10",
      "totalIncome": 8300.00,
      "totalExpenses": 6550.00,
      "netBalance": 1750.00,
      "savingsRate": 21.0
    },
    {
      "month": "2026-11",
      "totalIncome": 8320.00,
      "totalExpenses": 6680.00,
      "netBalance": 1640.00,
      "savingsRate": 19.7
    }
  ]
}
```

#### Respostas de Erro
- `400 Bad Request`: Parâmetro `range` inválido.
- `401 Unauthorized`: Token ausente ou inválido.
