import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  encryptedApiKey?: string | null;
  iv?: string | null;
  authTag?: string | null;
  createdAt: Date;
  updatedAt: Date;
  hasAiKey(): boolean;
}

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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

UserSchema.methods.hasAiKey = function (): boolean {
  return Boolean(this.encryptedApiKey && this.iv && this.authTag);
};

export const UserModel = mongoose.model<IUser>('User', UserSchema, 'users');
