import { Request, Response } from 'express';
import { Hospital } from '../models/Hospital';
import { Department } from '../models/Department';
import { Doctor } from '../models/Doctor';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { authorize } from '../middleware/auth';
import { z } from 'zod';
import { recordAudit } from '../services/audit';

const MAX_LOGO_BYTES = 512 * 1024;
const logoDataUrlSchema = z.string()
  .max(700_000)
  .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  .refine((value) => {
    const encodedImage = value.slice(value.indexOf(',') + 1);
    if (Buffer.byteLength(encodedImage, 'base64') > MAX_LOGO_BYTES) return false;
    const image = Buffer.from(encodedImage, 'base64');
    if (image.toString('base64') !== encodedImage) return false;
    if (value.startsWith('data:image/png;')) {
      return image.length >= 24 && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    if (value.startsWith('data:image/jpeg;')) {
      return image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
    }
    return image.length >= 12 &&
      image.toString('ascii', 0, 4) === 'RIFF' &&
      image.toString('ascii', 8, 12) === 'WEBP';
  });

const hospitalUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  location: z.object({
    addressLine1: z.string().trim().min(1).max(160),
    addressLine2: z.string().trim().max(160).optional().default(''),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    country: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(1).max(24),
  }),
  logoUrl: z.union([logoDataUrlSchema, z.literal(''), z.null()]).optional(),
});

const departmentCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().default(''),
});

export const getHospitalPublic = async (_req: Request, res: Response): Promise<void> => {
  try {
    const hospital = await Hospital.findOne({
      isActive: true,
      $or: [{ status: 'ACTIVE' }, { status: { $exists: false } }],
    }).select('_id name logoUrl').lean();
    res.json({ success: true, hospital: hospital ?? null });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch hospital information' });
  }
};

export const getHospitalSettings = [
  authorize('OWNER'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user?.hospitalId) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    try {
      const hospital = await Hospital.findOne({
        _id: req.user.hospitalId,
        $or: [{ status: 'ACTIVE' }, { status: { $exists: false } }],
      }).select('_id name location address logoUrl').lean();
      if (!hospital) {
        res.status(404).json({ success: false, message: 'Hospital not found' });
        return;
      }
      const departments = await Department.find({
        hospitalId: req.user.hospitalId,
        isActive: true,
      }).select('_id name description isActive').sort({ name: 1 }).lean();
      res.json({
        success: true,
        hospital: {
          ...hospital,
          location: hospital.location ?? {
            addressLine1: hospital.address?.street ?? '',
            addressLine2: '',
            city: hospital.address?.city ?? '',
            state: hospital.address?.state ?? '',
            country: hospital.address?.country ?? '',
            postalCode: hospital.address?.pincode ?? '',
          },
        },
        departments,
      });
    } catch {
      res.status(500).json({ success: false, message: 'Unable to load hospital settings' });
    }
  },
];

export const getHospitals = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hospitals = await Hospital.find({
      isActive: true,
      $or: [{ status: 'ACTIVE' }, { status: { $exists: false } }],
    }).select('_id name logoUrl departments').populate('departments');
    res.json({ success: true, hospitals });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch hospitals' });
  }
};

export const updateHospital = [
  authorize('OWNER'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = hospitalUpdateSchema.safeParse(req.body);
    if (!parsed.success || !req.user?.hospitalId) {
      res.status(400).json({ success: false, message: 'Invalid hospital details' });
      return;
    }
    try {
      const hospital = await Hospital.findOneAndUpdate(
        {
          _id: req.user.hospitalId,
          $or: [{ status: 'ACTIVE' }, { status: { $exists: false } }],
        },
        {
          $set: {
            name: parsed.data.name,
            location: parsed.data.location,
            ...(parsed.data.logoUrl && parsed.data.logoUrl.length > 0
              ? { logoUrl: parsed.data.logoUrl }
              : {}),
          },
          ...(parsed.data.logoUrl === '' || parsed.data.logoUrl === null
            ? { $unset: { logoUrl: 1 } }
            : {}),
        },
        { new: true, runValidators: true }
      ).select('_id name location logoUrl');
      if (!hospital) {
        res.status(404).json({ success: false, message: 'Hospital not found' });
        return;
      }
      await recordAudit({
        hospitalId: req.user.hospitalId,
        actorId: req.user.id,
        targetId: req.user.hospitalId,
        action: parsed.data.logoUrl !== undefined ? 'HOSPITAL_SETTINGS_UPDATED' : 'HOSPITAL_DETAILS_UPDATED',
        ipAddress: req.ip,
      });
      res.json({ success: true, hospital });
    } catch (error) {
      console.error('Hospital update failed:', error instanceof Error ? error.name : 'Unknown error');
      res.status(500).json({ success: false, message: 'Unable to update hospital details' });
    }
  },
];

export const createDepartment = [
  authorize('OWNER'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = departmentCreateSchema.safeParse(req.body);
    const hospitalId = req.user?.hospitalId;
    const actorId = req.user?.id;
    if (!parsed.success || !hospitalId || !actorId) {
      res.status(400).json({ success: false, message: 'Invalid department details' });
      return;
    }

    try {
      const hospital = await Hospital.findOne({
        _id: hospitalId,
        $or: [{ status: 'ACTIVE' }, { status: { $exists: false } }],
      }).select('_id');
      if (!hospital) {
        res.status(404).json({ success: false, message: 'Hospital not found' });
        return;
      }

      const escapedName = parsed.data.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = await Department.findOne({
        hospitalId,
        name: { $regex: `^${escapedName}$`, $options: 'i' },
      }).select('_id');
      if (existing) {
        res.status(409).json({ success: false, message: 'A department with that name already exists' });
        return;
      }

      const [department] = await Department.create([{
        hospitalId,
        name: parsed.data.name,
        description: parsed.data.description,
      }]);
      try {
        await Hospital.updateOne(
          { _id: hospitalId },
          { $addToSet: { departments: department._id } }
        );
      } catch (error) {
        await Department.deleteOne({ _id: department._id, hospitalId });
        throw error;
      }

      await recordAudit({
        hospitalId,
        actorId,
        targetId: department._id.toString(),
        action: 'DEPARTMENT_CREATED',
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, department });
    } catch (error) {
      console.error('Department creation failed:', error instanceof Error ? error.name : 'Unknown error');
      res.status(500).json({ success: false, message: 'Unable to create department' });
    }
  },
];

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
    const activeDoctorUsers = await User.find({
      role: 'DOCTOR',
      status: 'ACTIVE',
      ...(hospitalId ? { hospitalId } : {}),
    }).select('_id').lean();
    const filter: Record<string, unknown> = { isAvailable: true };
    filter.userId = { $in: activeDoctorUsers.map((user) => user._id) };
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
    const activeUser = await User.exists({
      _id: doctor.userId,
      hospitalId: doctor.hospitalId,
      role: 'DOCTOR',
      status: 'ACTIVE',
    });
    if (!activeUser) {
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
