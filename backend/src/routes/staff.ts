import { Router } from 'express';
import * as auth from '../controllers/authController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/login', auth.staffLogin);
router.post('/logout', authenticate, authorize('OWNER', 'ADMIN', 'DOCTOR', 'STAFF'), auth.staffLogout);

export default router;
