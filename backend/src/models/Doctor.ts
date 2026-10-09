import mongoose, { Document, Schema } from 'mongoose';

export interface IDoctor extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  hospitalId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  specialization: string;
  licenseNumber: string;
  qualifications: string[];
  experience: number;
  availability: {
    day: string;
    startTime: string;
    endTime: string;
    maxPatients: number;
  }[];
  isAvailable: boolean;
  consultationFee: number;
  createdAt: Date;
  updatedAt: Date;
}

const DoctorSchema = new Schema<IDoctor>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    specialization: { type: String, required: true },
    licenseNumber: { type: String, required: true, unique: true },
    qualifications: [{ type: String }],
    experience: { type: Number, default: 0 },
    availability: [
      {
        day: { type: String, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        maxPatients: { type: Number, default: 20 },
      },
    ],
    isAvailable: { type: Boolean, default: true },
    consultationFee: { type: Number, default: 0 },
  },
  { timestamps: true }
);

DoctorSchema.index({ hospitalId: 1, departmentId: 1 });

export const Doctor = mongoose.model<IDoctor>('Doctor', DoctorSchema);
