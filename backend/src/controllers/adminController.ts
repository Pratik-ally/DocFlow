import { Response } from 'express';
import { Appointment } from '../models/Appointment';
import { QueueEntry } from '../models/QueueEntry';
import { User } from '../models/User';
import { Patient } from '../models/Patient';
import { Doctor } from '../models/Doctor';
import { AuthRequest } from '../middleware/auth';

export const getDashboardStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todayAppointments,
      waitingPatients,
      highPriority,
      completed,
      totalUsers,
      totalPatients,
    ] = await Promise.all([
      Appointment.countDocuments({ appointmentDate: { $gte: today, $lt: tomorrow } }),
      QueueEntry.countDocuments({ status: 'WAITING', date: { $gte: today, $lt: tomorrow } }),
      QueueEntry.countDocuments({ priority: 'HIGH', status: 'WAITING', date: { $gte: today, $lt: tomorrow } }),
      Appointment.countDocuments({ status: 'COMPLETED', appointmentDate: { $gte: today, $lt: tomorrow } }),
      User.countDocuments({ isActive: true }),
      Patient.countDocuments(),
    ]);

    const noShowCount = await Appointment.countDocuments({
      status: 'NO_SHOW',
      appointmentDate: { $gte: today, $lt: tomorrow },
    });

    const noShowRate = todayAppointments > 0
      ? parseFloat(((noShowCount / todayAppointments) * 100).toFixed(1))
      : 0;

    // Average wait time
    const queueEntries = await QueueEntry.find({
      status: { $in: ['WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
      date: { $gte: today, $lt: tomorrow },
    });
    const avgWait = queueEntries.length > 0
      ? Math.round(queueEntries.reduce((sum, e) => sum + e.estimatedWaitTime, 0) / queueEntries.length)
      : 0;

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

export const getAppointmentTrends = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trends = await Appointment.aggregate([
      { $match: { appointmentDate: { $gte: thirtyDaysAgo } } },
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

export const getPriorityDistribution = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const distribution = await Appointment.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({ success: true, distribution });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch priority distribution' });
  }
};

export const getDepartmentPerformance = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const performance = await Appointment.aggregate([
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
    const { role, page = 1, limit = 20 } = req.query;
    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    res.json({ success: true, users, total });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};
