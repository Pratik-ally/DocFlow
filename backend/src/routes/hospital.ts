import { Router } from 'express';
import * as hospital from '../controllers/hospitalController';
import { authenticate } from '../middleware/auth';
import rateLimit from 'express-rate-limit';
import * as hospitalRegistration from '../controllers/hospitalRegistrationController';

const router = Router();

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Unable to complete registration' },
});
const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Unable to verify email' },
});
const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Unable to complete registration' },
});

router.post('/hospitals/register', registrationLimiter, hospitalRegistration.registerHospital);
router.post('/hospitals/verify-email', verificationLimiter, hospitalRegistration.verifyHospitalEmail);
router.post('/hospitals/resend-code', resendLimiter, hospitalRegistration.resendHospitalVerificationCode);
router.get('/hospital', hospital.getHospitalPublic);
router.get('/hospital/manage', authenticate, ...hospital.getHospitalSettings);
router.patch('/hospital', authenticate, ...hospital.updateHospital);
router.post('/departments', authenticate, ...hospital.createDepartment);
router.get('/hospitals', hospital.getHospitals);
router.get('/departments', hospital.getDepartments);
router.get('/doctors', hospital.getDoctors);
router.get('/doctors/:id', hospital.getDoctorById);
router.get('/notifications', authenticate, hospital.getNotifications);
router.patch('/notifications/:id/read', authenticate, hospital.markNotificationRead);

export default router;
