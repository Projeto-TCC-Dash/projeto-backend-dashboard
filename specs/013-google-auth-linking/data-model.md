# Data Model: Vínculo de Contas Sociais — Google OAuth 2.0

## 1. Entidade User (Extensão)

### Subdocumento `googleAccount`
```typescript
export interface IGoogleAccount {
  googleId: string;       // Identificador único e imutável do usuário no Google (claim 'sub')
  googleEmail: string;    // Endereço de e-mail do Google (claim 'email')
  linkedAt: Date;         // Timestamp da vinculação
}
```

### Schema Mongoose
```typescript
const GoogleAccountSubschema = new Schema<IGoogleAccount>(
  {
    googleId: { type: String, required: true },
    googleEmail: { type: String, required: true, lowercase: true, trim: true },
    linkedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Adicionado ao UserSchema:
UserSchema.add({
  googleAccount: {
    type: GoogleAccountSubschema,
    default: null,
  },
});

// Índice único esparso:
UserSchema.index({ 'googleAccount.googleId': 1 }, { unique: true, sparse: true });
```

---

## 2. Schemas Zod de Requisição e Resposta

### Vínculo de Conta Google (`POST /api/auth/google/link`)
```typescript
export const GoogleLinkRequestSchema = z.object({
  idToken: z.string({ required_error: 'O idToken do Google é obrigatório' }).min(10, 'Token do Google inválido'),
});
export type GoogleLinkRequest = z.infer<typeof GoogleLinkRequestSchema>;

export const GoogleLinkResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  googleAccount: z.object({
    googleEmail: z.string().email(),
    linkedAt: z.date(),
  }),
});
export type GoogleLinkResponse = z.infer<typeof GoogleLinkResponseSchema>;
```

### Desvinculação de Conta Google (`DELETE /api/auth/google/unlink`)
```typescript
export const GoogleUnlinkResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type GoogleUnlinkResponse = z.infer<typeof GoogleUnlinkResponseSchema>;
```

### Login com Conta Google (`POST /api/auth/google`)
```typescript
export const GoogleLoginRequestSchema = z.object({
  idToken: z.string({ required_error: 'O idToken do Google é obrigatório' }).min(10, 'Token do Google inválido'),
});
export type GoogleLoginRequest = z.infer<typeof GoogleLoginRequestSchema>;
```

### Configurações de Segurança no Perfil (`UserSecuritySettings`)
```typescript
export const UserSecuritySettingsSchema = z.object({
  hasLocalPassword: z.boolean().default(true),
  googleLinked: z.boolean().default(false),
  googleEmail: z.string().email().optional(),
  googleLinkedAt: z.coerce.date().optional(),
});
export type UserSecuritySettings = z.infer<typeof UserSecuritySettingsSchema>;
```
