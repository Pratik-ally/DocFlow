import { Response } from 'express';
import { Hospital } from '../models/Hospital';
import { Department } from '../models/Department';
import { Doctor } from '../models/Doctor';
import { AuthRequest } from '../middleware/auth';

export const getHospitals = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hospitals = await Hospital.find({ isActive: true }).populate('departments');
    res.json({ success: true, hospitals });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch hospitals' });
  }
};

export const getDepartments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { hospitalId } = req.query;
    const filter: Record<string, unknown> = { isActive: true };
    if (hospitalId) filter.hospitalId = hospitalId;

    const departments = await Department.find(filter).populate('hospitalId', 'name');
    res.json({ success: true, departments });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch departments' });
  }
};

export const getDoctors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { departmentId, hospitalId } = req.query;
    const filter: Record<string, unknown> = { isAvailable: true };
    if (departmentId) filter.departmentId = departmentId;
    if (hospitalId) filter.hospitalId = hospitalId;

    const doctors = await Doctor.find(filter)
      .populate('userId', 'name email phone')
      .populate('departmentId', 'name')
      .populate('hospitalId', 'name');

    res.json({ success: true, doctors });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch doctors' });
  }
};

export const getDoctorById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('departmentId', 'name')
      .populate('hospitalId', 'name address');

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }
    res.json({ success: true, doctor });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch doctor' });
  }
};

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { Notification } = await import('../models/Notification');
    const notifications = await Notification.find({ userId: req.user?.id })
      .sort({ createdAt: -1 })
      .limit(20);

    const unreadCount = await Notification.countDocuments({ userId: req.user?.id, read: false });

    res.json({ success: true, notifications, unreadCount });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { Notification } = await import('../models/Notification');
    await Notification.updateMany(
      { userId: req.user?.id, ...(req.params.id !== 'all' && { _id: req.params.id }) },
      { read: true }
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to mark notification' });
  }
};
