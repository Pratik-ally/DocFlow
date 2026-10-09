import mongoose from 'mongoose';
import { config } from './config';
import { User } from './models/User';
import { Hospital } from './models/Hospital';
import { QueueEntry } from './models/QueueEntry';
import { Appointment } from './models/Appointment';
import { AuditLog } from './models/AuditLog';

async function migrate(): Promise<void> {
  await mongoose.connect(config.mongoUri);

  const userIndexes = await User.collection.indexes();
  const globalEmailIndex = userIndexes.find((index) =>
    index.name === 'email_1' &&
    index.unique === true &&
    Object.keys(index.key).length === 1 &&
    index.key.email === 1
  );
  if (globalEmailIndex?.name) {
    await User.collection.dropIndex(globalEmailIndex.name);
  }

  for await (const user of User.collection.find({})) {
    const set: Record<string, unknown> = {
      status: user.status === 'REMOVED'
        ? 'REMOVED'
        : user.status === 'PENDING_VERIFICATION' ? 'PENDING_VERIFICATION' : 'ACTIVE',
      sessionVersion: Number.isSafeInteger(user.sessionVersion) ? user.sessionVersion : 0,
      failedLoginCount: Number.isSafeInteger(user.failedLoginCount)
        ? user.failedLoginCount
        : Number.isSafeInteger(user.loginAttempts) ? user.loginAttempts : 0,
    };
    if (user.lockedUntil ?? user.loginLockedUntil) {
      set.lockedUntil = user.lockedUntil ?? user.loginLockedUntil;
    }
    await User.collection.updateOne(
      { _id: user._id },
      {
        $set: set,
        $unset: {
          loginAttempts: '',
          loginLockedUntil: '',
          inviteToken: '',
          inviteTokenExpires: '',
        },
      }
    );
  }

  await Hospital.collection.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'ACTIVE' } }
  );
  const duplicateEmail = await User.collection.aggregate<{ _id: string }>([
    { $match: { email: { $type: 'string' } } },
    { $group: { _id: { $toLower: '$email' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  ]).next();
  if (duplicateEmail) {
    throw new Error('Resolve duplicate account emails before creating the global unique email index');
  }
  const duplicateMobile = await User.collection.aggregate<{ _id: string }>([
    { $match: { mobile: { $type: 'string' } } },
    { $group: { _id: '$mobile', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  ]).next();
  if (duplicateMobile) {
    throw new Error('Resolve duplicate mobile numbers before creating the global unique mobile index');
  }
  await User.createIndexes();

  for await (const hospital of Hospital.collection.find({ ownerId: { $exists: false } })) {
    const owner = await User.findOne({
      hospitalId: hospital._id,
      role: 'OWNER',
      status: 'ACTIVE',
    }).select('_id');
    if (!owner) {
      throw new Error(`Hospital ${hospital._id.toString()} has no active owner`);
    }
    await Hospital.collection.updateOne({ _id: hospital._id }, { $set: { ownerId: owner._id } });
  }

  for await (const entry of QueueEntry.collection.find({ hospitalId: { $exists: false } })) {
    const appointment = await Appointment.findById(entry.appointmentId).select('hospitalId');
    if (!appointment) {
      throw new Error(`Queue entry ${entry._id.toString()} has no appointment`);
    }
    await QueueEntry.collection.updateOne(
      { _id: entry._id },
      { $set: { hospitalId: appointment.hospitalId } }
    );
  }

  for await (const audit of AuditLog.collection.find({})) {
    const hospitalId = audit.hospitalId;
    if (!hospitalId) {
      await AuditLog.collection.deleteOne({ _id: audit._id });
      continue;
    }
    const rawTargetId = audit.targetId ?? audit.resourceId;
    const targetId = typeof rawTargetId === 'string' && mongoose.Types.ObjectId.isValid(rawTargetId)
      ? new mongoose.Types.ObjectId(rawTargetId)
      : undefined;
    const actorId = audit.actorId ?? audit.performedBy ?? audit.userId;
    const at = audit.at ?? audit.timestamp ?? new Date();
    await AuditLog.collection.updateOne(
      { _id: audit._id },
      {
        $set: {
          hospitalId,
          actorId,
          targetId,
          action: typeof audit.action === 'string' ? audit.action : 'LEGACY_AUDIT',
          at: new Date(at),
        },
        $unset: {
          userId: '',
          performedBy: '',
          resource: '',
          resourceId: '',
          details: '',
          userAgent: '',
          timestamp: '',
        },
      }
    );
  }

  await User.createIndexes();
  await QueueEntry.createIndexes();
  await AuditLog.createIndexes();
  console.log('Tenant, session, invite, and audit migration completed.');
}

migrate()
  .catch((error: unknown) => {
    console.error('Migration failed:', error instanceof Error ? error.name : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
