import { Router } from 'express';
import * as team from '../controllers/teamController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize('OWNER', 'ADMIN'), team.listTeam);
router.post('/', authenticate, authorize('OWNER', 'ADMIN'), team.inviteTeamMember);
router.post('/admins', authenticate, authorize('OWNER'), team.inviteAdmin);
router.patch('/:id', authenticate, authorize('OWNER', 'ADMIN'), team.updateTeamMember);
router.post('/:id/remove', authenticate, authorize('OWNER', 'ADMIN'), team.removeTeamMember);
router.post('/:id/reactivate', authenticate, authorize('OWNER', 'ADMIN'), team.reactivateTeamMember);

export default router;
