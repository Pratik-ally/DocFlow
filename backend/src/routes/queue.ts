import { Router } from 'express';
import * as queue from '../controllers/queueController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/sse', authenticate, queue.queueSSE);
router.get('/my', authenticate, authorize('PATIENT'), queue.getMyQueuePosition);
router.get('/', authenticate, authorize('STAFF', 'DOCTOR', 'ADMIN'), queue.getQueue);
router.patch('/:id', authenticate, authorize('STAFF', 'DOCTOR', 'ADMIN'), queue.updateQueueEntry);

export default router;
