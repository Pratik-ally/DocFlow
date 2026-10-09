import { Router } from 'express';
import * as admin from '../controllers/adminController';
import * as hospital from '../controllers/hospitalController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticate, authorize('ADMIN', 'STAFF'), admin.getDashboardStats);
router.get('/trends', authenticate, authorize('ADMIN'), admin.getAppointmentTrends);
router.get('/priority-distribution', authenticate, authorize('ADMIN', 'STAFF'), admin.getPriorityDistribution);
router.get('/department-performance', authenticate, authorize('ADMIN'), admin.getDepartmentPerformance);
router.get('/users', authenticate, authorize('ADMIN'), admin.getAllUsers);

export default router;
