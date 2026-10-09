import mongoose, { Document, Schema } from 'mongoose';

export interface IHospitalEmailVerification extends Document {
  ownerId: mongoose.Types.ObjectId;
  hospitalId: mongoose.Types.ObjectId;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const HospitalEmailVerificationSchema = new Schema<IHospitalEmailVerification>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    codeHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, min: 0, max: 5, required: true },
  },
  { timestamps: true }
);

HospitalEmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
HospitalEmailVerificationSchema.index({ hospitalId: 1 });

export const HospitalEmailVerification = mongoose.model<IHospitalEmailVerification>(
  'HospitalEmailVerification',
  HospitalEmailVerificationSchema
);
