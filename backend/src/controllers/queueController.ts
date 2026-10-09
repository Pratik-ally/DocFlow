import { Response } from 'express';
import { QueueEntry } from '../models/QueueEntry';
import { Notification } from '../models/Notification';
import { Patient } from '../models/Patient';
import { Doctor } from '../models/Doctor';
import { AuthRequest } from '../middleware/auth';

// SSE clients are isolated by hospital.
const sseClients: Map<string, Set<Response>> = new Map();

export const getQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { doctorId, departmentId, date } = req.query;
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    const filter: Record<string, unknown> = {
      hospitalId,
      status: { $in: ['WAITING', 'IN_CONSULTATION'] },
    };

    if (req.user?.role === 'DOCTOR') {
      const doctor = await Doctor.findOne({ userId: req.user.id, hospitalId }).select('_id');
      if (!doctor) {
        res.status(404).json({ success: false, message: 'Doctor profile not found' });
        return;
      }
      filter.doctorId = doctor._id;
    } else if (doctorId) filter.doctorId = doctorId;
    if (departmentId) filter.departmentId = departmentId;

    if (date) {
      const start = new Date(date as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: start, $lt: end };
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      filter.date = { $gte: today, $lt: tomorrow };
    }

    // Sort by priority (HIGH first) then position.
    // Cannot use a simple string sort because HIGH < ROUTINE < SOON lexicographically.
    // Use an aggregation $addFields to assign numeric weight before sorting.
    const rawQueue = await QueueEntry.find(filter)
      .populate({
        path: 'patientId',
        populate: { path: 'userId', select: 'name phone' },
      })
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } })
      .populate('departmentId', 'name')
      .populate('appointmentId', 'appointmentId appointmentTime reason priority')
      .sort({ queuePosition: 1 })
      .lean();

    const priorityWeight: Record<string, number> = { HIGH: 0, SOON: 1, ROUTINE: 2 };
    const queue = rawQueue.sort(
      (a, b) =>
        (priorityWeight[a.priority] ?? 2) - (priorityWeight[b.priority] ?? 2) ||
        a.queuePosition - b.queuePosition
    );

    res.json({ success: true, queue });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch queue' });
  }
};

export const getMyQueuePosition = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patient = await Patient.findOne({ userId: req.user?.id });
    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient profile not found' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const entry = await QueueEntry.findOne({
      patientId: patient._id,
      status: { $in: ['WAITING', 'IN_CONSULTATION'] },
      date: { $gte: today, $lt: tomorrow },
    })
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } })
      .populate('departmentId', 'name')
      .populate('appointmentId', 'appointmentId appointmentTime reason');

    if (!entry) {
      res.json({ success: true, entry: null });
      return;
    }

    // Count patients ahead
    const patientsAhead = await QueueEntry.countDocuments({
      doctorId: entry.doctorId,
      hospitalId: entry.hospitalId,
      date: { $gte: today, $lt: tomorrow },
      queuePosition: { $lt: entry.queuePosition },
      status: { $in: ['WAITING', 'IN_CONSULTATION'] },
    });

    res.json({ success: true, entry, patientsAhead });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch queue position' });
  }
};

export const updateQueueEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, queuePosition } = req.body;
    const validStatuses = ['WAITING', 'IN_CONSULTATION', 'COMPLETED', 'SKIPPED'];
    if (
      (status !== undefined && !validStatuses.includes(status)) ||
      (queuePosition !== undefined && (!Number.isInteger(queuePosition) || queuePosition < 1))
    ) {
      res.status(400).json({ success: false, message: 'Invalid queue update' });
      return;
    }

    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    const currentEntry = await QueueEntry.findOne({ _id: req.params.id, hospitalId }).select('doctorId');
    if (!currentEntry) {
      res.status(404).json({ success: false, message: 'Queue entry not found' });
      return;
    }
    if (req.user?.role === 'DOCTOR') {
      const doctor = await Doctor.findOne({ userId: req.user.id, hospitalId }).select('_id');
      if (!doctor || currentEntry.doctorId.toString() !== doctor._id.toString()) {
        res.status(403).json({ success: false, message: 'Not authorised to update this queue entry' });
        return;
      }
    }

    const entry = await QueueEntry.findOneAndUpdate(
      { _id: req.params.id, hospitalId },
      {
        ...(status && { status }),
        ...(queuePosition !== undefined && { queuePosition }),
        ...(status === 'IN_CONSULTATION' && { consultationStartedAt: new Date() }),
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
      },
      { new: true, runValidators: true }
    ).populate({
      path: 'patientId',
      populate: { path: 'userId', select: 'name' },
    });

    if (!entry) {
      res.status(404).json({ success: false, message: 'Queue entry not found' });
      return;
    }

    // Broadcast SSE update
    broadcastQueueUpdate(hospitalId);

    res.json({ success: true, entry });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update queue entry' });
  }
};

export const queueSSE = (req: AuthRequest, res: Response): void => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const channel = req.user?.hospitalId ?? req.user?.id ?? 'anonymous';

  if (!sseClients.has(channel)) {
    sseClients.set(channel, new Set());
  }
  sseClients.get(channel)!.add(res);

  // Heartbeat
  const heartbeat = setInterval(() => {
    res.write('data: {"type":"heartbeat"}\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.get(channel)?.delete(res);
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', channel })}\n\n`);
};

function broadcastQueueUpdate(channel: string): void {
  const clients = sseClients.get(channel);
  if (clients) {
    const message = JSON.stringify({ type: 'queue_update', timestamp: new Date().toISOString() });
    clients.forEach((client) => {
      client.write(`data: ${message}\n\n`);
    });
  }
}
