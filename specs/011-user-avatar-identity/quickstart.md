# Quickstart: Validação da Feature 011

## Cenário 1: Atualização e Consulta de Nome do Usuário
1. Registrar ou autenticar usuário para obter `JWT_TOKEN`.
2. Executar `PATCH /api/user/profile` com payload `{"name": "Débora Santos"}`.
3. Verificar retorno 200 contendo `name: "Débora Santos"`.
4. Executar `GET /api/user/profile` e validar que o campo `name` persiste.

## Cenário 2: Upload de Avatar
1. Fazer upload de um arquivo PNG/JPEG/WebP via `POST /api/user/avatar`.
2. Verificar status 200 com `{ success: true, avatarUrl: "/uploads/avatars/..." }`.
3. Acessar a URL retornada via `GET /uploads/avatars/...` e verificar status 200 e content-type da imagem.

## Cenário 3: Exclusão de Avatar
1. Executar `DELETE /api/user/avatar`.
2. Verificar status 200 com `{ success: true, avatarUrl: null }`.
3. Executar `GET /api/user/profile` e validar que `avatarUrl` é null.
