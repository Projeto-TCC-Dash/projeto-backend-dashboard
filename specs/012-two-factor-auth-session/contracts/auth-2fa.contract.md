# API Contracts: Autenticação em Dois Fatores (2FA) e Revogação de Sessão

Este documento especifica os contratos de API com validação estrita em runtime via Zod para o Fastify Type Provider.

---

## 1. `POST /api/auth/login` (Atualizado)

Autentica o usuário. Se o usuário possuir 2FA ativo, intercepta o login e emite um desafio de verificação.

- **Tags**: `Auth`
- **Autenticação**: Pública

### Request Body (`LoginRequestSchema`)
```typescript
{
  email: z.string().email(),
  password: z.string().min(1)
}
```

### Responses

#### 200 OK - Quando 2FA está desativado (`AuthResponseSchema`)
```typescript
{
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    hasAiKey: z.boolean(),
    isTwoFactorEnabled: z.boolean()
  })
}
```

#### 200 OK - Quando 2FA está ativado (`Login2FAResponseSchema`)
```typescript
{
  requires2FA: z.literal(true),
  challengeId: z.string(),
  message: z.string()
}
```

#### 401 Unauthorized
```typescript
{
  statusCode: 401,
  error: "Unauthorized",
  message: "Credenciais inválidas."
}
```

---

## 2. `POST /api/auth/2fa/verify`

Valida o código de 6 dígitos enviado por e-mail e emite a sessão definitiva.

- **Tags**: `Auth`
- **Autenticação**: Pública (vinculada ao `challengeId`)

### Request Body (`Verify2FARequestSchema`)
```typescript
{
  challengeId: z.string().min(24).max(24),
  code: z.string().regex(/^\d{6}$/, "O código de verificação deve conter exatamente 6 dígitos numéricos.")
}
```

### Responses

#### 200 OK (`AuthResponseSchema`)
```typescript
{
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    hasAiKey: z.boolean(),
    isTwoFactorEnabled: z.boolean()
  })
}
```

#### 400 Bad Request
Código incorreto ou desafio bloqueado por excesso de tentativas (>= 5).
```typescript
{
  statusCode: 400,
  error: "Bad Request",
  message: "Código de verificação incorreto. Tentativas restantes: 3"
}
```

#### 404 Not Found
Desafio expirado (mais de 10 min) ou inexistente.
```typescript
{
  statusCode: 404,
  error: "Not Found",
  message: "Desafio 2FA expirado ou inválido. Realize login novamente."
}
```

---

## 3. `POST /api/auth/2fa/resend`

Solicita um novo código de verificação para o desafio aberto, respeitando o intervalo de 60 segundos.

- **Tags**: `Auth`
- **Autenticação**: Pública

### Request Body (`Resend2FARequestSchema`)
```typescript
{
  challengeId: z.string().min(24).max(24)
}
```

### Responses

#### 200 OK
```typescript
{
  success: true,
  message: "Novo código de verificação enviado com sucesso para o seu e-mail."
}
```

#### 429 Too Many Requests
```typescript
{
  statusCode: 429,
  error: "Too Many Requests",
  message: "Aguarde 45 segundos antes de solicitar um novo código.",
  retryAfterSeconds: 45
}
```

---

## 4. `POST /api/auth/2fa/enable`

Inicia o fluxo para ativação do 2FA na conta do usuário autenticado.

- **Tags**: `Auth`
- **Autenticação**: `Bearer <token>`

### Responses

#### 200 OK
```typescript
{
  challengeId: z.string(),
  message: "Código de verificação de 6 dígitos enviado para seu e-mail para confirmação da ativação."
}
```

#### 400 Bad Request
Se a conta já possuir 2FA ativo.

---

## 5. `POST /api/auth/2fa/confirm-enable`

Confirma a ativação do 2FA validando o código de teste recebido no e-mail.

- **Tags**: `Auth`
- **Autenticação**: `Bearer <token>`

### Request Body (`Verify2FARequestSchema`)
```typescript
{
  challengeId: z.string().min(24).max(24),
  code: z.string().regex(/^\d{6}$/)
}
```

### Responses

#### 200 OK
```typescript
{
  success: true,
  isTwoFactorEnabled: true,
  message: "Autenticação em dois fatores ativada com sucesso."
}
```

---

## 6. `POST /api/auth/2fa/disable`

Desativa a proteção 2FA mediante confirmação da senha do usuário.

- **Tags**: `Auth`
- **Autenticação**: `Bearer <token>`

### Request Body (`Disable2FARequestSchema`)
```typescript
{
  password: z.string().min(1, "A confirmação de senha é obrigatória.")
}
```

### Responses

#### 200 OK
```typescript
{
  success: true,
  isTwoFactorEnabled: false,
  message: "Autenticação em dois fatores desativada com sucesso."
}
```

#### 401 Unauthorized
Senha incorreta.

---

## 7. `POST /api/auth/logout`

Encerra a sessão ativa de forma imediata e irrevogável no servidor.

- **Tags**: `Auth`
- **Autenticação**: `Bearer <token>`

### Request Body (`LogoutRequestSchema` - Opcional)
```typescript
{
  allDevices: z.boolean().optional().default(false)
}
```

### Responses

#### 200 OK
```typescript
{
  success: true,
  message: "Sessão encerrada com sucesso."
}
```

#### 401 Unauthorized
Se o token for inválido ou já tiver sido revogado anteriormente.
