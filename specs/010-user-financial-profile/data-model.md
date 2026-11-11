# Data Model & Schema Design: Feature 010

## Enums

Location: `src/config/constants.ts`

```typescript
export const INCOME_TYPES = [
  'CLT',
  'PJ_AUTONOMO',
  'PUBLIC_SERVANT',
  'ENTREPRENEUR',
  'STUDENT',
  'RETIRED',
  'OTHER',
] as const;
export const IncomeTypeEnum = z.enum(INCOME_TYPES);
export type IncomeType = z.infer<typeof IncomeTypeEnum>;

export const FINANCIAL_GOALS = [
  'RESERVA_EMERGENCIA',
  'QUITAR_DIVIDAS',
  'COMPRAR_IMOVEL',
  'INVESTIR_LONGO_PRAZO',
  'CONTROLE_GASTOS',
] as const;
export const FinancialGoalEnum = z.enum(FINANCIAL_GOALS);
export type FinancialGoal = z.infer<typeof FinancialGoalEnum>;

export const RISK_PROFILES = [
  'CONSERVATIVE',
  'MODERATE',
  'AGGRESSIVE',
] as const;
export const RiskProfileEnum = z.enum(RISK_PROFILES);
export type RiskProfile = z.infer<typeof RiskProfileEnum>;
```

---

## Entity: User (`IUser`) & Subdocument `IFinancialProfile`

Location: `src/models/user.model.ts`

```typescript
export interface IFinancialProfile {
  incomeType?: IncomeType;
  declaredMonthlyIncome?: number;
  goals?: FinancialGoal[];
  riskProfile?: RiskProfile;
  updatedAt?: Date;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  encryptedApiKey?: string | null;
  iv?: string | null;
  authTag?: string | null;
  financialProfile?: IFinancialProfile;
  createdAt: Date;
  updatedAt: Date;
  hasAiKey(): boolean;
}
```

### Mongoose Subschema:
```typescript
const FinancialProfileSubschema = new Schema<IFinancialProfile>(
  {
    incomeType: { type: String, enum: INCOME_TYPES },
    declaredMonthlyIncome: { type: Number, min: 0 },
    goals: { type: [String], enum: FINANCIAL_GOALS, default: [] },
    riskProfile: { type: String, enum: RISK_PROFILES },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);
```

---

## Zod Schemas

Location: `src/schemas/user.schemas.ts`

```typescript
export const FinancialProfileSchema = z.object({
  incomeType: IncomeTypeEnum.optional(),
  declaredMonthlyIncome: z.number().min(0, 'A renda declarada deve ser maior ou igual a zero').optional(),
  goals: z.array(FinancialGoalEnum).optional(),
  riskProfile: RiskProfileEnum.optional(),
  updatedAt: z.date().optional(),
});

export const UpdateFinancialProfileRequestSchema = z.object({
  incomeType: IncomeTypeEnum.optional(),
  declaredMonthlyIncome: z.number().min(0, 'A renda declarada deve ser maior ou igual a zero').optional(),
  goals: z.array(FinancialGoalEnum).optional(),
  riskProfile: RiskProfileEnum.optional(),
});
export type UpdateFinancialProfileRequest = z.infer<typeof UpdateFinancialProfileRequestSchema>;

export const UserProfileResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  hasAiKey: z.boolean(),
  financialProfile: FinancialProfileSchema.optional(),
});
export type UserProfileResponse = z.infer<typeof UserProfileResponseSchema>;
```
