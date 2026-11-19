# Implementation Plan: MongoDB Media Storage (018)

**Branch**: `018-mongodb-media-storage` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

## Project Structure (Touched Files)

- `src/models/user.model.ts` — add `avatarData` and `avatarMimeType` (`select: false`)
- `src/services/user.service.ts` — store/clear/read avatar bytes in MongoDB (`getAvatarByFilename`)
- `src/routes/user.routes.ts` — serve `GET /uploads/avatars/:filename` from MongoDB
- `src/models/fiscal-proof.model.ts` — add `fileData` (`Buffer`, `select: false`)
- `src/routes/fiscal.routes.ts` — persist `fileData` in MongoDB instead of `fs.promises.writeFile`
- `tests/unit/user-service.test.ts`, `tests/integration/user-profile.routes.test.ts` — update avatar tests for MongoDB storage
