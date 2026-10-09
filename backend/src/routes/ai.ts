import { Router } from 'express';
import * as ai from '../controllers/aiController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/priority-assessment', authenticate, ai.assessPatientPriority);
// Only STAFF and ADMIN may review/override an AI assessment
router.patch('/priority-assessment/:id/review', authenticate, authorize('OWNER', 'STAFF', 'ADMIN'), ai.reviewAssessment);

export default router;
