import mongoose, { Document, Model, Schema } from 'mongoose';
import { TWO_FACTOR_CONFIG } from '../config/constants.js';

export type TwoFactorChallengeType = 'LOGIN' | 'ENABLE';
export type TwoFactorChallengeStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'LOCKED';

export interface ITwoFactorChallenge extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: TwoFactorChallengeType;
  otpHash: string;
  attempts: number;
  maxAttempts: number;
  status: TwoFactorChallengeStatus;
  lastSentAt: Date;
  expiresAt: Date;
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TwoFactorChallengeSchema = new Schema<ITwoFactorChallenge>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['LOGIN', 'ENABLE'],
      required: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: TWO_FACTOR_CONFIG.MAX_ATTEMPTS,
    },
    status: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED'],
      default: 'PENDING',
      index: true,
    },
    lastSentAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Índice TTL para deleção automática no MongoDB ao término da validade
TwoFactorChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
TwoFactorChallengeSchema.index({ userId: 1, status: 1 });

export const TwoFactorChallengeModel: Model<ITwoFactorChallenge> =
  (mongoose.models.TwoFactorChallenge as Model<ITwoFactorChallenge>) ||
  mongoose.model<ITwoFactorChallenge>('TwoFactorChallenge', TwoFactorChallengeSchema);
