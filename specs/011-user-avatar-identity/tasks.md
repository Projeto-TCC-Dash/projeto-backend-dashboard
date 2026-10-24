# Tasks: Perfil de Usuário, Nome e Foto de Perfil (Avatar)

**Input**: Design documents from `/specs/011-user-avatar-identity/`

## Phase 1: Foundational (Constantes, Schemas e Modelos)

- [X] T001 [P] Adicionar constantes de avatar (`AVATAR_CONFIG`) em `src/config/constants.ts`
- [X] T002 [P] Atualizar `IUser` e `UserSchema` com campos `name` e `avatarUrl` em `src/models/user.model.ts`
- [X] T003 [P] Atualizar e criar schemas Zod (`UserSecuritySettingsSchema`, `UpdateUserProfileRequestSchema`, `UserAvatarResponseSchema`, `UserProfileResponseSchema`) em `src/schemas/user.schemas.ts`

---

## Phase 2: User Story 1 - Edição e Consulta de Nome e Perfil (P1)

- [X] T004 [P] [US1] Adicionar testes unitários para atualização de nome em `tests/unit/user-service.test.ts`
- [X] T005 [US1] Implementar método `UserService.updateProfileName` e atualizar `UserService.getProfile` com os novos campos em `src/services/user.service.ts`
- [X] T006 [P] [US1] Adicionar testes de integração para `PATCH /api/user/profile` e `GET /api/user/profile` em `tests/integration/user-profile.routes.test.ts`
- [X] T007 [US1] Implementar rota `PATCH /api/user/profile` em `src/routes/user.routes.ts`

---

## Phase 3: User Story 2 & 3 - Upload, Servimento e Exclusão de Avatar (P1/P2)

- [X] T008 [P] [US2] Adicionar testes unitários para `uploadAvatar` e `deleteAvatar` em `tests/unit/user-service.test.ts`
- [X] T009 [US2] Implementar métodos `UserService.uploadAvatar` e `UserService.deleteAvatar` em `src/services/user.service.ts`
- [X] T010 [P] [US2] Adicionar testes de integração para `POST /api/user/avatar`, `DELETE /api/user/avatar` e rota de visualização de avatar em `tests/integration/user-profile.routes.test.ts`
- [X] T011 [US2] Implementar rotas `POST /api/user/avatar`, `DELETE /api/user/avatar` e rota de servimento de avatar em `src/routes/user.routes.ts`

---

## Phase 4: Polish & Suite Verification

- [X] T012 Executar suíte completa de testes com `pnpm test` e verificar 100% de aprovação
