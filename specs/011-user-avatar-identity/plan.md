# Implementation Plan: Perfil de Usuário, Nome e Foto de Perfil (Avatar)

**Branch**: `feature/011-user-avatar-identity` | **Spec**: [specs/011-user-avatar-identity/spec.md](spec.md)

## Summary

Implementação do suporte completo a gerenciamento de perfil, avatar e identidade no backend (`projeto-backend-dashboard`).
Inclui suporte a edição de nome de exibição (`PATCH /api/user/profile`), upload de imagem de avatar (`POST /api/user/avatar`) com validação de tipo e tamanho (máx 5MB), remoção de foto de perfil (`DELETE /api/user/avatar`) com expurgo em disco, endpoint para servimento de imagens e exposição dos dados de perfil e segurança (`UserSecuritySettings`) no `GET /api/user/profile` para consumo transparente pelo frontend.

## Technical Context

- **Language/Version**: TypeScript 5.x (Strict mode) / Node.js >= 20.x
- **Primary Dependencies**: Fastify 4.x/5.x, `@fastify/multipart`, Zod 3.x (`fastify-type-provider-zod`), Mongoose 8.x
- **Storage**: MongoDB para metadados e sistema de arquivos local para imagens de avatar (`uploads/avatars`)
- **Testing**: Vitest (`pnpm test`), fastify `inject` para testes de integração

## Constitution Check

- [x] **Principle I**: TypeScript estrito, zero `any`.
- [x] **Principle II**: Stack Fastify + MongoDB + Zod.
- [x] **Principle III & IV**: Mantém modelo BYOK e minimização de tokens.
- [x] **Principle VII**: Autenticação stateless com JWT em todas as rotas protegidas.

## File Changes & Architecture

- `src/config/constants.ts`: Adicionar constantes `AVATAR_CONFIG` (tamanho máx, mime types permitidos, caminhos).
- `src/models/user.model.ts`: Adicionar `name` e `avatarUrl` na interface `IUser` e no `UserSchema`.
- `src/schemas/user.schemas.ts`: Adicionar schemas Zod para perfil estendido (`UserSecuritySettingsSchema`, `UpdateUserProfileRequestSchema`, `UserAvatarResponseSchema`, `UserProfileResponseSchema`).
- `src/services/user.service.ts`: Implementar `updateProfileName`, `uploadAvatar` e `deleteAvatar`.
- `src/routes/user.routes.ts`: Adicionar rotas `PATCH /api/user/profile`, `POST /api/user/avatar`, `DELETE /api/user/avatar` e rota estática para servimento de avatares.
- `tests/unit/user-service.test.ts`: Testes unitários para as novas operações.
- `tests/integration/user-profile.routes.test.ts`: Testes de integração cobrindo upload, remoção, patch de nome e servimento de avatar.
