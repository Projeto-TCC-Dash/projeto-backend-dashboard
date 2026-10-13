import mongoose, { Document, Schema } from 'mongoose';

export interface ICategoryMetric {
  category: string;
  amount: number;
  percentage: number;
}

export interface IFinancialMetrics {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  savingsRate: number;
  topCategories: ICategoryMetric[];
}

export interface IFinancialAnalysis extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  month: string;
  transactionStateHash: string;
  diagnosis: string;
  recommendations: string[];
  metrics: IFinancialMetrics;
  generatedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryMetricSubschema = new Schema<ICategoryMetric>(
  {
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    percentage: { type: Number, required: true },
  },
  { _id: false }
);

const FinancialMetricsSubschema = new Schema<IFinancialMetrics>(
  {
    totalIncome: { type: Number, required: true },
    totalExpenses: { type: Number, required: true },
    netBalance: { type: Number, required: true },
    savingsRate: { type: Number, required: true },
    topCategories: { type: [CategoryMetricSubschema], default: [] },
  },
  { _id: false }
);

const FinancialAnalysisSchema = new Schema<IFinancialAnalysis>(
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
      match: /^\d{4}-\d{2}$/,
    },
    transactionStateHash: {
      type: String,
      required: true,
    },
    diagnosis: {
      type: String,
      required: true,
    },
    recommendations: {
      type: [String],
      default: [],
    },
    metrics: {
      type: FinancialMetricsSubschema,
      required: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// 1. Índice composto único por usuário e mês (no máximo 1 registro por mês por usuário)
FinancialAnalysisSchema.index({ userId: 1, month: 1 }, { unique: true });

// 2. Índice TTL nativo do MongoDB para expiração automática após a data expiresAt
FinancialAnalysisSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const FinancialAnalysisModel = mongoose.model<IFinancialAnalysis>(
  'FinancialAnalysis',
  FinancialAnalysisSchema,
  'financial_analyses'
);
