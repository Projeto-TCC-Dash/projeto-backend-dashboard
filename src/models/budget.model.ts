import mongoose, { Document, Schema } from 'mongoose';
import { CANONICAL_CATEGORIES, Category } from '../config/constants.js';

export interface ICategoryBudget {
  category: Category;
  limitAmount: number;
}

export interface IBudgetPlan extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  month: string; // YYYY-MM
  totalLimitAmount: number;
  categoryBudgets: ICategoryBudget[];
  createdAt: Date;
  updatedAt: Date;
}

const CategoryBudgetSchema = new Schema<ICategoryBudget>(
  {
    category: {
      type: String,
      enum: CANONICAL_CATEGORIES,
      required: true,
    },
    limitAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const BudgetPlanSchema = new Schema<IBudgetPlan>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}$/,
    },
    totalLimitAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    categoryBudgets: {
      type: [CategoryBudgetSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Um único plano de orçamento por usuário em cada mês
BudgetPlanSchema.index({ userId: 1, month: 1 }, { unique: true });

export const BudgetPlanModel = mongoose.model<IBudgetPlan>(
  'BudgetPlan',
  BudgetPlanSchema,
  'budgets'
);
