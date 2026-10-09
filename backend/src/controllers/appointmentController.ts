import { Response } from 'express';
import { Appointment } from '../models/Appointment';
import { Patient } from '../models/Patient';
import { Doctor } from '../models/Doctor';
import { QueueEntry } from '../models/QueueEntry';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';
import { z } from 'zod';
import { assessPriority } from '../ai/priorityEngine';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
});

const appointmentStatusSchema = z.enum([
  'BOOKED',
  'CONFIRMED',
  'CHECKED_IN',
  'WAITING',
  'IN_CONSULTATION',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);

function parsePositiveInteger(value: unknown, fallback: number, maximum: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const parsedValue = Number(value);
  return Number.isSafeInteger(parsedValue) && parsedValue > 0 && parsedValue <= maximum
    ? parsedValue
    : null;
}

const appointmentInputSchema = z.object({
  doctorId: z.string().regex(/^[a-f\d]{24}$/i),
  departmentId: z.string().regex(/^[a-f\d]{24}$/i),
  hospitalId: z.string().regex(/^[a-f\d]{24}$/i),
  appointmentDate: dateOnlySchema.refine((value) => value >= new Date().toISOString().slice(0, 10)),
  appointmentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reason: z.string().trim().min(5).max(1000),
  symptoms: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  urgencyLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

export const getMyAppointments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patient = await Patient.findOne({ userId: req.user?.id });
    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient profile not found' });
      return;
    }

    const { status } = req.query;
    const page = parsePositiveInteger(req.query.page, 1, 10000);
    const limit = parsePositiveInteger(req.query.limit, 10, 100);
    const parsedStatus = status === undefined ? undefined : appointmentStatusSchema.safeParse(status);
    if (page === null || limit === null || (parsedStatus && !parsedStatus.success)) {
      res.status(400).json({ success: false, message: 'Invalid appointment query' });
      return;
    }

    const filter: Record<string, unknown> = { patientId: patient._id };
    if (parsedStatus?.success) filter.status = parsedStatus.data;

    const total = await Appointment.countDocuments(filter);
    const appointments = await Appointment.find(filter)
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } })
      .populate('departmentId', 'name')
      .populate('hospitalId', 'name')
      .sort({ appointmentDate: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    res.json({ success: true, appointments, total, page: +page, limit: +limit });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
  }
};

