# Research & Architecture Decisions: Gestão de Contas Bancárias e Cartões

**Feature**: `007-accounts-management`  
**Date**: 2026-10-19  
**Status**: Concluído (Phase 0)

---

## 1. Modelagem da Entidade `Account` e Unicidade Multi-tenant

### Decisão
Criar o modelo Mongoose `Account` na coleção `accounts` com schema estrito:
- `_id`: `mongoose.Types.ObjectId`
- `userId`: `mongoose.Types.ObjectId` (ref: 'User', obrigatório, indexado)
- `name`: `string` (trim, 1 a 50 caracteres)
- `type`: `AccountType` (`'CHECKING' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH' | 'OTHER'`)
- `initialBalance`: `number` (padrão `0`)
- `institution`: `string` opcional (máx 100 caracteres)
- `color`: `string` opcional (formato hex `#RRGGBB`)
- Timestamps: `createdAt`, `updatedAt`

Aplicar índice composto único `{ userId: 1, name: 1 }` com ordenação e collation padrão (case-insensitive ou sanitizado para lowercase/trimmed na validação Zod) para garantir que um usuário não possa criar duas contas ativas com o mesmo nome.

### Justificativa
- Permite segregação multi-tenant nativa no MongoDB com custo zero de colisão entre usuários distintos.
- Tipos de conta padronizados cobrem todas as categorias essenciais do mercado financeiro brasileiro (contas correntes, cartões de crédito, carteiras de investimento, caixinha/dinheiro físico).
- O campo `initialBalance` atende à clarificação aprovada na especificação, viabilizando conciliação patrimonial sem transações fictícias.

### Alternativas Consideradas
- *Subdocumentos dentro de `User`*: Rejeitado porque relacionar transações a subdocumentos dificulta índices, queries relacionais (`$lookup` ou agregações diretas) e atualizações atômicas.
- *Permitir nomes duplicados com diferenciação por ID*: Rejeitado por prejudicar a experiência do usuário (UX) em seletores de conta no frontend.

---

## 2. Cálculo de Saldo Consolidado e Contagem de Lançamentos

### Decisão
Calcular o resumo de cada conta (`balance` e `transactionCount`) de forma agregada no momento da consulta (`GET /api/accounts`):
1. Buscar contas do usuário via `AccountModel.find({ userId })`.
2. Executar agregação otimizada no `TransactionModel` agrupando por `accountId`:
   ```typescript
   TransactionModel.aggregate([
     { $match: { userId: userObjectId } },
     {
       $group: {
         _id: '$accountId',
         transactionsTotal: { $sum: '$amount' },
         count: { $sum: 1 },
       },
     },
   ]);
   ```
3. Mapear cada conta: `balance = account.initialBalance + (group?.transactionsTotal ?? 0)`.

### Justificativa
- Garante consistência transacional absoluta: o saldo nunca fica dessincronizado de transações criadas, editadas ou excluídas.
- Dispensa transações distribuídas ou sincronizações complexas em dois documentos diferentes a cada importação.
- O volume típico de contas por usuário (3 a 15 contas) torna a agregação indexada por `{ userId: 1, accountId: 1 }` instantânea (<5ms no MongoDB).

### Alternativas Consideradas
- *Armazenar `currentBalance` denormalizado no documento da conta*: Rejeitado para v1.1.0 para evitar race conditions em importações concorrentes e risco de saldo fantasma em caso de falhas parciais.

---

## 3. Política de Exclusão Segura e Tratamento em Cascata

### Decisão
No endpoint `DELETE /api/accounts/:id`:
1. Validar se a conta existe e pertence ao `userId` autenticado.
2. Contar quantas transações ativas estão vinculadas a esse `accountId`:
   - Se `count === 0`: Excluir a conta e retornar `204 No Content` (ou confirmação `200 OK`).
   - Se `count > 0` e `query.cascade !== 'true'`: Bloquear a exclusão e responder com `HTTP 409 Conflict`, payload `{ statusCode: 409, error: "Conflict", message: "A conta possui X transações vinculadas. Para excluir a conta juntamente com todas as suas transações, utilize ?cascade=true." }`.
   - Se `count > 0` e `query.cascade === 'true'`: Executar exclusão atômica em lote (`TransactionModel.deleteMany({ userId, accountId })` seguido de `AccountModel.deleteOne({ _id, userId })`).
