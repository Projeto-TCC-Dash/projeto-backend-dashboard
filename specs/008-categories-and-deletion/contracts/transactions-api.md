# API Contracts: Feature 008

## 1. Exclusão de Transação

### `DELETE /api/transactions/:id`
Exclui uma transação individual permanentemente, garantindo isolamento multi-tenant e invalidando o cache de análises financeiras do usuário.

#### Autenticação
- Cabeçalho: `Authorization: Bearer <JWT_TOKEN>`
- Plugin: `preHandler: [requireAuth]`

#### Parâmetros de Rota (`params`)
Validado via `TransactionIdParamSchema`:
```typescript
export const TransactionIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de transação inválido'),
});
```

#### Respostas HTTP

- **204 No Content**
  - Corpo: Vazio
  - Descrição: Transação excluída com sucesso e cache de análise invalidado.

- **400 Bad Request**
  - Corpo:
    ```json
    {
      "statusCode": 400,
      "error": "Bad Request",
      "message": "params/id: ID de transação inválido"
    }
    ```

- **401 Unauthorized**
  - Corpo:
    ```json
    {
      "statusCode": 401,
      "error": "Unauthorized",
      "message": "Token ausente ou inválido"
    }
    ```

- **404 Not Found**
  - Corpo:
    ```json
    {
      "statusCode": 404,
      "error": "Not Found",
      "message": "Transação não encontrada ou acesso não autorizado"
    }
    ```

---

## 2. Atualização de Categoria de Transação

### `PATCH /api/transactions/:id`
Permite atualizar a categoria para qualquer uma das 11 categorias canônicas (incluindo `"Pagamento de Fatura"` e `"Investimentos"`).

#### Request Body
```json
{
  "category": "Pagamento de Fatura"
}
```
ou
```json
{
  "category": "Investimentos"
}
```

#### Resposta HTTP 200 OK
```json
{
  "id": "67140f...",
  "externalId": "OFX-12345",
  "rawDescription": "PAGTO FATURA NUBANK",
  "cleanDescription": "Pagamento Fatura Nubank",
  "amount": -1450.50,
  "date": "2026-10-15T12:00:00.000Z",
  "category": "Pagamento de Fatura",
  "source": "OFX"
}
```

---

## 3. Listagem com Filtro por Novas Categorias

### `GET /api/transactions?category=Pagamento de Fatura`
ou
### `GET /api/transactions?category=Investimentos`

#### Resposta HTTP 200 OK
Retorna `200 OK` com a lista de transações filtradas conforme `ListTransactionsResponseSchema`.
