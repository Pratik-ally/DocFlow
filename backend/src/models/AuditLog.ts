import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  actorId?: mongoose.Types.ObjectId;
  action: string;
  targetId?: mongoose.Types.ObjectId;
  hospitalId: mongoose.Types.ObjectId;
  at: Date;
  ipAddress?: string;
}

const AuditLogSchema = new Schema<IAuditLog>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  targetId: { type: Schema.Types.ObjectId },
  at: { type: Date, default: Date.now, required: true },
  ipAddress: { type: String },
});

AuditLogSchema.index({ hospitalId: 1, at: -1 });
AuditLogSchema.index({ actorId: 1, at: -1 });
AuditLogSchema.index({ targetId: 1, at: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
