# Quickstart & Validation Guide: Categorias Canônicas, Edição Manual e Seed

**Feature**: `006-transaction-categories-editing`  
**Date**: 2026-10-13  
**Status**: Ready for Verification

Este guia descreve o procedimento ponta a ponta para validar a nova taxonomia de categorias, a categoria inicial de extratos, a edição manual de transações e a documentação do seed.

---

## 1. Pré-requisitos e Configuração de Ambiente

Certifique-se de que o container do MongoDB está ativo e saudável:

```bash
docker compose up -d mongodb
```

Copie o `.env.example` atualizado ou verifique as variáveis:

```bash
cp .env.example .env
```

> **Verificação da Documentação**: Inspecione o `.env.example` e certifique-se de que a variável `GOOGLE_GENERATIVE_AI_API_KEY` está documentada com instruções claras de uso opcional para o seed.

---

## 2. Cenário 1: Execução do Seed Sintético e Login

Execute o script de seed para criar o usuário de teste e popular transações:

```bash
npm run seed
```

**Resultado Esperado**:
- O usuário `teste.usuario@exemplo.com` é criado ou recuperado.
- Transações sintéticas são inseridas de forma determinística e idempotente.
- Se `GOOGLE_GENERATIVE_AI_API_KEY` estiver configurada no `.env`, a análise é pré-aquecida. Se não estiver, o seed conclui com sucesso emitindo apenas aviso informativo.

Obtenha o token JWT fazendo login:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teste.usuario@exemplo.com","password":"SenhaForte#123"}' \
  | jq -r .token)
echo "JWT Token: $TOKEN"
```

---

## 3. Cenário 2: Importação de Extrato e Validação de "Não Categorizado"

Submeta um arquivo de extrato bancário de teste (.csv ou .ofx):

```bash
# Criar extrato CSV temporário de teste
cat << 'EOF' > /tmp/teste-extrato.csv
Data,Descricao,Valor
13/10/2026,POSTO SHELL EXTRA,-120.50
13/10/2026,PADARIA BELA VISTA,-35.00
13/10/2026,SALARIO EMPRESA XYZ,5500.00
EOF

curl -s -X POST http://localhost:3000/api/transactions/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/teste-extrato.csv" | jq .
```

Consulte as transações recém-importadas para verificar a categoria inicial:

```bash
curl -s -X GET "http://localhost:3000/api/transactions?source=CSV" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Resultado Esperado**:
- Todas as transações importadas retornam com `category: "Não Categorizado"`.

---

## 4. Cenário 3: Edição Manual de Transação via PATCH (`/api/transactions/:id`)

Capture o `id` da transação referente ao `SALARIO EMPRESA XYZ` obtido no passo anterior e edite para `"Receita"`:

```bash
TX_ID="<ID_DA_TRANSACAO>"

curl -s -X PATCH "http://localhost:3000/api/transactions/$TX_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "Receita",
    "cleanDescription": "Salário Mensal Outubro"
  }' | jq .
```

**Resultado Esperado**:
- Status HTTP 200 com payload contendo `category: "Receita"` e `cleanDescription: "Salário Mensal Outubro"`.

---

## 5. Cenário 4: Validação de Isolamento Multi-Tenant e Casos de Borda

1. **Id Inexistente ou de Outro Usuário**:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X PATCH "http://localhost:3000/api/transactions/507f1f77bcf86cd799439011" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"category": "Alimentação"}'
   ```
   **Resultado Esperado**: Código HTTP `404` (Not Found).

2. **Categoria Inválida**:
   ```bash
   curl -s -X PATCH "http://localhost:3000/api/transactions/$TX_ID" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"category": "CategoriaInvalida123"}' | jq .
   ```
   **Resultado Esperado**: Código HTTP `400` (Bad Request).

3. **Payload Vazio**:
   ```bash
   curl -s -X PATCH "http://localhost:3000/api/transactions/$TX_ID" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{}' | jq .
   ```
   **Resultado Esperado**: Código HTTP `400` (Bad Request).

---

## 6. Cenário 5: Testes Automatizados

Execute a suíte de testes unitários e de integração:

```bash
npm test
```

Valide a integridade estrita de tipos do TypeScript:

```bash
npm run typecheck
```
