import mongoose, { Document, Schema } from 'mongoose';

export type AppointmentPriority = 'ROUTINE' | 'SOON' | 'HIGH';
export type AppointmentStatus =
  | 'BOOKED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'WAITING'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface IAppointment extends Document {
  _id: mongoose.Types.ObjectId;
  appointmentId: string;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  hospitalId: mongoose.Types.ObjectId;
  appointmentDate: Date;
  appointmentTime: string;
  reason: string;
  symptoms: string[];
  priority: AppointmentPriority;
  requiresHumanReview: boolean;
  status: AppointmentStatus;
  notes?: string;
  followUpRequired?: boolean;
  followUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    appointmentId: { type: String, required: true, unique: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    appointmentDate: { type: Date, required: true },
    appointmentTime: { type: String, required: true },
    reason: { type: String, required: true },
    symptoms: [{ type: String }],
    priority: { type: String, enum: ['ROUTINE', 'SOON', 'HIGH'], default: 'ROUTINE' },
    requiresHumanReview: { type: Boolean, default: false, required: true },
    status: {
      type: String,
      enum: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
      default: 'BOOKED',
    },
    notes: { type: String },
    followUpRequired: { type: Boolean, default: false },
    followUpDate: { type: Date },
  },
  { timestamps: true }
);

AppointmentSchema.index({ patientId: 1, appointmentDate: -1 });
AppointmentSchema.index({ doctorId: 1, appointmentDate: 1 });
AppointmentSchema.index({ status: 1, appointmentDate: 1 });
AppointmentSchema.index(
  { doctorId: 1, appointmentDate: 1, appointmentTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
    },
  }
);

export const Appointment = mongoose.model<IAppointment>('Appointment', AppointmentSchema);
