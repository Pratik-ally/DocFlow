import mongoose, { Document, Schema } from 'mongoose';

export interface IPriorityAssessment extends Document {
  _id: mongoose.Types.ObjectId;
  appointmentId: mongoose.Types.ObjectId;
  hospitalId?: mongoose.Types.ObjectId;
  inputData: {
    symptoms: string[];
    reason: string;
    age?: number;
    gender?: string;
    medicalHistory?: string[];
    urgencyLevel?: string;
  };
  suggestedPriority: 'ROUTINE' | 'SOON' | 'HIGH';
  confidence: number;
  reason: string;
  factors: string[];
  requiresHumanReview: boolean;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewerNotes?: string;
  finalPriority?: 'ROUTINE' | 'SOON' | 'HIGH';
  reviewedAt?: Date;
  createdAt: Date;
}

const PriorityAssessmentSchema = new Schema<IPriorityAssessment>(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital' },
    inputData: {
      symptoms: [{ type: String }],
      reason: { type: String },
      age: { type: Number },
      gender: { type: String },
      medicalHistory: [{ type: String }],
      urgencyLevel: { type: String },
    },
    suggestedPriority: { type: String, enum: ['ROUTINE', 'SOON', 'HIGH'], required: true },
    confidence: { type: Number, required: true },
    reason: { type: String, required: true },
    factors: [{ type: String }],
    requiresHumanReview: { type: Boolean, default: false },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewerNotes: { type: String },
    finalPriority: { type: String, enum: ['ROUTINE', 'SOON', 'HIGH'] },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

PriorityAssessmentSchema.index({ hospitalId: 1, createdAt: -1 });

export const PriorityAssessment = mongoose.model<IPriorityAssessment>('PriorityAssessment', PriorityAssessmentSchema);
