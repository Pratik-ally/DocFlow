import { Router } from 'express';
import { acceptInvite } from '../controllers/teamController';

const router = Router();

router.post('/accept', acceptInvite);

export default router;
