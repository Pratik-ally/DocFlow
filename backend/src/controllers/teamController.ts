import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Appointment } from '../models/Appointment';
import { AuditLog } from '../models/AuditLog';
import { Department } from '../models/Department';
import { Doctor } from '../models/Doctor';
import { Invite } from '../models/Invite';
import { User, UserRole } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { recordAudit } from '../services/audit';
import { canManage } from '../services/teamPermissions';

const idSchema = z.string().regex(/^[a-f\d]{24}$/i);
const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase());
const passwordSchema = z.string().min(8).max(72)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

const inviteInputSchema = z.object({
  email: emailSchema,
  role: z.enum(['DOCTOR', 'STAFF']),
  department: z.string().trim().min(1).max(100).optional(),
}).refine((input) => input.role !== 'DOCTOR' || Boolean(input.department), {
  message: 'A department is required for doctors',
  path: ['department'],
});

const adminInviteInputSchema = z.object({ email: emailSchema });
const memberUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  department: z.string().trim().min(1).max(100).optional(),
  specialization: z.string().trim().max(100).optional(),
}).refine((changes) => Object.keys(changes).length > 0);

function actor(req: AuthRequest) {
  if (!req.user?.hospitalId) {
    return null;
  }
  return { id: req.user.id, role: req.user.role, hospitalId: req.user.hospitalId };
}

async function createInvite(
  req: AuthRequest,
  res: Response,
  email: string,
  role: 'ADMIN' | 'DOCTOR' | 'STAFF',
  department?: string
): Promise<void> {
  const currentActor = actor(req);
  if (!currentActor) {
    res.status(403).json({ success: false, message: 'Insufficient permissions' });
    return;
  }

  const existing = await User.findOne({ email, hospitalId: currentActor.hospitalId });
  if (existing) {
    res.status(409).json({ success: false, message: 'Email already registered' });
    return;
  }

  const activeInvite = await Invite.findOne({
    email,
    hospitalId: currentActor.hospitalId,
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).select('_id');
  if (activeInvite) {
    res.status(409).json({ success: false, message: 'An active invite already exists for this email' });
    return;
  }

  if (role === 'DOCTOR' && department) {
    const departmentExists = await Department.exists({
      name: department,
      hospitalId: currentActor.hospitalId,
      isActive: true,
    });
    if (!departmentExists) {
      res.status(400).json({ success: false, message: 'Invalid department' });
      return;
    }
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await Invite.create({
    email,
    role,
    department,
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    hospitalId: currentActor.hospitalId,
    expiresAt,
    invitedBy: currentActor.id,
  });
  await recordAudit({
    hospitalId: currentActor.hospitalId,
    actorId: currentActor.id,
    action: 'TEAM_INVITE_CREATED',
  });

  res.status(201).json({
    success: true,
    invite: { email, role, department, expiresAt },
    token,
  });
}

export const listTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentActor = actor(req);
    if (!currentActor) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const roleSchema = z.enum(['OWNER', 'ADMIN', 'DOCTOR', 'STAFF']);
    const statusSchema = z.enum(['ACTIVE', 'REMOVED']);
    const page = z.coerce.number().int().min(1).max(10000).default(1).safeParse(req.query.page);
    const limit = z.coerce.number().int().min(1).max(100).default(50).safeParse(req.query.limit);
    const role = req.query.role === undefined ? undefined : roleSchema.safeParse(req.query.role);
    const status = req.query.status === undefined ? undefined : statusSchema.safeParse(req.query.status);
    const department = typeof req.query.department === 'string' ? req.query.department.trim() : undefined;
    if (!page.success || !limit.success || (role && !role.success) || (status && !status.success)) {
      res.status(400).json({ success: false, message: 'Invalid team filters' });
      return;
    }
    if (
      currentActor.role === 'ADMIN' &&
      role?.success &&
      role.data !== 'DOCTOR' &&
      role.data !== 'STAFF'
    ) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const filter: Record<string, unknown> = {
      hospitalId: currentActor.hospitalId,
      role: { $in: currentActor.role === 'OWNER' ? ['OWNER', 'ADMIN', 'DOCTOR', 'STAFF'] : ['DOCTOR', 'STAFF'] },
    };
    if (role?.success) filter.role = role.data;
    if (status?.success) filter.status = status.data;
    if (department) filter.department = department;

    const [total, members] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('name email phone role department specialization status lastLoginAt removedAt createdAt mustChangePassword')
        .sort({ createdAt: -1 })
        .skip((page.data - 1) * limit.data)
        .limit(limit.data)
        .lean(),
    ]);
    res.json({ success: true, members, total });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch team' });
  }
};

