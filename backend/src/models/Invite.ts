import mongoose, { Document, Schema } from 'mongoose';
import { UserRole } from './User';

export interface IInvite extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  role: Extract<UserRole, 'ADMIN' | 'DOCTOR' | 'STAFF'>;
  department?: string;
  tokenHash: string;
  hospitalId: mongoose.Types.ObjectId;
  expiresAt: Date;
  usedAt?: Date;
  invitedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const InviteSchema = new Schema<IInvite>({
  email: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ['ADMIN', 'DOCTOR', 'STAFF'], required: true },
  department: { type: String, trim: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now, required: true },
});

InviteSchema.index({ hospitalId: 1, email: 1, usedAt: 1 });
InviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Invite = mongoose.model<IInvite>('Invite', InviteSchema);