3. Bloquear a exclusão se a conta a ser excluída for a única conta restante do usuário (`totalUserAccounts <= 1`), retornando `HTTP 400 Bad Request` com mensagem informativa.

### Justificativa
- Atende diretamente à decisão aprovada em [spec.md](./spec.md) (Q1: Opção A).
- Previne perda acidental de dados financeiros históricos sem bloquear o usuário que deseja intencionalmente realizar uma limpeza geral de extratos associados à conta.
- Garante que o usuário nunca fique em estado inválido de "zero contas".

### Alternativas Consideradas
- *Soft-delete com flag `deletedAt`*: Rejeitado para v1.1.0 para manter simplicidade do schema (KISS) e não complexificar os filtros do MongoDB.

---

## 4. Provisionamento Automático da "Conta Principal" (Onboarding & Migração Legada)

### Decisão
Implementar no `AccountService`:
`getOrCreateDefaultAccount(userId: string): Promise<IAccount>`
1. Buscar conta do usuário com `{ userId, name: DEFAULT_ACCOUNT_NAME }` (ou a primeira conta criada).
2. Se não existir nenhuma conta para o usuário:
   - Criar atomicamente `AccountModel.create({ userId, name: 'Conta Principal', type: 'CHECKING', initialBalance: 0, color: '#2563EB' })`.
3. Associar transações legadas do usuário que possuam `accountId: null` ou `accountId: { $exists: false }` executando `TransactionModel.updateMany({ userId, accountId: null }, { $set: { accountId: defaultAccount._id } })`.

Essa rotina é invocada idempotentemente:
- Na rota `GET /api/accounts` (se o usuário não possuir contas cadastradas).
- Na rota de importação de extratos (`/api/transactions/upload`) caso nenhum `accountId` seja fornecido na requisição.
- No script de seed sintético local (`src/scripts/seed.ts`).

### Justificativa
- Zero intervenção manual de migração: usuários existentes e novos usuários têm transição invisível e fluida.
- Cumpre integralmente o requisito de retrocompatibilidade do [ROADMAP.md](../../ROADMAP.md) e Princípio V da Constituição.

---

## 5. Ingestão de Extratos com Associação a Contas (OFX e CSV)

### Decisão
Na rota `POST /api/transactions/upload`:
- O schema aceita `accountId` via query string (`?accountId=...`) ou multipart field.
- Validação: se fornecido, valida se é um ObjectId válido e se a conta existe e pertence ao usuário (`userId`). Se inválida, retorna `HTTP 400 / 404`.
- Se omitido: invoca `AccountService.getOrCreateDefaultAccount(userId)` e atribui o ID da Conta Principal a todas as transações inseridas no lote (`$setOnInsert: { accountId }`).
- Conformidade LGPD: metadados do extrato OFX (como tags `<BANKID>` ou `<ACCTID>`) continuam sendo descartados na camada de parsing; nenhuma informação crua de agência ou conta é salva no banco.

---

## 6. Reatribuição de Conta via Edição Parcial de Transação

### Decisão
Expandir o endpoint `PATCH /api/transactions/:id`:
- Schema Zod `UpdateTransactionBodySchema` passa a aceitar opcionalmente `accountId?: string` (validado como ObjectId hexadecimal de 24 caracteres).
- No `TransactionService.updateTransaction`:
  - Se `accountId` fornecido: busca a conta `{ _id: accountId, userId }`. Se não encontrada, lança erro ou retorna `400/404` indicando que a conta informada não existe ou não pertence ao usuário autenticado.
  - Atualiza o campo `accountId` no documento da transação.

### Justificativa
- Permite que o usuário transfira lançamentos importados por engano de uma conta para outra sem precisar recriar a transação.