export const createAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patient = await Patient.findOne({ userId: req.user?.id });
    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient profile not found' });
      return;
    }

    const parsedInput = appointmentInputSchema.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ success: false, message: 'Invalid appointment details' });
      return;
    }

    const {
      doctorId,
      departmentId,
      hospitalId,
      appointmentDate,
      appointmentTime,
      reason,
      symptoms,
      urgencyLevel,
    } = parsedInput.data;
    const doctor = await Doctor.findOne({
      _id: doctorId,
      departmentId,
      hospitalId,
      isAvailable: true,
    }).select('_id');
    if (!doctor) {
      res.status(400).json({ success: false, message: 'Selected doctor is unavailable for this department or hospital' });
      return;
    }

    const appointmentDay = new Date(`${appointmentDate}T00:00:00.000Z`);
    const assessment = assessPriority({
      reason,
      symptoms: symptoms || [],
      urgencyLevel,
    });

    // Prevent double-booking: same doctor, same date, same time slot
    const existing = await Appointment.findOne({
      doctorId,
      appointmentDate: appointmentDay,
      appointmentTime,
      status: { $nin: ['CANCELLED', 'NO_SHOW'] },
    });
    if (existing) {
      res.status(409).json({ success: false, message: 'This time slot is already booked. Please select a different time.' });
      return;
    }

    const appointmentId = `APT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const appointment = await Appointment.create({
      appointmentId,
      patientId: patient._id,
      doctorId,
      departmentId,
      hospitalId,
      appointmentDate: appointmentDay,
      appointmentTime,
      reason,
      symptoms: symptoms || [],
      priority: assessment.priority,
      status: 'BOOKED',
    });

    // Create notification
    await Notification.create({
      userId: req.user?.id,
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Appointment Booked',
      message: `Your appointment has been booked for ${appointmentDay.toDateString()} at ${appointmentTime}.`,
    });

    const populated = await Appointment.findById(appointment._id)
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } })
      .populate('departmentId', 'name')
      .populate('hospitalId', 'name');

    res.status(201).json({ success: true, appointment: populated });
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
      res.status(409).json({ success: false, message: 'This time slot is already booked. Please select a different time.' });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to create appointment' });
  }
};

export const getAppointmentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } })
      .populate('departmentId', 'name')
      .populate('hospitalId', 'name')
      .populate('patientId');

    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    if (req.user?.role === 'PATIENT') {
      const patient = await Patient.findOne({ userId: req.user.id }).select('_id');
      if (!patient || appointment.patientId.toString() !== patient._id.toString()) {
        res.status(403).json({ success: false, message: 'Not authorised to view this appointment' });
        return;
      }
    } else if (req.user?.role === 'DOCTOR') {
      const doctor = await Doctor.findOne({ userId: req.user.id }).select('_id');
      if (!doctor || appointment.doctorId.toString() !== doctor._id.toString()) {
        res.status(403).json({ success: false, message: 'Not authorised to view this appointment' });
        return;
      }
    }

    res.json({ success: true, appointment });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch appointment' });
  }
};

export const updateAppointmentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, notes } = req.body;

    // Validate status value
    const validStatuses = ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status value' });
      return;
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    // Patients may only cancel their own appointment
    if (req.user?.role === 'PATIENT') {
      const patient = await Patient.findOne({ userId: req.user.id });
      if (!patient || appointment.patientId.toString() !== patient._id.toString()) {
        res.status(403).json({ success: false, message: 'Not authorised to update this appointment' });
        return;
      }
      if (status !== 'CANCELLED') {
        res.status(403).json({ success: false, message: 'Patients may only cancel appointments' });
        return;
      }
    }
    if (req.user?.role === 'DOCTOR') {
      const doctor = await Doctor.findOne({ userId: req.user.id }).select('_id');
      if (!doctor || appointment.doctorId.toString() !== doctor._id.toString()) {
        res.status(403).json({ success: false, message: 'Not authorised to update this appointment' });
        return;
      }
    }

    await Appointment.findByIdAndUpdate(
      req.params.id,
      { status, ...(notes && { notes }) },
      { new: true }
    );

    // Create queue entry if checking in
    if (status === 'CHECKED_IN') {
      const existingEntry = await QueueEntry.findOne({ appointmentId: appointment._id });
      if (!existingEntry) {
        const count = await QueueEntry.countDocuments({
          doctorId: appointment.doctorId,
          date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          status: { $in: ['WAITING', 'IN_CONSULTATION'] },
        });
        await QueueEntry.create({
          appointmentId: appointment._id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          departmentId: appointment.departmentId,
          priority: appointment.priority,
          queuePosition: count + 1,
          estimatedWaitTime: (count + 1) * 15,
          status: 'WAITING',
          checkedInAt: new Date(),
          date: new Date(),
        });
      }
    }

    res.json({ success: true, appointment });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update appointment' });
  }
};

export const getAllAppointments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, fromDate, status, doctorId, departmentId } = req.query;
    const page = parsePositiveInteger(req.query.page, 1, 10000);
    const limit = parsePositiveInteger(req.query.limit, 20, 100);
    const dateResult = date === undefined ? undefined : dateOnlySchema.safeParse(date);
    const fromDateResult = fromDate === undefined ? undefined : dateOnlySchema.safeParse(fromDate);
    const statusResult = status === undefined ? undefined : appointmentStatusSchema.safeParse(status);
    const objectIdQueryIsValid = [doctorId, departmentId].every(
      (value) => value === undefined || (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value))
    );
    if (
      page === null ||
      limit === null ||
      (dateResult && !dateResult.success) ||
      (fromDateResult && !fromDateResult.success) ||
      (statusResult && !statusResult.success) ||
      !objectIdQueryIsValid ||
      (date !== undefined && fromDate !== undefined)
    ) {
      res.status(400).json({ success: false, message: 'Invalid appointment query' });
      return;
    }

    const filter: Record<string, unknown> = {};

    if (req.user?.role === 'DOCTOR') {
      const doctor = await Doctor.findOne({ userId: req.user.id }).select('_id');
      if (!doctor) {
        res.status(404).json({ success: false, message: 'Doctor profile not found' });
        return;
      }
      filter.doctorId = doctor._id;
    } else if (doctorId) {
      filter.doctorId = doctorId;
    }

    if (dateResult?.success) {
      const start = new Date(`${dateResult.data}T00:00:00.000Z`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filter.appointmentDate = { $gte: start, $lt: end };
    } else if (fromDateResult?.success) {
      const start = new Date(`${fromDateResult.data}T00:00:00.000Z`);
      filter.appointmentDate = { $gte: start };
    }
    if (statusResult?.success) filter.status = statusResult.data;
    if (departmentId) filter.departmentId = departmentId;

    const total = await Appointment.countDocuments(filter);
    const appointments = await Appointment.find(filter)
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } })
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'name email phone' } })
      .populate('departmentId', 'name')
      .populate('hospitalId', 'name')
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, appointments, total, page, limit });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
  }
};
