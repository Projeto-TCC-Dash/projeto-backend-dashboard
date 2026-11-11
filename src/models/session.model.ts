import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISession extends Document<string> {
  _id: string; // UUID v4
  userId: mongoose.Types.ObjectId;
  isRevoked: boolean;
  revokedAt?: Date | null;
  userAgent?: string | null;
  ip?: string | null;
  createdAt: Date;
  expiresAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    _id: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    _id: false, // O ID é explicitamente gerenciado como string UUID v4
    versionKey: false,
  }
);

// Índice TTL para expurgo automático quando a sessão ultrapassar a data de expiração
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SessionSchema.index({ userId: 1, isRevoked: 1 });

export const SessionModel: Model<ISession> =
  (mongoose.models.Session as Model<ISession>) ||
  mongoose.model<ISession>('Session', SessionSchema);
