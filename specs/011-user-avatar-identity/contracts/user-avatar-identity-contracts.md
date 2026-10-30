# API Contracts: Feature 011

## 1. `GET /api/user/profile`
Retorna dados cadastrais, avatar e configurações de segurança do usuário autenticado.

- **Headers**: `Authorization: Bearer <JWT>`
- **Response 200 OK**:
```json
{
  "id": "67140f8a8...",
  "email": "usuario@exemplo.com",
  "name": "Débora Goulart",
  "avatarUrl": "/uploads/avatars/user-67140f8a8-1729765432.webp",
  "hasAiKey": true,
  "security": {
    "hasLocalPassword": true,
    "googleLinked": false
  },
  "financialProfile": {
    "incomeType": "CLT",
    "declaredMonthlyIncome": 8500,
    "goals": ["RESERVA_EMERGENCIA"]
  },
  "createdAt": "2026-10-20T14:00:00.000Z"
}
```

## 2. `PATCH /api/user/profile`
Atualiza dados cadastrais como o nome de exibição.

- **Headers**: `Authorization: Bearer <JWT>`
- **Request Body**:
```json
{
  "name": "Débora H. Goulart"
}
```
- **Response 200 OK**: Objeto `UserProfileResponse` atualizado.
- **Response 400 Bad Request**: Validação de tamanho do nome inválida.
- **Response 401 Unauthorized**: Token ausente ou inválido.

## 3. `POST /api/user/avatar`
Upload de nova foto de perfil do usuário.

- **Headers**: `Authorization: Bearer <JWT>`, `Content-Type: multipart/form-data`
- **Body**: Campo `file` com arquivo binário (`image/jpeg`, `image/png` ou `image/webp` até 5MB).
- **Response 200 OK**:
```json
{
  "success": true,
  "message": "Avatar atualizado com sucesso",
  "avatarUrl": "/uploads/avatars/67140f8a8-1729765432.png"
}
```
- **Response 400 Bad Request**: Formato de arquivo não suportado ou arquivo excedendo 5MB.
- **Response 401 Unauthorized**: Token ausente ou inválido.

## 4. `DELETE /api/user/avatar`
Exclui a foto de perfil do usuário e remove o arquivo físico.

- **Headers**: `Authorization: Bearer <JWT>`
- **Response 200 OK**:
```json
{
  "success": true,
  "message": "Avatar removido com sucesso",
  "avatarUrl": null
}
```
- **Response 401 Unauthorized**: Token ausente ou inválido.

## 5. `GET /uploads/avatars/:filename`
Serve a imagem do avatar de forma estática com cache e Content-Type correto.
- **Response 200 OK**: Imagem binária (`image/jpeg`, `image/png` ou `image/webp`).
- **Response 404 Not Found**: Imagem não encontrada.
