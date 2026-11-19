# Quickstart & Validation Guide: Fiscal Planning & Advanced Financial Advisory

**Feature**: `015-fiscal-and-advisory-planning`  
**Date**: 2026-11-18  

Este guia detalha o roteiro de testes e validação ponta a ponta dos módulos de **Planejamento Fiscal** e **Consultoria Financeira Avançada**.

---

## 1. Pré-requisitos

1. **Servidor Local em Execução**:
   ```bash
   npm run dev
   ```
2. **Banco de Dados Populado com Usuário de Teste**:
   ```bash
   npm run seed
   ```
   *Credenciais geradas:*
   - E-mail: `teste.usuario@exemplo.com`
   - Senha: `SenhaForte#123`
   - Chave BYOK ativa do `.env`.

3. **Obter Token JWT de Autenticação**:
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"teste.usuario@exemplo.com","password":"SenhaForte#123"}' \
     | grep -o '"token":"[^"]*' | cut -d'"' -f4)
   ```

---

## 2. Cenários de Validação

### Cenário 1: Configurar e Acompanhar Orçamento Mensal (Budgets)

1. **Definir teto orçamentário para o mês corrente**:
   ```bash
   curl -s -X PUT http://localhost:3000/api/budgets/2026-11 \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "totalLimitAmount": 7000.00,
       "categoryBudgets": [
         { "category": "Alimentação", "limitAmount": 2000.00 },
         { "category": "Transporte", "limitAmount": 1000.00 },
         { "category": "Moradia", "limitAmount": 2500.00 },
         { "category": "Lazer", "limitAmount": 800.00 }
       ]
     }'
   ```
2. **Consultar o consumo em tempo real**:
   ```bash
   curl -s -X GET http://localhost:3000/api/budgets/2026-11 \
     -H "Authorization: Bearer $TOKEN"
   ```
   **Resultado Esperado**: Retorno JSON com `totalSpentAmount`, `globalPercentConsumed`, e o array de categorias indicando `spentAmount` e status (`REGULAR`, `WARNING` ou `EXCEEDED`).

---

### Cenário 2: Classificar Despesa Dedutível e Consultar Painel Fiscal

1. **Obter o ID de uma transação de saúde ou educação**:
   ```bash
   TX_ID=$(curl -s -X GET "http://localhost:3000/api/transactions?category=Saúde" \
     -H "Authorization: Bearer $TOKEN" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)
   ```
2. **Atualizar a classificação fiscal da transação**:
   ```bash
   curl -s -X PATCH "http://localhost:3000/api/transactions/$TX_ID/fiscal" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "isTaxDeductible": true,
       "taxCategory": "HEALTH",
       "providerDocument": "12345678000195",
       "providerName": "Hospital Geral de Especialidades",
       "deductibleAmount": 420.00,
       "status": "CONFIRMED"
     }'
   ```
3. **Consultar o sumário fiscal anual**:
   ```bash
   curl -s -X GET "http://localhost:3000/api/fiscal/summary?year=2026" \
     -H "Authorization: Bearer $TOKEN"
   ```
   **Resultado Esperado**: O sumário reporta `confirmedDeductibleExpenses` incrementado com os dados da despesa de saúde e o montante computado na categoria `HEALTH`.

---

### Cenário 3: Extração Inteligente de Comprovante (OCR Multimodal)

1. **Enviar imagem ou PDF de recibo médico**:
   ```bash
   curl -s -X POST http://localhost:3000/api/fiscal/ocr \
     -H "Authorization: Bearer $TOKEN" \
     -F "file=@./tests/fixtures/recibo-medico-amostra.pdf"
   ```
   **Resultado Esperado**: Status `200 OK` contendo `extractedData` com CNPJ, Razão Social e Valor extraídos, além de `suggestedMatches` apontando transações de débito bancário do mesmo valor.

---

### Cenário 4: Diagnóstico Multi-Mês e Tendência de Custos Fixos

1. **Consultar agregação histórica de 6 meses**:
   ```bash
   curl -s -X GET "http://localhost:3000/api/analysis/multi-month?range=6" \
     -H "Authorization: Bearer $TOKEN"
   ```
   **Resultado Esperado**: Resposta com `averageSavingsRate`, `fixedCostTrend` (`STABLE` ou `GROWING`) e histórico mensal estruturado.

---

### Cenário 5: Alocação Patrimonial de Investimentos

1. **Registrar alocação em Renda Fixa e Ações**:
   ```bash
   curl -s -X PUT http://localhost:3000/api/investments/holdings \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "accountId": "<ACCOUNT_ID>",
       "macroClass": "FIXED_INCOME",
       "amount": 50000.00
     }'
   ```
2. **Consultar diagnóstico de carteira**:
   ```bash
   curl -s -X GET http://localhost:3000/api/investments/holdings \
     -H "Authorization: Bearer $TOKEN"
   ```
   **Resultado Esperado**: Percentual por classe de ativo e recomendações calibradas com o perfil de risco do usuário (`adherentToRiskProfile`).

---

## 3. Testes Automatizados

Executar a suíte de testes de integração e unitários dedicados a esta feature:

```bash
# Executa testes unitários dos novos serviços
npm test tests/unit/budget.service.test.ts tests/unit/fiscal.service.test.ts tests/unit/investment.service.test.ts

# Executa testes de integração das novas rotas Fastify
npm test tests/integration/budgets.routes.test.ts tests/integration/fiscal.routes.test.ts tests/integration/investments.routes.test.ts tests/integration/analysis-multimonth.routes.test.ts

# Validação estática de tipos TypeScript estritos
npm run typecheck
```
