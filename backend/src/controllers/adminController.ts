import { Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Appointment } from '../models/Appointment';
import { Patient } from '../models/Patient';
import { QueueEntry } from '../models/QueueEntry';
import { User, UserRole } from '../models/User';
import { AuthRequest } from '../middleware/auth';

function getHospitalId(req: AuthRequest, res: Response): string | null {
  const hospitalId = req.user?.hospitalId;
  if (!hospitalId) {
    res.status(403).json({ success: false, message: 'Insufficient permissions' });
    return null;
  }
  return hospitalId;
}

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hospitalId = getHospitalId(req, res);
    if (!hospitalId) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const appointmentFilter = { hospitalId };

    const [
      todayAppointments,
      waitingPatients,
      highPriority,
      completed,
      totalUsers,
      patientIds,
      noShowCount,
      queueEntries,
    ] = await Promise.all([
      Appointment.countDocuments({ ...appointmentFilter, appointmentDate: { $gte: today, $lt: tomorrow } }),
      QueueEntry.countDocuments({ hospitalId, status: 'WAITING', date: { $gte: today, $lt: tomorrow } }),
      QueueEntry.countDocuments({
        hospitalId,
        priority: 'HIGH',
        status: 'WAITING',
        date: { $gte: today, $lt: tomorrow },
      }),
      Appointment.countDocuments({
        ...appointmentFilter,
        status: 'COMPLETED',
        appointmentDate: { $gte: today, $lt: tomorrow },
      }),
      User.countDocuments({ hospitalId, role: { $ne: 'PATIENT' }, status: 'ACTIVE' }),
      Appointment.distinct('patientId', appointmentFilter),
      Appointment.countDocuments({
        ...appointmentFilter,
        status: 'NO_SHOW',
        appointmentDate: { $gte: today, $lt: tomorrow },
      }),
      QueueEntry.find({
        hospitalId,
        status: { $in: ['WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
        date: { $gte: today, $lt: tomorrow },
      }).select('estimatedWaitTime'),
    ]);

    const noShowRate = todayAppointments > 0
      ? Number(((noShowCount / todayAppointments) * 100).toFixed(1))
      : 0;
    const avgWait = queueEntries.length
      ? Math.round(queueEntries.reduce((sum, entry) => sum + entry.estimatedWaitTime, 0) / queueEntries.length)
      : 0;
    const totalPatients = await Patient.countDocuments({ _id: { $in: patientIds } });

    res.json({
      success: true,
      stats: {
        todayAppointments,
        waitingPatients,
        highPriority,
        completed,
        totalUsers,
        totalPatients,
        noShowRate,
        avgWait,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
};

export const getAppointmentTrends = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hospitalId = getHospitalId(req, res);
    if (!hospitalId) return;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trends = await Appointment.aggregate([
      {
        $match: {
          hospitalId: new mongoose.Types.ObjectId(hospitalId),
          appointmentDate: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$appointmentDate' } },
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
          highPriority: { $sum: { $cond: [{ $eq: ['$priority', 'HIGH'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, trends });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch trends' });
  }
};

export const getPriorityDistribution = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hospitalId = getHospitalId(req, res);
    if (!hospitalId) return;
    const distribution = await Appointment.aggregate([
      { $match: { hospitalId: new mongoose.Types.ObjectId(hospitalId) } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);
    res.json({ success: true, distribution });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch priority distribution' });
  }
};

export const getDepartmentPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hospitalId = getHospitalId(req, res);
    if (!hospitalId) return;
    const performance = await Appointment.aggregate([
      { $match: { hospitalId: new mongoose.Types.ObjectId(hospitalId) } },
      {
        $lookup: {
          from: 'departments',
          localField: 'departmentId',
          foreignField: '_id',
          as: 'department',
        },
      },
      { $unwind: '$department' },
      {
        $group: {
          _id: '$department.name',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
          noShow: { $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] } },
        },
      },
      {
        $addFields: {
          completionRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$completed', '$total'] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { total: -1 } },
    ]);
    res.json({ success: true, performance });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch department performance' });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hospitalId = getHospitalId(req, res);
    if (!hospitalId) return;

    const page = z.coerce.number().int().min(1).max(10000).default(1).safeParse(req.query.page);
    const limit = z.coerce.number().int().min(1).max(100).default(20).safeParse(req.query.limit);
    const role = req.query.role === undefined
      ? undefined
      : z.enum(['PATIENT', 'DOCTOR', 'STAFF', 'ADMIN', 'OWNER']).safeParse(req.query.role);
    if (!page.success || !limit.success || (role && !role.success)) {
      res.status(400).json({ success: false, message: 'Invalid user filters' });
      return;
    }

    const filter: Record<string, unknown> = { hospitalId };
    if (role?.success) filter.role = role.data as UserRole;
    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('-passwordHash -resetPasswordToken -resetPasswordExpires -failedLoginCount -lockedUntil -sessionVersion')
        .sort({ createdAt: -1 })
        .skip((page.data - 1) * limit.data)
        .limit(limit.data)
        .lean(),
    ]);
    res.json({ success: true, users, total });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};
