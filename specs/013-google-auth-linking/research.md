# Research & Technical Decisions: Vínculo de Contas Sociais (Google OAuth 2.0)

## 1. Validação de ID Token do Google OAuth 2.0

### Contexto
Para vincular com segurança uma conta Google a um usuário existente, o backend recebe um `idToken` JWT gerado pelo Google Identity Services (GIS) no frontend e deve validar sua autenticidade criptográfica, integridade e validade temporal.

### Alternativas Consideradas
1. **Biblioteca `google-auth-library` (`OAuth2Client.verifyIdToken`)**:
   - *Prós*: SDK oficial do Google, faz cache de chaves públicas JWKS em memória e valida localmente sem requisições HTTP adicionais após o primeiro download de chaves.
   - *Contras*: Adiciona nova dependência externa de peso moderado ao `package.json`.
2. **Endpoint Oficial de Validação do Google (`https://oauth2.googleapis.com/tokeninfo?id_token=...`) com `fetch` nativo do Node 20+**:
   - *Prós*: Sem dependências adicionais no `package.json`, suporte a Node 20 nativo, garantia de checagem direta pelo serviço de autenticação do Google, extrema facilidade de mock em testes de integração e unitários.
   - *Contras*: Realiza uma chamada HTTP externa síncrona por validação de token.
3. **Validação Híbrida / Desacoplada via `GoogleOAuthService`**:
   - Encapsular a validação em um serviço dedicado `GoogleOAuthService.verifyIdToken(idToken: string)` com adaptador desacoplado. Em ambiente de produção e desenvolvimento, utiliza verificação contra os endpoints oficiais do Google; em testes automatizados, permite injeção de provedores falsos/stubs sem bater na rede externa.

### Decisão
Adotar o serviço `GoogleOAuthService` utilizando chamada `fetch` nativa (Node.js 20+) ao endpoint `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}` com validação de:
- `iss` em `["accounts.google.com", "https://accounts.google.com"]`
- `email_verified` igual a `true` ou `"true"`
- `aud` igual a `env.GOOGLE_CLIENT_ID` (quando a variável de ambiente estiver configurada)
- `exp` maior que `Date.now() / 1000`
- Extração de `sub` como `googleId` e `email` como `googleEmail`.

---

## 2. Modelagem de Dados e Indexação

### Contexto
O subdocumento `googleAccount` deve ser persistido no documento `User`. É crucial garantir que um mesmo `googleId` não seja associado a mais de um usuário na base.

### Decisão
No Mongoose:
```typescript
export interface IGoogleAccount {
  googleId: string;
  googleEmail: string;
  linkedAt: Date;
}
```
Subschema no `UserSchema`:
```typescript
googleAccount: {
  googleId: { type: String },
  googleEmail: { type: String },
  linkedAt: { type: Date, default: Date.now },
}
```
Índice esparso e único:
```typescript
UserSchema.index({ 'googleAccount.googleId': 1 }, { unique: true, sparse: true });
```
O modificador `sparse: true` garante que usuários que ainda não vincularam conta Google (`googleAccount` nulo ou indefinido) não colidam entre si no índice de unicidade.

---

## 3. Regra de Guarda contra Perda de Acesso (Prevent Lock-Out)

### Contexto
Se um usuário autenticado tentar desvincular sua conta Google (`DELETE /api/auth/google/unlink`), devemos garantir que ele não fique sem nenhum meio de acesso ao sistema.

### Decisão
- Verificar `Boolean(user.passwordHash && user.passwordHash.length > 0)`.
- Se o usuário não tiver uma senha local definida, a rota rejeita com HTTP 400 Bad Request:
  `"Não é possível desvincular a conta Google pois ela é o único método de autenticação cadastrado na conta. Cadastre uma senha local antes de desvincular."`
- Se tiver senha local, o campo `googleAccount` é removido (`$unset: { googleAccount: 1 }` ou atribuído a `undefined`) e salvo no banco.

---

## 4. Sessões no Login Social

### Contexto
O endpoint `POST /api/auth/google` permite que o usuário faça login apresentando o `idToken` do Google.

### Decisão
- Valida o token via `GoogleOAuthService.verifyIdToken`.
- Busca o usuário pelo `googleAccount.googleId`.
- Se não encontrar, retorna 401 Unauthorized com mensagem instruindo o usuário a vincular primeiro nas configurações de sua conta.
- Cria sessão persistente via `SessionService.createSession`.
- Emite o JWT assinado com claim `sessionId`.
- Retorna HTTP 200 com `{ token, user: { id, email, name, avatarUrl, hasAiKey } }`.
