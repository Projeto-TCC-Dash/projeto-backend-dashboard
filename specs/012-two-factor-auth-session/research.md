# Technical Research: Autenticação em Dois Fatores (2FA via E-mail) e Revogação de Sessão

## 1. Desafio de Segundo Fator (OTP de 6 Dígitos) e Armazenamento Seguro

### Contexto
O requisito FR-003 e FR-004 exige a geração de um código OTP de 6 dígitos numéricos enviado por e-mail com validade de 10 minutos e proteção contra vazamento.

### Decisão
- **Geração**: Utilizar o módulo nativo `node:crypto` com `crypto.randomInt(100000, 1000000)` para garantir entropia criptograficamente segura (gerando valores estritamente de `100000` a `999999`).
- **Armazenamento de OTP**: O código em texto plano NUNCA deve ser persistido no banco de dados. Armazenar o hash HMAC/SHA-256 ou bcrypt do OTP no documento `TwoFactorChallenge`.
- **Validação**: O código submetido pelo usuário é transformado em hash e comparado em tempo constante (`crypto.timingSafeEqual`) contra o hash gravado.
- **Ciclo de Vida**: Documento com índice TTL nativo do MongoDB no campo `expiresAt` (10 minutos), garantindo autolimpeza automática pelo banco sem acúmulo de dados órfãos.

### Alternativas Consideradas
- *Salvar o OTP em texto plano*: Rejeitado por violar as diretrizes de privacidade e segurança da Constituição (risco de vazamento em dumps ou logs de banco).
- *TOTP (Google Authenticator / RFC 6238)*: Embora seguro, o requisito explícito do usuário é 2FA via **E-mail**, o que provê menor atrito de adoção imediata sem necessidade de aplicativo autenticador externo.

---

## 2. Estratégia de Envio de E-mails (EmailService)

### Contexto
A aplicação precisa enviar o código de 6 dígitos para o e-mail cadastrado do usuário com resiliência, baixa latência (<10s) e sem quebrar o ambiente local de desenvolvimento/testes.

