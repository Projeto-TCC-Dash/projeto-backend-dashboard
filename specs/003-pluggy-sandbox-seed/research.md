# Research & Technical Decisions: Reestruturação da Pluggy para Motor Interno de Seed

**Feature**: `003-pluggy-sandbox-seed`  
**Date**: 2026-10-13  
**Status**: Concluído (Fase 0)

---

## 1. Conexão Autônoma com a Sandbox da Pluggy

### Decisão
- A API da Pluggy fornece o **conector Sandbox oficial** (identificador padrão `connectorId: 2`) com credenciais estáticas de teste:
  - `user`: `"user-ok"`
  - `password`: `"password-ok"`
- O fluxo de criação dinâmica dispensa qualquer interação humana ou widget de frontend:
  1. `POST https://api.pluggy.ai/items`
     - Headers: `X-API-KEY: PLUGGY_API_KEY`, `Content-Type: application/json`
     - Payload:
       ```json
       {
         "connectorId": 2,
         "parameters": {
           "user": "user-ok",
           "password": "password-ok"
         }
       }
       ```
  2. Polling: `GET https://api.pluggy.ai/items/{itemId}` a cada 2 segundos até `status === 'UPDATED'` (com timeout de segurança de 30 segundos).
  3. Coleta de Contas: `GET https://api.pluggy.ai/accounts?itemId={itemId}`
  4. Coleta de Transações: `GET https://api.pluggy.ai/transactions?accountId={accountId}&pageSize=100`

### Justificativa
Permite que o comando `npm run seed` provisione uma massa rica de dados de Open Finance 100% sob demanda diretamente da API da Pluggy, sem necessitar que o desenvolvedor crie itens manualmente no portal da Pluggy.

---

## 2. Remoção da Rota Pública `POST /api/integrations/pluggy/sync`

### Decisão
- Excluir o arquivo `src/routes/pluggy.routes.ts` e `src/schemas/pluggy.schemas.ts`.
- Remover o registro de `pluggyRoutes` em `src/app.ts`.
- Manter o `PluggyService` como classe utilitária em `src/services/pluggy.service.ts` exclusivamente para ser chamado pelo script de seed (`scripts/seed.ts`).
- Atualizar a suíte de testes: remover o teste de rota antiga e validar o comportamento autônomo do seed.

### Justificativa
A aplicação tem como canal de entrada do usuário final o upload de arquivos de extrato bancário (OFX e CSV). Manter uma rota pública de sincronização da Pluggy criava uma falsa expectativa de que o usuário final precisaria integrar bancos via API. Deixá-la restrita ao seed alinha a arquitetura ao modelo de negócio do projeto.

---

## 3. Resiliência e Fallback Offline

### Decisão
- Se `PLUGGY_API_KEY` não estiver definida no `.env` ou a chamada `POST /items` falhar por indisponibilidade externa de rede/cota, o `scripts/seed.ts` detecta o erro e aplica instantaneamente a fixture simulada rica de transações brasileiras (`MOCK_PLUGGY_FIXTURES`).

### Justificativa
Garante que o desenvolvedor nunca fique bloqueado para rodar a aplicação ou executar testes locais, mesmo quando sem internet ou sem credenciais da Pluggy.
