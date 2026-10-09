import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_CANCELLED'
  | 'QUEUE_UPDATED'
  | 'APPOINTMENT_REMINDER'
  | 'PRIORITY_UPDATED'
  | 'GENERAL';

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  relatedId?: mongoose.Types.ObjectId;
  relatedModel?: string;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['APPOINTMENT_CONFIRMED', 'APPOINTMENT_CANCELLED', 'QUEUE_UPDATED', 'APPOINTMENT_REMINDER', 'PRIORITY_UPDATED', 'GENERAL'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    relatedId: { type: Schema.Types.ObjectId },
    relatedModel: { type: String },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