export const inviteTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = inviteInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid invite details' });
      return;
    }
    await createInvite(req, res, parsed.data.email, parsed.data.role, parsed.data.department);
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create invite' });
  }
};

export const inviteAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = adminInviteInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid invite details' });
      return;
    }
    await createInvite(req, res, parsed.data.email, 'ADMIN');
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create invite' });
  }
};

export const updateTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentActor = actor(req);
    const id = idSchema.safeParse(req.params.id);
    const parsed = memberUpdateSchema.safeParse(req.body);
    if (!currentActor || !id.success || !parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid member update' });
      return;
    }

    const target = await User.findOne({
      _id: id.data,
      hospitalId: currentActor.hospitalId,
      status: 'ACTIVE',
    });
    if (!target || !canManage(currentActor, {
      id: target._id.toString(),
      role: target.role,
      hospitalId: target.hospitalId?.toString(),
    })) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    let doctorDepartmentId: mongoose.Types.ObjectId | undefined;
    if (parsed.data.department !== undefined && target.role === 'DOCTOR') {
      const department = await Department.findOne({
        name: parsed.data.department,
        hospitalId: currentActor.hospitalId,
        isActive: true,
      }).select('_id');
      if (!department) {
        res.status(400).json({ success: false, message: 'Invalid department' });
        return;
      }
      doctorDepartmentId = department._id;
    }

    Object.assign(target, parsed.data);
    await target.save();
    if (target.role === 'DOCTOR') {
      await Doctor.updateOne(
        { userId: target._id, hospitalId: currentActor.hospitalId },
        {
          ...(doctorDepartmentId && { departmentId: doctorDepartmentId }),
          ...(parsed.data.specialization && { specialization: parsed.data.specialization }),
        }
      );
    }
    await recordAudit({
      hospitalId: currentActor.hospitalId,
      actorId: currentActor.id,
      action: 'TEAM_MEMBER_UPDATED',
      targetId: target._id.toString(),
      ipAddress: req.ip,
    });
    res.json({ success: true, message: 'Member updated' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update team member' });
  }
};

export const removeTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentActor = actor(req);
    const id = idSchema.safeParse(req.params.id);
    if (!currentActor || !id.success) {
      res.status(400).json({ success: false, message: 'Invalid team member' });
      return;
    }

    const target = await User.findOne({ _id: id.data, hospitalId: currentActor.hospitalId });
    if (!target || !canManage(currentActor, {
      id: target._id.toString(),
      role: target.role,
      hospitalId: target.hospitalId?.toString(),
    })) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    if (target.role === 'OWNER') {
      const ownerCount = await User.countDocuments({
        hospitalId: currentActor.hospitalId,
        role: 'OWNER',
        status: 'ACTIVE',
      });
      if (ownerCount <= 1) {
        res.status(409).json({ success: false, message: 'The last owner cannot be removed' });
        return;
      }
    }

    if (target.role === 'ADMIN') {
      const confirmation = z.object({ ownerPassword: z.string().min(1).max(72) }).safeParse(req.body);
      if (!confirmation.success || currentActor.role !== 'OWNER') {
        res.status(400).json({ success: false, message: 'Owner password confirmation required' });
        return;
      }
      const owner = await User.findOne({ _id: currentActor.id, hospitalId: currentActor.hospitalId, role: 'OWNER' });
      if (!owner || !await bcrypt.compare(confirmation.data.ownerPassword, owner.passwordHash)) {
        res.status(403).json({ success: false, message: 'Invalid owner credentials' });
        return;
      }
    }

    const now = new Date();
    target.status = 'REMOVED';
    target.removedAt = now;
    target.removedBy = new mongoose.Types.ObjectId(currentActor.id);
    target.sessionVersion += 1;
    await target.save();

    let upcomingAppointments: unknown[] = [];
    if (target.role === 'DOCTOR') {
      const doctor = await Doctor.findOne({
        userId: target._id,
        hospitalId: currentActor.hospitalId,
      }).select('_id');
      if (doctor) {
        upcomingAppointments = await Appointment.find({
          doctorId: doctor._id,
          hospitalId: currentActor.hospitalId,
          appointmentDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          status: { $nin: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
        }).select('appointmentId appointmentDate appointmentTime patientId').lean();
      }
    }

    await recordAudit({
      hospitalId: currentActor.hospitalId,
      actorId: currentActor.id,
      action: 'TEAM_MEMBER_REMOVED',
      targetId: target._id.toString(),
      ipAddress: req.ip,
    });
    res.json({ success: true, upcomingAppointments });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to remove team member' });
  }
};

