# Feature Specification: Perfil de Usuário, Nome e Foto de Perfil (Avatar)

**Feature Branch**: `feature/011-user-avatar-identity`
**Feature Number**: `011`
**Created**: 2026-10-24
**Status**: Implemented

## 1. Visão Geral e Contexto

Esta feature implementa o gerenciamento de identidade e personalização do usuário no backend (`projeto-backend-dashboard`), suportando os requisitos da Feature 009 do Frontend (`projeto-frontend-dashboard`). Permite aos usuários cadastrar e editar seu nome de exibição, enviar foto de perfil (avatar) nos formatos JPG, PNG e WebP (até 5MB) com armazenamento seguro e remoção atômica, servindo os avatares via endpoint/estático e expondo perfil completo compatível com o schema do frontend.

## 2. User Stories & Acceptance Criteria

### US1: Edição e Consulta de Nome e Perfil Cadastral (P1)
**Como** um usuário autenticado na plataforma,
**Quero** consultar meus dados cadastrais e atualizar meu nome de exibição,
**Para que** minhas informações reflitam minha identidade na barra de navegação e relatórios.

- **Cenário 1.1 (Consulta de Perfil Completo)**: `GET /api/user/profile` retorna `id`, `email`, `name`, `avatarUrl`, `hasAiKey`, `security` e `financialProfile`.
- **Cenário 1.2 (Atualização de Nome via PATCH)**: `PATCH /api/user/profile` com `{ name: "Novo Nome" }` persiste o nome (entre 2 e 100 caracteres) e retorna o perfil atualizado.
- **Cenário 1.3 (Validação de Nome Inválido)**: `PATCH /api/user/profile` com nome de 1 caractere ou vazio retorna `400 Bad Request`.
- **Cenário 1.4 (Isolamento Multi-Tenant e Autenticação)**: Chamadas sem JWT válido retornam `401 Unauthorized`.

### US2: Upload e Servimento de Avatar (P1)
**Como** um usuário autenticado,
**Quero** fazer upload de uma imagem para meu avatar,
**Para que** minha foto seja exibida na interface.

- **Cenário 2.1 (Upload Válido)**: `POST /api/user/avatar` aceita payload `multipart/form-data` com imagem JPG, PNG ou WebP de até 5MB, armazena no diretório de uploads e atualiza `user.avatarUrl`. Retorna `200 OK` com `{ avatarUrl }`.
- **Cenário 2.2 (Rejeição de Formatos Não Suportados)**: Arquivos `.txt`, `.pdf` ou executáveis retornam `400 Bad Request`.
- **Cenário 2.3 (Limite de Tamanho)**: Arquivos maiores que 5MB retornam `400 Bad Request`.
- **Cenário 2.4 (Substituição de Avatar Existente)**: Novo upload remove a imagem anterior do disco para evitar acúmulo de arquivos órfãos.
- **Cenário 2.5 (Servimento Estático de Avatar)**: `GET /uploads/avatars/:filename` retorna o buffer binário com `Content-Type` adequado (`image/jpeg`, `image/png`, `image/webp`).

### US3: Exclusão de Avatar (P2)
**Como** um usuário que possui uma foto personalizada,
**Quero** remover minha foto de perfil,
**Para que** a interface retorne ao fallback de iniciais.

- **Cenário 3.1 (Exclusão Bem-Sucedida)**: `DELETE /api/user/avatar` remove o arquivo do disco (se existir), define `user.avatarUrl = null` e retorna `200 OK` com confirmação.
- **Cenário 3.2 (Idempotência)**: Usuário sem avatar chamando `DELETE /api/user/avatar` não gera erro e retorna `200 OK`.

## 3. Requisitos Técnicos e Governança

- **TypeScript Estrito & Zod**: Validação de todas as entradas e saídas com schemas Zod.
- **Mongoose / MongoDB**: Modelo `User` atualizado com `name?: string` e `avatarUrl?: string | null`.
- **Fastify Multipart**: Processamento com limite e validação de MIME types seguros.
- **Armazenamento de Arquivos**: Persistência local em pasta `uploads/avatars/` isolada e servida com headers seguros.
