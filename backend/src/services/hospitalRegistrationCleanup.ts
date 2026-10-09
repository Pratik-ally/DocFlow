import mongoose from 'mongoose';
import { Hospital } from '../models/Hospital';
import { HospitalEmailVerification } from '../models/HospitalEmailVerification';
import { User } from '../models/User';

export async function cleanupPendingHospitalRegistrations(now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const expiredOwners = await User.find({
    role: 'OWNER',
    status: 'PENDING_VERIFICATION',
    createdAt: { $lt: cutoff },
  }).select('_id hospitalId').lean();

  for (const owner of expiredOwners) {
    if (!owner.hospitalId) continue;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await HospitalEmailVerification.deleteOne({ ownerId: owner._id }, { session });
        await Hospital.deleteOne({
          _id: owner.hospitalId,
          ownerId: owner._id,
          status: 'PENDING',
        }, { session });
        await User.deleteOne({
          _id: owner._id,
          role: 'OWNER',
          status: 'PENDING_VERIFICATION',
          createdAt: { $lt: cutoff },
        }, { session });
      });
    } finally {
      await session.endSession();
    }
  }
}