### Decisão
- Criar um `EmailService` modular com padrão Provider/Adapter:
  1. **Development & Test Provider**: Quando em ambiente de teste ou desenvolvimento sem credenciais SMTP configuradas, registra o disparo em log estruturado e disponibiliza método em memória para inspeção em testes automatizados (`getLastSentEmail()`).
  2. **SMTP / Transacional Provider**: Utiliza transporte SMTP configurado via variáveis de ambiente (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`).
- O serviço formata mensagens em HTML e texto puro com instruções claras de segurança, validade de 10 minutos e aviso de que a plataforma nunca solicita senhas por e-mail.

### Alternativas Consideradas
- *Depender exclusivamente de serviço SaaS terceiro pago*: Rejeitado para preservar independência e execução 100% autônoma em containers locais/CI sem custo obrigatório.
- *Fazer chamadas síncronas bloqueantes*: O disparo é encapsulado no serviço com tratamento de timeout para não degradar o endpoint HTTP.

---

## 3. Interceptação de Login (Two-Factor Challenge State)

### Contexto
Quando o usuário possui 2FA ativo, o endpoint `POST /api/auth/login` valida e-mail e senha, mas não pode entregar o JWT definitivo de acesso à plataforma.

### Decisão
- O endpoint `POST /api/auth/login` verifica `user.isTwoFactorEnabled`.
- Se `isTwoFactorEnabled === false`: Segue o fluxo normal emitindo JWT definitivo e dados do usuário (`AuthResponse`).
- Se `isTwoFactorEnabled === true`:
  1. Cria um `TwoFactorChallenge` no MongoDB com `challengeType: 'LOGIN'`, `expiresAt: Date.now() + 10min` e hash do código gerado.
  2. Dispara o envio do e-mail via `EmailService`.
  3. Retorna resposta HTTP 200 com payload discriminado:
     ```json
     {
       "requires2FA": true,
       "challengeId": "65f2a1b9...",
       "message": "Código de verificação enviado para o seu e-mail cadastrado."
     }
     ```
  4. Um novo endpoint `POST /api/auth/2fa/verify` recebe `{ challengeId, code }`. Se válido, consome o desafio e emite o token JWT definitivo com `sessionId`.

### Alternativas Consideradas
- *Emitir JWT temporário com escopo restrito*: Cria complexidade adicional de verificação de claims em todos os plugins de autorização. O padrão de `challengeId` opaco vinculado a uma coleção temporária com TTL é mais seguro, isolado e à prova de vazamento de privilégios.

---

## 4. Revogação de Sessão e Logout Seguro (Session Revocation)

### Contexto
A Constituição exige autenticação baseada em JWT (`@fastify/jwt`). Tokens JWT são tradicionalmente *stateless*, o que significa que, sem um mecanismo de controle de estado ou lista de revogação, um token emitido permaneceria válido até o término do seu `exp`, mesmo após logout do usuário.

### Decisão
- Adicionar ao payload do JWT assinado o atributo `sessionId` (UUID v4 gerado a cada login bem-sucedido).
- Criar a coleção `Session` no MongoDB:
  - `_id`: `sessionId` (string UUID)
  - `userId`: `mongoose.Types.ObjectId`
  - `createdAt`: `Date`
  - `expiresAt`: `Date` (alinhado ao tempo de vida do JWT, com índice TTL do MongoDB para expurgo automático)
  - `isRevoked`: `boolean` (padrão: `false`)
  - `revokedAt`: `Date | null`
  - `userAgent`: `string | null`
  - `ip`: `string | null`
- **Hook de Autenticação (`requireAuth`)**:
  1. Verifica a assinatura criptográfica do JWT via `request.jwtVerify()`.
  2. Se o token contiver `sessionId`, executa checagem de revogação (`SessionService.isSessionActive(sessionId)`).
  3. Se a sessão estiver revogada ou inexistente, responde imediatamente com HTTP 401: `Sessão expirada ou revogada. Por favor, autentique-se novamente.`
- **Logout (`POST /api/auth/logout`)**:
  - Marca `isRevoked = true` e `revokedAt = new Date()` na sessão correspondente ao `sessionId` do token recebido.
  - Se solicitado `allDevices: true`, marca como revogadas todas as sessões ativas do `userId`.

### Alternativas Consideradas
- *Invalidação por incremento de `tokenVersion` no modelo de usuário*: Embora viável, revoga automaticamente todos os dispositivos do usuário a qualquer logout, impedindo que o usuário encerre apenas o dispositivo atual mantendo a sessão do celular aberta. A abordagem por `sessionId` individual permite tanto logout pontual quanto logout global (`allDevices: true`).
- *Redis Blacklist*: Violaria a Constituição (Princípio II: sem dependências de infraestrutura além de Fastify e MongoDB nativo). O MongoDB com índice TTL atende perfeitamente ao expurgo automático de sessões expiradas com latência < 2ms por index lookup.

---

## 5. Proteção Anti-Abuso e Força Bruta

### Contexto
Mitigar tentativas automatizadas de adivinhar o OTP de 6 dígitos (espaço amostral de 1.000.000 de possibilidades) e evitar spam de e-mails via requisições de reenvio.

### Decisão
- **Limite de Tentativas**: Cada `TwoFactorChallenge` possui contador `attempts: number`. Se atingir 5 tentativas incorretas, o desafio é imediatamente invalidado (`status: 'LOCKED'`). O usuário deve reiniciar o login com sua senha.
- **Cooldown de Reenvio**: `POST /api/auth/2fa/resend` verifica se `Date.now() - lastSentAt < 60_000`. Se menor, responde com HTTP 429 indicando quantos segundos restam para um novo envio.
- **Uso Único**: Uma vez verificado com sucesso, o desafio é deletado ou marcado como `verified: true`, impedindo replay.
