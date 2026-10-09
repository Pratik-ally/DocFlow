import { Router } from 'express';
import * as auth from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/logout', auth.logout);
router.get('/me', authenticate, auth.getMe);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);

export default router;
