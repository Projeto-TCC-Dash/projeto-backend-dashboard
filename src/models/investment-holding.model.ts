import mongoose, { Document, Schema } from 'mongoose';
import { ASSET_MACRO_CLASSES, AssetMacroClass } from '../config/constants.js';

export interface IInvestmentHolding extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  macroClass: AssetMacroClass;
  amount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvestmentHoldingSchema = new Schema<IInvestmentHolding>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    macroClass: {
      type: String,
      enum: ASSET_MACRO_CLASSES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

InvestmentHoldingSchema.index(
  { userId: 1, accountId: 1, macroClass: 1 },
  { unique: true }
);

export const InvestmentHoldingModel = mongoose.model<IInvestmentHolding>(
  'InvestmentHolding',
  InvestmentHoldingSchema,
  'investment_holdings'
);
