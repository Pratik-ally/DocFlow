import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog';

export async function recordAudit(input: {
  hospitalId?: string;
  actorId?: string;
  action: string;
  targetId?: string;
  ipAddress?: string;
}): Promise<void> {
  if (!input.hospitalId) {
    return;
  }

  await AuditLog.create({
    hospitalId: new mongoose.Types.ObjectId(input.hospitalId),
    actorId: input.actorId ? new mongoose.Types.ObjectId(input.actorId) : undefined,
    action: input.action,
    targetId: input.targetId ? new mongoose.Types.ObjectId(input.targetId) : undefined,
    ipAddress: input.ipAddress,
    at: new Date(),
  });
}
