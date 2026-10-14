import mongoose, { Document, Schema } from 'mongoose';
import { CANONICAL_CATEGORIES, Category, TRANSACTION_SOURCES, TransactionSource } from '../config/constants.js';

export interface ITransaction extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  externalId: string;
  rawDescription: string;
  cleanDescription: string;
  amount: number;
  date: Date;
  category: Category;
  source: TransactionSource;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    externalId: {
      type: String,
      required: true,
      trim: true,
    },
    rawDescription: {
      type: String,
      required: true,
    },
    cleanDescription: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    category: {
      type: String,
      enum: CANONICAL_CATEGORIES,
      default: 'Não Categorizado',
    },
    source: {
      type: String,
      enum: TRANSACTION_SOURCES,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Índice composto único obrigatório para garantia definitiva de idempotência
TransactionSchema.index({ userId: 1, externalId: 1 }, { unique: true });

// Índices para otimização de consultas e agregações
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, category: 1 });

export const TransactionModel = mongoose.model<ITransaction>(
  'Transaction',
  TransactionSchema,
  'transactions'
);
