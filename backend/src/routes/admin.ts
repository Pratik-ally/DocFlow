import { Router } from 'express';
import * as admin from '../controllers/adminController';
import { authenticate, authorize } from '../middleware/auth';
import * as team from '../controllers/teamController';

const router = Router();

// Analytics
router.get('/stats', authenticate, authorize('ADMIN', 'OWNER', 'STAFF'), admin.getDashboardStats);
router.get('/trends', authenticate, authorize('ADMIN', 'OWNER'), admin.getAppointmentTrends);
router.get('/priority-distribution', authenticate, authorize('ADMIN', 'OWNER', 'STAFF'), admin.getPriorityDistribution);
router.get('/department-performance', authenticate, authorize('ADMIN', 'OWNER'), admin.getDepartmentPerformance);
router.get('/users', authenticate, authorize('ADMIN', 'OWNER'), admin.getAllUsers);

// Team management
router.get('/team', authenticate, authorize('ADMIN', 'OWNER'), team.listTeam);
router.post('/team', authenticate, authorize('ADMIN', 'OWNER'), team.inviteTeamMember);
router.post('/team/admins', authenticate, authorize('OWNER'), team.inviteAdmin);
router.patch('/team/:id', authenticate, authorize('ADMIN', 'OWNER'), team.updateTeamMember);
router.delete('/team/:id', authenticate, authorize('ADMIN', 'OWNER'), team.removeTeamMember);
router.post('/team/:id/reactivate', authenticate, authorize('ADMIN', 'OWNER'), team.reactivateTeamMember);

// Audit log (OWNER sees all, ADMIN sees hospital's)
router.get('/audit-log', authenticate, authorize('ADMIN', 'OWNER'), team.getAuditLogs);

export default router;
