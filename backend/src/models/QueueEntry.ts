import mongoose, { Document, Schema } from 'mongoose';

export type QueueStatus = 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'SKIPPED';

export interface IQueueEntry extends Document {
  _id: mongoose.Types.ObjectId;
  appointmentId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  priority: 'ROUTINE' | 'SOON' | 'HIGH';
  queuePosition: number;
  estimatedWaitTime: number;
  status: QueueStatus;
  checkedInAt?: Date;
  consultationStartedAt?: Date;
  completedAt?: Date;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QueueEntrySchema = new Schema<IQueueEntry>(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    priority: { type: String, enum: ['ROUTINE', 'SOON', 'HIGH'], default: 'ROUTINE' },
    queuePosition: { type: Number, required: true },
    estimatedWaitTime: { type: Number, default: 0 },
    status: { type: String, enum: ['WAITING', 'IN_CONSULTATION', 'COMPLETED', 'SKIPPED'], default: 'WAITING' },
    checkedInAt: { type: Date },
    consultationStartedAt: { type: Date },
    completedAt: { type: Date },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

QueueEntrySchema.index({ doctorId: 1, date: 1, queuePosition: 1 });
QueueEntrySchema.index({ patientId: 1, status: 1 });

export const QueueEntry = mongoose.model<IQueueEntry>('QueueEntry', QueueEntrySchema);
