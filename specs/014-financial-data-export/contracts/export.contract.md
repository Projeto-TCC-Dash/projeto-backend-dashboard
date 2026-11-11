# API Contracts: Central de Exportação de Dados Financeiros

Este documento define os contratos HTTP e especificações de cabeçalhos e payloads para a Feature 014.

---

## 1. `GET /api/transactions/export`

Exporta o extrato de transações financeiras filtrado no formato especificado (CSV, XLSX ou PDF).

- **Protegido por Autenticação**: Sim (Exige cabeçalho `Authorization: Bearer <JWT>`).
- **Método**: `GET`
- **URL**: `/api/transactions/export`

### 1.1. Query Parameters

| Parâmetro | Tipo | Obrigatório? | Descrição / Formato |
|---|---|---|---|
| `format` | string | **Sim** | Formato de exportação: `"csv"`, `"xlsx"` ou `"pdf"`. |
| `month` | string | Não | Mês específico no formato `YYYY-MM` (ex: `2026-10`). |
| `startDate` | string | Não | Data inicial no formato `YYYY-MM-DD` (ex: `2026-10-01`). |
| `endDate` | string | Não | Data final no formato `YYYY-MM-DD` (ex: `2026-10-31`). Deve ser >= `startDate`. |
| `accountId` | string | Não | ID da conta bancária (24 caracteres hexadecimais). |
| `category` | string | Não | Categoria canônica válida do sistema (ex: `"Alimentação"`, `"Receita"`). |

---

### 1.2. Respostas de Sucesso (HTTP 200)

O endpoint responde com um stream binário ou buffer contendo o arquivo gerado com headers de download.

#### A. Formato CSV (`format=csv`)
- **Status**: `200 OK`
- **Cabeçalhos de Resposta**:
  - `Content-Type`: `text/csv; charset=utf-8`
  - `Content-Disposition`: `attachment; filename="extrato-<periodo>.csv"`
- **Corpo da Resposta**: Texto puro UTF-8 prefixado por BOM (`\uFEFF`) e delimitado por `;`:
  ```csv
  Data;Descrição;Categoria;Conta;Tipo;Valor
  30/10/2026;"Supermercado Pão de Açúcar";Alimentação;"Conta Principal";DESPESA;-184,50
  25/10/2026;"Salário Mensal";Receita;"Conta Principal";RECEITA;8500,00
  ```

#### B. Formato XLSX (`format=xlsx`)
- **Status**: `200 OK`
- **Cabeçalhos de Resposta**:
  - `Content-Type`: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition`: `attachment; filename="extrato-<periodo>.xlsx"`
- **Corpo da Resposta**: Binário de planilha Excel (.xlsx) contendo cabeçalho estilizado, formatação monetária `R$ #,##0.00` e tipos de dados nativos.

#### C. Formato PDF (`format=pdf`)
- **Status**: `200 OK`
- **Cabeçalhos de Resposta**:
  - `Content-Type`: `application/pdf`
  - `Content-Disposition`: `attachment; filename="relatorio-financeiro-<periodo>.pdf"`
- **Corpo da Resposta**: Binário de documento PDF diagramado com sumário de métricas e listagem de transações.

---

### 1.3. Respostas de Erro

#### `400 Bad Request`
Ocorre quando os parâmetros de query são inválidos (ex: `format` ausente, formato de data inválido, `startDate` posterior a `endDate`).
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "A data inicial (startDate) não pode ser posterior à data final (endDate)."
}
```

#### `401 Unauthorized`
Ocorre quando o token JWT não foi enviado ou expirou.
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Token de autenticação não fornecido ou inválido."
}
```

#### `404 Not Found`
Ocorre quando o `accountId` fornecido não foi encontrado ou não pertence ao usuário autenticado.
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Conta bancária informada não encontrada."
}
```