export const reactivateTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentActor = actor(req);
    const id = idSchema.safeParse(req.params.id);
    if (!currentActor || !id.success) {
      res.status(400).json({ success: false, message: 'Invalid team member' });
      return;
    }

    const target = await User.findOne({
      _id: id.data,
      hospitalId: currentActor.hospitalId,
      status: 'REMOVED',
    });
    if (!target || !canManage(currentActor, {
      id: target._id.toString(),
      role: target.role,
      hospitalId: target.hospitalId?.toString(),
    })) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    target.status = 'ACTIVE';
    target.removedAt = undefined;
    target.removedBy = undefined;
    target.sessionVersion += 1;
    await target.save();
    await recordAudit({
      hospitalId: currentActor.hospitalId,
      actorId: currentActor.id,
      action: 'TEAM_MEMBER_REACTIVATED',
      targetId: target._id.toString(),
      ipAddress: req.ip,
    });
    res.json({ success: true, message: 'Member reactivated' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to reactivate team member' });
  }
};

export const acceptInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = z.object({
      token: z.string().regex(/^[a-f\d]{64}$/i),
      name: z.string().trim().min(2).max(100),
      phone: z.string().trim().min(10).max(20),
      password: passwordSchema,
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid or expired invite' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
    const invite = await Invite.findOneAndUpdate(
      { tokenHash, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
      { new: true }
    );
    if (!invite) {
      res.status(400).json({ success: false, message: 'Invalid or expired invite' });
      return;
    }

    const existing = await User.findOne({ email: invite.email, hospitalId: invite.hospitalId });
    if (existing) {
      res.status(400).json({ success: false, message: 'Invalid or expired invite' });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, config.bcryptRounds);
    const user = await User.create({
      name: parsed.data.name,
      email: invite.email,
      phone: parsed.data.phone,
      passwordHash,
      role: invite.role as UserRole,
      hospitalId: invite.hospitalId,
      status: 'ACTIVE',
      department: invite.department,
      mustChangePassword: false,
    });

    if (invite.role === 'DOCTOR') {
      const department = await Department.findOne({
        name: invite.department,
        hospitalId: invite.hospitalId,
        isActive: true,
      }).select('_id');
      if (!department) {
        await User.deleteOne({ _id: user._id, hospitalId: invite.hospitalId });
        res.status(400).json({ success: false, message: 'Invalid or expired invite' });
        return;
      }
      await Doctor.create({
        userId: user._id,
        hospitalId: invite.hospitalId,
        departmentId: department._id,
        specialization: 'General',
        licenseNumber: `INV-${new mongoose.Types.ObjectId().toString()}`,
        qualifications: [],
        experience: 0,
        availability: [],
        isAvailable: true,
        consultationFee: 0,
      });
    }

    await recordAudit({
      hospitalId: invite.hospitalId.toString(),
      actorId: user._id.toString(),
      action: 'TEAM_INVITE_ACCEPTED',
      targetId: user._id.toString(),
      ipAddress: req.ip,
    });
    res.status(201).json({ success: true, message: 'Invite accepted' });
  } catch {
    res.status(500).json({ success: false, message: 'Could not accept invite' });
  }
};

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentActor = actor(req);
    const page = z.coerce.number().int().min(1).max(10000).default(1).safeParse(req.query.page);
    const limit = z.coerce.number().int().min(1).max(100).default(50).safeParse(req.query.limit);
    if (!currentActor || !page.success || !limit.success) {
      res.status(400).json({ success: false, message: 'Invalid audit log query' });
      return;
    }
    const filter = { hospitalId: currentActor.hospitalId };
    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .populate('actorId', 'name email role')
        .sort({ at: -1 })
        .skip((page.data - 1) * limit.data)
        .limit(limit.data)
        .lean(),
    ]);
    res.json({ success: true, logs, total });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch audit log' });
  }
};
