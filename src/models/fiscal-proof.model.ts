import mongoose, { Document, Schema } from 'mongoose';

export interface IFiscalExtractedData {
  providerDocument?: string;
  providerName?: string;
  totalAmount?: number;
  issueDate?: Date;
  description?: string;
}

export interface IFiscalProofDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  transactionId?: mongoose.Types.ObjectId;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  extractedData?: IFiscalExtractedData;
  createdAt: Date;
  updatedAt: Date;
}

const FiscalExtractedDataSchema = new Schema<IFiscalExtractedData>(
  {
    providerDocument: { type: String, trim: true },
    providerName: { type: String, trim: true },
    totalAmount: { type: Number },
    issueDate: { type: Date },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const FiscalProofDocumentSchema = new Schema<IFiscalProofDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      required: false,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    storedFilename: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
    },
    extractedData: {
      type: FiscalExtractedDataSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

FiscalProofDocumentSchema.index({ userId: 1, createdAt: -1 });
FiscalProofDocumentSchema.index({ transactionId: 1 }, { sparse: true });

export const FiscalProofDocumentModel = mongoose.model<IFiscalProofDocument>(
  'FiscalProofDocument',
  FiscalProofDocumentSchema,
  'fiscal_proofs'
);
