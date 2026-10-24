# API Contracts: Vínculo de Contas Sociais — Google OAuth 2.0

## 1. `POST /api/auth/google/link`

Vincula a conta Google ao perfil do usuário atualmente autenticado.

- **Headers**:
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>` (Obrigatório)
- **Request Body**:
  ```json
  {
    "idToken": "eyJhbGciOiJSUzI1NiIs..."
  }
  ```
- **Responses**:
  - `200 OK` (retorna o perfil completo do usuário sincronizado com o frontend TanStack Query):
    ```json
    {
      "id": "507f1f77bcf86cd799439011",
      "email": "usuario@gmail.com",
      "name": "Nome do Usuário",
      "hasAiKey": false,
      "security": {
        "twoFactorEnabled": false,
        "hasLocalPassword": true,
        "googleLinked": true,
        "googleEmail": "usuario@gmail.com",
        "googleLinkedAt": "2026-10-24T18:00:00.000Z"
      },
      "success": true,
      "message": "Conta Google vinculada com sucesso.",
      "googleAccount": {
        "googleEmail": "usuario@gmail.com",
        "linkedAt": "2026-10-24T18:00:00.000Z"
      }
    }
    ```
  - `400 Bad Request`: Token inválido, expirado ou forjado.
    ```json
    {
      "statusCode": 400,
      "error": "Bad Request",
      "message": "Token do Google inválido ou expirado."
    }
    ```
  - `401 Unauthorized`: Usuário não autenticado.
  - `409 Conflict`: Conta Google já vinculada a outro usuário do sistema.
    ```json
    {
      "statusCode": 409,
      "error": "Conflict",
      "message": "Esta conta Google já está vinculada a outro perfil cadastrado."
    }
    ```

---

## 2. `DELETE /api/auth/google/unlink`

Remove o vínculo da conta Google do perfil do usuário autenticado.

- **Headers**:
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>` (Obrigatório)
- **Responses**:
  - `200 OK` (retorna o perfil completo atualizado do usuário):
    ```json
    {
      "id": "507f1f77bcf86cd799439011",
      "email": "usuario@gmail.com",
      "security": {
        "twoFactorEnabled": false,
        "hasLocalPassword": true,
        "googleLinked": false
      },
      "success": true,
      "message": "Conta Google desvinculada com sucesso."
    }
    ```
  - `400 Bad Request`: Usuário não possui senha local (guarda prevent lock-out) ou não tem Google vinculado.
    ```json
    {
      "statusCode": 400,
      "error": "Bad Request",
      "message": "Não é possível desvincular a conta Google pois ela é o único método de autenticação da conta. Cadastre uma senha antes de desvincular."
    }
    ```
  - `401 Unauthorized`: Usuário não autenticado.

---

## 3. `POST /api/auth/google`

Realiza login no sistema utilizando a credencial da conta Google previamente vinculada.

- **Request Body**:
  ```json
  {
    "idToken": "eyJhbGciOiJSUzI1NiIs..."
  }
  ```
- **Responses**:
  - `200 OK` (Login Direto sem 2FA):
    ```json
    {
      "token": "eyJhbGciOiJIUzI1Ni...",
      "user": {
        "id": "60d0fe4f5311236168a109ca",
        "email": "usuario@example.com",
        "name": "Maria Silva",
        "avatarUrl": "https://...",
        "hasAiKey": false
      }
    }
    ```
  - `200 OK` (Interceptação com 2FA Ativo):
    ```json
    {
      "requires2FA": true,
      "challengeId": "653b6a98f12c123456789abc"
    }
    ```
  - `400 Bad Request`: Token inválido ou expirado.
  - `401 Unauthorized`: Nenhuma conta vinculada a este perfil Google.
    ```json
    {
      "statusCode": 401,
      "error": "Unauthorized",
      "message": "Nenhuma conta vinculada a este perfil Google. Faça login com suas credenciais para vincular."
    }
    ```

---

## 4. `GET /api/user/profile` (Atualização no Payload)

Reflete as informações de vínculo de conta Google no subobjeto `security`:

- **Response Body**:
  ```json
  {
    "id": "60d0fe4f5311236168a109ca",
    "email": "usuario@example.com",
    "name": "Maria Silva",
    "avatarUrl": null,
    "hasAiKey": false,
    "security": {
      "twoFactorEnabled": false,
      "hasLocalPassword": true,
      "googleLinked": true,
      "googleEmail": "usuario@gmail.com",
      "googleLinkedAt": "2026-10-24T18:00:00.000Z"
    },
    "createdAt": "2026-10-20T12:00:00.000Z"
  }
  ```
