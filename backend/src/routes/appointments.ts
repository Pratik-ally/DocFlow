import { Router } from 'express';
import * as appt from '../controllers/appointmentController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Patient routes
router.get('/my', authenticate, authorize('PATIENT'), appt.getMyAppointments);
router.post('/', authenticate, authorize('PATIENT'), appt.createAppointment);

// Staff / Doctor / Admin routes
router.get('/', authenticate, authorize('OWNER', 'STAFF', 'DOCTOR', 'ADMIN'), appt.getAllAppointments);
router.get('/:id', authenticate, appt.getAppointmentById);
router.patch('/:id/status', authenticate, authorize('PATIENT', 'OWNER', 'STAFF', 'DOCTOR', 'ADMIN'), appt.updateAppointmentStatus);

export default router;
