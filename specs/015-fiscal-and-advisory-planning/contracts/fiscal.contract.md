# API Contract: Módulo Fiscal & Comprovantes

**Base Path**: `/api/fiscal` & `/api/transactions/:id/fiscal`  
**Authentication**: Bearer JWT (`requireAuth`)  

---

### 1. `PATCH /api/transactions/:id/fiscal`

Atualiza a classificação fiscal de uma transação bancária.

#### Parâmetros de Rota (`params`)
- `id` (string, 24 caracteres hex): Identificador da transação.

#### Corpo da Requisição (`body`)
```json
{
  "isTaxDeductible": true,
  "taxCategory": "HEALTH",
  "providerDocument": "12345678000195",
  "providerName": "Hospital e Maternidade São Luiz",
  "deductibleAmount": 850.00,
  "status": "CONFIRMED",
  "notes": "Consulta cardiológica e exames admissionais"
}
```

#### Resposta de Sucesso (`200 OK`)
Retorna a transação completa atualizada incluindo o subobjeto `fiscal`.

#### Respostas de Erro
- `400 Bad Request`: Formato de documento inválido ou categoria fiscal não permitida.
- `401 Unauthorized`: Token ausente ou inválido.
- `404 Not Found`: Transação não encontrada ou não pertencente ao usuário autenticado.

---

### 2. `POST /api/fiscal/ocr`

Upload multipart de comprovante digital (imagem ou PDF) com extração inteligente via Gemini BYOK.

#### Segurança Adicional
- Exige chave BYOK cadastrada (`requireAiKey`).

#### Payload (`multipart/form-data`)
- `file`: Arquivo de comprovante (máx 10MB; PDF, JPG, PNG, WebP).
- `transactionId` (opcional): ID da transação a ser vinculada imediatamente caso já conhecida.

#### Resposta de Sucesso (`200 OK`)
```json
{
  "proofDocumentId": "653a1f9e2b1c8e0012f34a91",
  "originalFilename": "recibo-consulta-medica.pdf",
  "extractedData": {
    "providerDocument": "04123456000188",
    "providerName": "Clínica Pediátrica Santa Clara",
    "totalAmount": 450.00,
    "issueDate": "2026-11-10T14:30:00.000Z",
    "description": "Consulta de rotina pediátrica"
  },
  "suggestedMatches": [
    {
      "transactionId": "653a1f9e2b1c8e0012f34a50",
      "date": "2026-11-10T00:00:00.000Z",
      "amount": -450.00,
      "cleanDescription": "CLINICA SANTA CLARA",
      "confidence": "HIGH"
    }
  ]
}
```

---

### 3. `GET /api/fiscal/summary`

Retorna o consolidado anual de deduções fiscais e métricas de faturamento para autônomos/PJ.

#### Parâmetros de Busca (`querystring`)
- `year` (string, 4 dígitos): Ano-calendário base (ex: `2026`).

#### Resposta de Sucesso (`200 OK`)
```json
{
  "year": "2026",
  "totalDeductibleExpenses": 8450.00,
  "confirmedDeductibleExpenses": 7200.00,
  "pendingDocumentationExpenses": 1250.00,
  "byCategory": [
    {
      "taxCategory": "HEALTH",
      "totalAmount": 5400.00,
      "confirmedAmount": 5400.00,
      "pendingAmount": 0.00,
      "count": 6
    },
    {
      "taxCategory": "EDUCATION",
      "totalAmount": 3050.00,
      "confirmedAmount": 1800.00,
      "pendingAmount": 1250.00,
      "count": 3
    }
  ],
  "pjSummary": {
    "applicable": true,
    "grossRevenueYearToDate": 68500.00,
    "annualLimit": 81000.00,
    "ceilingPercentage": 84.6,
    "proLaboreTotal": 24000.00,
    "dividendsTotal": 38000.00
  }
}
```

---

### 4. `GET /api/fiscal/dossier`

Exporta o dossiê fiscal anual auditável em formato PDF ou XLSX.

#### Parâmetros de Busca (`querystring`)
- `year` (string, 4 dígitos): Ano-calendário base.
- `format` (string): `"pdf"` ou `"xlsx"`.

#### Resposta de Sucesso (`200 OK`)
- `Content-Type`: `application/pdf` ou `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- `Content-Disposition`: `attachment; filename="dossie-fiscal-2026.pdf"`.
