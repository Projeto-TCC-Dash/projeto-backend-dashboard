import mongoose, { Document, Schema, Types } from 'mongoose';
import { ACCOUNT_TYPES, AccountType } from '../config/constants.js';

export interface IAccount extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  type: AccountType;
  initialBalance: number;
  institution?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    type: {
      type: String,
      enum: ACCOUNT_TYPES,
      required: true,
    },
    initialBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    institution: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    color: {
      type: String,
      trim: true,
      default: '#64748B',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Índice composto único para garantir unicidade de nome da conta por usuário
AccountSchema.index({ userId: 1, name: 1 }, { unique: true });

// Índice para ordenação de listagem por data de criação
AccountSchema.index({ userId: 1, createdAt: 1 });

export const AccountModel = mongoose.model<IAccount>('Account', AccountSchema);
