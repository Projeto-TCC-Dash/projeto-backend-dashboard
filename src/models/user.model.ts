import mongoose, { Document, Schema } from 'mongoose';
import {
  FINANCIAL_GOALS,
  FinancialGoal,
  INCOME_TYPES,
  IncomeType,
  RISK_PROFILES,
  RiskProfile,
} from '../config/constants.js';

export interface IFinancialProfile {
  incomeType?: IncomeType;
  declaredMonthlyIncome?: number;
  goals?: FinancialGoal[];
  riskProfile?: RiskProfile;
  updatedAt?: Date;
}

export interface IGoogleAccount {
  googleId: string;
  googleEmail: string;
  linkedAt: Date;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  name?: string;
  avatarUrl?: string | null;
  encryptedApiKey?: string | null;
  iv?: string | null;
  authTag?: string | null;
  financialProfile?: IFinancialProfile;
  googleAccount?: IGoogleAccount | null;
  isTwoFactorEnabled: boolean;
  twoFactorConfirmedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  hasAiKey(): boolean;
}

const GoogleAccountSubschema = new Schema<IGoogleAccount>(
  {
    googleId: { type: String, required: true },
    googleEmail: { type: String, required: true, lowercase: true, trim: true },
    linkedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

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

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      trim: true,
      default: undefined,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    encryptedApiKey: {
      type: String,
      default: null,
    },
    iv: {
      type: String,
      default: null,
    },
    authTag: {
      type: String,
      default: null,
    },
    financialProfile: {
      type: FinancialProfileSubschema,
      default: () => ({}),
    },
    googleAccount: {
      type: GoogleAccountSubschema,
      default: null,
    },
    isTwoFactorEnabled: {
      type: Boolean,
      default: false,
      required: true,
    },
    twoFactorConfirmedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

UserSchema.methods.hasAiKey = function (): boolean {
  return Boolean(this.encryptedApiKey && this.iv && this.authTag);
};

UserSchema.index({ 'googleAccount.googleId': 1 }, { unique: true, sparse: true });

export const UserModel = mongoose.model<IUser>('User', UserSchema, 'users');
