# Data Model: Feature 011 — Perfil de Usuário, Nome e Foto de Perfil

## 1. Mongoose Model: Extensão de `IUser` e `UserSchema`

Arquivo: `src/models/user.model.ts`

```typescript
export interface IUserSecuritySettings {
  twoFactorEnabled: boolean;
  hasLocalPassword: boolean;
  googleLinked: boolean;
  googleEmail?: string;
  googleLinkedAt?: Date;
}

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name?: string;
  avatarUrl?: string | null;
  aiApiKeyEncrypted?: string;
  aiApiKeyIv?: string;
  hasAiKey: boolean;
  financialProfile?: IFinancialProfile;
  createdAt: Date;
  updatedAt: Date;
}
```

## 2. Schemas Zod de Entrada e Saída

Arquivo: `src/schemas/user.schemas.ts`

```typescript
export const UserSecuritySettingsSchema = z.object({
  twoFactorEnabled: z.boolean().default(false),
  hasLocalPassword: z.boolean().default(true),
  googleLinked: z.boolean().default(false),
  googleEmail: z.string().email().optional(),
  googleLinkedAt: z.date().optional(),
});
export type UserSecuritySettings = z.infer<typeof UserSecuritySettingsSchema>;

export const UpdateUserProfileRequestSchema = z.object({
  name: z
    .string()
    .min(2, 'O nome deve ter no mínimo 2 caracteres')
    .max(100, 'O nome deve ter no máximo 100 caracteres')
    .optional(),
});
export type UpdateUserProfileRequest = z.infer<typeof UpdateUserProfileRequestSchema>;

export const UserAvatarResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  avatarUrl: z.string().nullable(),
});
export type UserAvatarResponse = z.infer<typeof UserAvatarResponseSchema>;

export const UserProfileResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
  hasAiKey: z.boolean(),
  security: UserSecuritySettingsSchema.optional(),
  financialProfile: FinancialProfileSchema.optional(),
  createdAt: z.date().optional(),
});
export type UserProfileResponse = z.infer<typeof UserProfileResponseSchema>;
```

## 3. Constantes de Armazenamento e Avatar

Arquivo: `src/config/constants.ts`

```typescript
export const AVATAR_CONFIG = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
  UPLOAD_DIR: 'uploads/avatars',
  URL_PREFIX: '/uploads/avatars',
} as const;
```
