# Quickstart: Validação da Feature 009

## Pré-requisitos
- Node.js >= 20.x e npm.
- Ambiente de desenvolvimento configurado (`.env`).

---

## Cenário 1: Execução dos Testes Automatizados (TDD & Regressão)

```bash
# Executar testes unitários de cálculo de métricas
npm test -- tests/unit/analysis.service.test.ts

# Executar testes de integração das rotas de análise e chat
npm test -- tests/integration/analysis.routes.test.ts tests/integration/chat.routes.test.ts

# Executar suíte completa
npm test
```

**Resultado Esperado**:
- Todos os testes passam (100% verdes).
- Transações de "Pagamento de Fatura" são segregadas em `invoiceSettlements`.
- `totalExpenses` e `topCategories` não contêm faturas.
- A taxa de poupança é preservada.

---

## Cenário 2: Validação via API REST

### 1. Criar transações de teste no mês atual
- 1 receita: R$ 5.000,00 (Salário)
- 1 despesa no cartão: -R$ 1.000,00 (Alimentação)
- 1 pagamento de fatura na conta: -R$ 1.000,00 (Pagamento de Fatura)

### 2. Consultar Métricas do Mês
```bash
curl -i -X GET http://localhost:3000/api/analysis/2026-10 \
  -H "Authorization: Bearer $TOKEN"
```

**Resultado Esperado**:
- `metrics.totalIncome`: 5000
- `metrics.totalExpenses`: 1000 (e NÃO 2000!)
- `metrics.invoiceSettlements`: 1000
- `metrics.netBalance`: 4000
- `metrics.savingsRate`: 80
- `metrics.topCategories[0].category`: "Alimentação" (e NUNCA "Pagamento de Fatura")
