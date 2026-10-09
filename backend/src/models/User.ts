import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'PATIENT' | 'DOCTOR' | 'STAFF' | 'ADMIN' | 'OWNER';
export type UserStatus = 'ACTIVE' | 'REMOVED' | 'PENDING_VERIFICATION';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  mobile?: string;
  passwordHash: string;
  role: UserRole;
  /** Only set for OWNER/ADMIN/DOCTOR/STAFF */
  hospitalId?: mongoose.Types.ObjectId;
  /** ACTIVE | REMOVED */
  status: UserStatus;
  emailVerifiedAt?: Date;
  mobileVerifiedAt?: Date;
  removedAt?: Date;
  removedBy?: mongoose.Types.ObjectId;
  department?: string;
  specialization?: string;
  /** Force password change on first login (after invite) */
  mustChangePassword?: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  lastLoginAt?: Date;
  failedLoginCount: number;
  lockedUntil?: Date;
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    mobile: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['PATIENT', 'DOCTOR', 'STAFF', 'ADMIN', 'OWNER'], required: true },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: function (this: IUser) {
        return this.role !== 'PATIENT';
      },
    },
    status: { type: String, enum: ['ACTIVE', 'REMOVED', 'PENDING_VERIFICATION'], default: 'ACTIVE', required: true },
    emailVerifiedAt: { type: Date },
    mobileVerifiedAt: { type: Date },
    removedAt: { type: Date },
    removedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    department: { type: String },
    specialization: { type: String },
    mustChangePassword: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    lastLoginAt: { type: Date },
    failedLoginCount: { type: Number, default: 0, min: 0, required: true },
    lockedUntil: { type: Date },
    sessionVersion: { type: Number, default: 0, min: 0, required: true },
  },
  { timestamps: true }
);

UserSchema.index(
  { hospitalId: 1, email: 1 },
  { unique: true, partialFilterExpression: { hospitalId: { $exists: true } } }
);
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } }, name: 'email_unique_global' }
);
UserSchema.index({ hospitalId: 1, role: 1, status: 1 });
UserSchema.index(
  { mobile: 1 },
  { unique: true, partialFilterExpression: { mobile: { $type: 'string' } }, name: 'mobile_unique_global' }
);

export const User = mongoose.model<IUser>('User', UserSchema);
