import { Router } from 'express';
import * as hospital from '../controllers/hospitalController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/hospitals', hospital.getHospitals);
router.get('/departments', hospital.getDepartments);
router.get('/doctors', hospital.getDoctors);
router.get('/doctors/:id', hospital.getDoctorById);
router.get('/notifications', authenticate, hospital.getNotifications);
router.patch('/notifications/:id/read', authenticate, hospital.markNotificationRead);

export default router;
