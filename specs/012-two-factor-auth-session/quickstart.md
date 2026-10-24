# Quickstart & Validation Guide: Autenticação 2FA e Revogação de Sessão

Este guia descreve os passos práticos para validar localmente o ciclo de vida completo da autenticação em dois fatores (2FA via e-mail) e revogação de sessão via logout seguro.

---

## Pré-requisitos

1. **Ambiente Node.js**: Node.js 20+ com TypeScript e dependências instaladas (`npm install`).
2. **Instância MongoDB**: MongoDB em execução local (porta padrão `27017` ou via Docker Compose `docker compose up -d mongodb`).
3. **Variáveis de Ambiente**: Arquivo `.env` configurado com `JWT_SECRET` e `ENCRYPTION_KEY`.

---

## Cenário 1: Fluxo Completo de Ativação do 2FA

1. **Registrar ou Efetuar Login Inicial**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email": "investidor@exemplo.com", "password": "SenhaForte123!"}'
   ```
   *Guarde o token JWT retornado.*

2. **Solicitar Ativação de 2FA**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/2fa/enable \
     -H "Authorization: Bearer <SEU_TOKEN_JWT>"
   ```
   *Resposta esperada*: `200 OK` com `challengeId` e e-mail disparado (em ambiente de dev, o código de 6 dígitos é registrado no log do console).

3. **Confirmar Ativação de 2FA com Código OTP**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/2fa/confirm-enable \
     -H "Authorization: Bearer <SEU_TOKEN_JWT>" \
     -H "Content-Type: application/json" \
     -d '{"challengeId": "<CHALLENGE_ID>", "code": "<CODIGO_6_DIGITOS>"}'
   ```
   *Resposta esperada*: `200 OK` com `isTwoFactorEnabled: true`.

---

## Cenário 2: Login com Interceptação 2FA

1. **Submeter Credenciais de Login**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "investidor@exemplo.com", "password": "SenhaForte123!"}'
   ```
   *Resposta esperada*:
   ```json
   {
     "requires2FA": true,
     "challengeId": "65f2...",
     "message": "Código de verificação enviado para o seu e-mail cadastrado."
   }
   ```
   *(Nenhum token JWT definitivo é entregue nesta etapa).*

2. **Tentativa de Acesso com Challenge ID em Rota Protegida (Deve Falhar)**:
   ```bash
   curl -X GET http://localhost:3000/api/user/profile \
     -H "Authorization: Bearer <CHALLENGE_ID>"
   ```
   *Resposta esperada*: `401 Unauthorized`.

3. **Submeter Código de 6 Dígitos e Obter Token Definitivo**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/2fa/verify \
     -H "Content-Type: application/json" \
     -d '{"challengeId": "<CHALLENGE_ID>", "code": "<CODIGO_RECEBIDO>"}'
   ```
   *Resposta esperada*: `200 OK` contendo o token JWT definitivo e dados do usuário com sessão válida.

---

## Cenário 3: Validação de Segurança (Erros e Cooldown)

1. **Testar Tentativa Incorreta**:
   - Submeta código inválido `000000` em `POST /api/auth/2fa/verify`.
   - Esperado: `400 Bad Request` indicando decremento de tentativas restantes.
   - Após 5 erros consecutivos: Desafio bloqueado (`status: LOCKED`).

2. **Testar Cooldown de Reenvio**:
   - Submeta duas chamadas imediatas em `POST /api/auth/2fa/resend`.
   - A segunda chamada deve responder `429 Too Many Requests` com os segundos de espera restantes.

---

## Cenário 4: Logout Seguro e Revogação Imediata

1. **Acessar Rota Protegida (Sucesso Pré-Logout)**:
   ```bash
   curl -X GET http://localhost:3000/api/user/profile \
     -H "Authorization: Bearer <TOKEN_FINAL>"
   ```
   *Resposta*: `200 OK`.

2. **Efetuar Logout**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/logout \
     -H "Authorization: Bearer <TOKEN_FINAL>"
   ```
   *Resposta esperada*: `200 OK` com `{"success": true, "message": "Sessão encerrada com sucesso."}`.

3. **Tentativa de Reutilização do Token Revogado (Pós-Logout)**:
   ```bash
   curl -X GET http://localhost:3000/api/user/profile \
     -H "Authorization: Bearer <TOKEN_FINAL>"
   ```
   *Resposta esperada*: `401 Unauthorized` com mensagem informando que a sessão foi revogada.

---

## Execução da Suíte de Testes Automatizados

Para rodar todos os testes de integração e unitários relacionados ao fluxo:

```bash
npm test tests/integration/auth.routes.test.ts
npm test tests/unit/
```
