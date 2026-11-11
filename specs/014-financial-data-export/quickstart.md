# Quickstart: Validação da Feature 014 — Central de Exportação

Este guia descreve como validar manualmente e via testes automatizados a funcionalidade de exportação nos formatos CSV, XLSX e PDF.

---

## 1. Pré-Requisitos

1. Servidor executando em desenvolvimento (`npm run dev`) ou ambiente de teste.
2. Usuário cadastrado e autenticado com transações geradas via seed (`npm run seed`).
3. Token de autenticação JWT obtido via `POST /api/auth/login`.

---

## 2. Cenários de Validação via cURL

### Cenário 1: Exportar em CSV (Mês Atual)
```bash
curl -X GET "http://localhost:3000/api/transactions/export?format=csv&month=2026-10" \
  -H "Authorization: Bearer <SEU_TOKEN_JWT>" \
  -o extrato_outubro.csv
```
**Validação esperada**:
- O arquivo `extrato_outubro.csv` é salvo no disco.
- Ao abrir com editor de texto, a primeira linha possui `Data;Descrição;Categoria;Conta;Tipo;Valor`.
- Os valores utilizam separador decimal vírgula (ex: `-150,00`).
- Ao abrir no Excel, os dados aparecem separados por colunas sem problemas de acentuação.

---

### Cenário 2: Exportar em XLSX com Filtro de Categoria
```bash
curl -X GET "http://localhost:3000/api/transactions/export?format=xlsx&category=Alimentação" \
  -H "Authorization: Bearer <SEU_TOKEN_JWT>" \
  -o alimentacao.xlsx
```
**Validação esperada**:
- O arquivo `alimentacao.xlsx` é salvo com extensão binária de planilha.
- Ao abrir no Microsoft Excel ou LibreOffice, apenas transações da categoria "Alimentação" são exibidas.
- As colunas de valor possuem formatação `R$ #,##0.00` e calculam somas nativamente.

---

### Cenário 3: Exportar Relatório em PDF com Intervalo de Datas
```bash
curl -X GET "http://localhost:3000/api/transactions/export?format=pdf&startDate=2026-10-01&endDate=2026-10-30" \
  -H "Authorization: Bearer <SEU_TOKEN_JWT>" \
  -o relatorio_outubro.pdf
```
**Validação esperada**:
- O arquivo `relatorio_outubro.pdf` é gerado.
- Ao abrir em um leitor de PDF, apresenta cabeçalho institucional, totalizador de Receitas/Despesas/Saldo Líquido e tabela formatada.

---

### Cenário 4: Validação de Erros de Parâmetros
```bash
# Data inicial posterior à data final
curl -X GET "http://localhost:3000/api/transactions/export?format=csv&startDate=2026-10-30&endDate=2026-10-01" \
  -H "Authorization: Bearer <SEU_TOKEN_JWT>"
```
**Validação esperada**: HTTP 400 Bad Request com mensagem indicando que `startDate` não pode ser posterior a `endDate`.

---

## 3. Validação Automatizada (Vitest)

Executar a suite de testes de integração específica da feature:
```bash
npx vitest run tests/integration/export.routes.test.ts
```
