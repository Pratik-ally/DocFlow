import { Router } from 'express';
import * as auth from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public
router.post('/register', auth.register);
router.post('/login', auth.login);           // patient portal only
router.post('/staff-login', auth.staffLogin); // Backwards-compatible alias
router.post('/logout', authenticate, auth.logout);
router.get('/me', authenticate, auth.getMe);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);
router.post('/change-password', authenticate, auth.changePassword);

export default router;
