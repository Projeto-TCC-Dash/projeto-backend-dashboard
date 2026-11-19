# Feature Specification: MongoDB Media Storage (018)

**Feature Branch**: `018-mongodb-media-storage`  
**Created**: 2026-11-19  
**Status**: Approved  
**Input**: Move avatar and fiscal OCR proof binary storage from local disk (`process.cwd()/uploads`) to MongoDB (`select: false` Buffers) for Vercel serverless compatibility.

## Requirements

- **FR-001**: `UserModel` MUST store `avatarData` (`Buffer`, `select: false`) and `avatarMimeType` (`string`, `select: false`).
- **FR-002**: `UserService.uploadAvatar` and `deleteAvatar` MUST persist/clear avatar bytes in MongoDB without local filesystem I/O, preserving the `avatarUrl` contract (`/uploads/avatars/<filename>`).
- **FR-003**: `GET /uploads/avatars/:filename` MUST serve the image buffer from MongoDB via `UserService.getAvatarByFilename`.
- **FR-004**: `FiscalProofDocumentModel` MUST store `fileData` (`Buffer`, `select: false`) and `POST /api/fiscal/ocr` MUST NOT write files to local disk.
