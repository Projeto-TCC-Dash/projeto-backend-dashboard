# API Contract: Carteira de Investimentos e Alocação Patrimonial

**Base Path**: `/api/investments`  
**Authentication**: Bearer JWT (`requireAuth`)  

---

### 1. `GET /api/investments/holdings`

Retorna a distribuição patrimonial atual por macroclasses de ativos e o diagnóstico de calibração frente ao perfil de risco cadastrado do usuário.

#### Resposta de Sucesso (`200 OK`)
```json
{
  "totalInvested": 125000.00,
  "riskProfile": "CONSERVATIVE",
  "holdings": [
    { "macroClass": "CASH_LIQUIDITY", "amount": 40000.00, "percentage": 32.0 },
    { "macroClass": "FIXED_INCOME", "amount": 65000.00, "percentage": 52.0 },
    { "macroClass": "REAL_ESTATE", "amount": 12000.00, "percentage": 9.6 },
    { "macroClass": "EQUITIES", "amount": 8000.00, "percentage": 6.4 },
    { "macroClass": "INTERNATIONAL", "amount": 0.00, "percentage": 0.0 },
    { "macroClass": "CRYPTO", "amount": 0.00, "percentage": 0.0 }
  ],
  "allocationDiagnosis": {
    "adherentToRiskProfile": true,
    "recommendations": [
      "Sua carteira está bem calibrada com 84% em ativos defensivos e liquidez imediata, condizente com seu perfil Conservador.",
      "Sua reserva de emergência (R$ 40.000,00) cobre confortavelmente mais de 6 meses de suas despesas habituais."
    ]
  }
}
```

---

### 2. `PUT /api/investments/holdings`

Atualiza a posição financeira de uma macroclasse em uma conta de investimentos.

#### Corpo da Requisição (`body`)
```json
{
  "accountId": "653a1f9e2b1c8e0012f34a10",
  "macroClass": "FIXED_INCOME",
  "amount": 75000.00,
  "notes": "Aporte no Tesouro Selic 2029 e CDB pós-fixado 110% CDI"
}
```

#### Resposta de Sucesso (`200 OK`)
Retorna a carteira consolidada atualizada com novos percentuais calculados.
