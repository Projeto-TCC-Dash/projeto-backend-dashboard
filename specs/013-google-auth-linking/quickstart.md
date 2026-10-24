# Quickstart: Vínculo de Contas Sociais — Google OAuth 2.0

Este guia orienta a validação local e teste dos fluxos de vínculo, desvinculação e autenticação com Google.

## Cenário 1: Vinculando a Conta Google

1. **Obter Token do Usuário**:
   Efetue login na API com e-mail e senha:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"usuario@example.com","password":"Password123!"}'
   ```
   Armazene o `token` JWT retornado.

2. **Vincular Conta Google**:
   Envie o `idToken` obtido junto ao Google:
   ```bash
   curl -X POST http://localhost:3000/api/auth/google/link \
     -H "Authorization: Bearer <SEU_TOKEN_JWT>" \
     -H "Content-Type: application/json" \
     -d '{"idToken":"<GOOGLE_ID_TOKEN>"}'
   ```
   Resposta esperada: HTTP 200 `{ "success": true, "message": "Conta Google vinculada com sucesso.", "googleAccount": { ... } }`.

3. **Verificar no Perfil**:
   ```bash
   curl -X GET http://localhost:3000/api/user/profile \
     -H "Authorization: Bearer <SEU_TOKEN_JWT>"
   ```
   O objeto `security` conterá `"googleLinked": true` e `"googleEmail": "..."`.

---

## Cenário 2: Login com Google Vinculado

```bash
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<GOOGLE_ID_TOKEN>"}'
```
Se a conta possuir 2FA desativado, o token JWT completo é emitido. Se possuir 2FA ativado, o desafio `{ "requires2FA": true, "challengeId": "..." }` é retornado para verificação de OTP.

---

## Cenário 3: Desvinculação com Guarda de Segurança

```bash
curl -X DELETE http://localhost:3000/api/auth/google/unlink \
  -H "Authorization: Bearer <SEU_TOKEN_JWT>"
```
Se o usuário tiver senha local cadastrada, a desvinculação ocorre com sucesso. Caso contrário, retorna HTTP 400 Bad Request impedindo o lock-out do usuário.
