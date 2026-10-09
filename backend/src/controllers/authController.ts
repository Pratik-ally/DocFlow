import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { User, UserRole } from '../models/User';
import { Patient } from '../models/Patient';
import { Hospital } from '../models/Hospital';
import { Invite } from '../models/Invite';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import { recordAudit } from '../services/audit';
import {
  createFailedLoginUpdatePipeline,
  LOGIN_LOCKOUT_DURATION_MS,
} from '../validation/authSecurity';
import { z } from 'zod';

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(8).max(72)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

const registerInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  phone: z.string().trim().min(10).max(20),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value <= new Date().toISOString().slice(0, 10);
  }),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  password: passwordSchema,
});

const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
  rememberMe: z.boolean().optional(),
  hospitalId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

const forgotPasswordInputSchema = z.object({ email: emailSchema });

const resetPasswordInputSchema = z.object({
  token: z.string().regex(/^[a-f\d]{64}$/i),
  password: passwordSchema,
});

const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});

// ─── Shared cookie helpers ────────────────────────────────────────────────────

const PATIENT_COOKIE = 'token';
const STAFF_COOKIE = 'staff_token';

function patientCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax' as const,
    maxAge,
  };
}

function staffCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax' as const,
    maxAge,
  };
}

// ─── Register (PATIENT only) ─────────────────────────────────────────────────

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedInput = registerInputSchema.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ success: false, message: 'Invalid registration details' });
      return;
    }
    const { name, email, phone, dateOfBirth, gender, password } = parsedInput.data;

    const existingUser = await User.findOne({ email: email.toLowerCase(), role: 'PATIENT' });
    if (existingUser) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      role: 'PATIENT' as UserRole,
      status: 'ACTIVE',
    });

    await Patient.create({
      userId: user._id,
      dateOfBirth: new Date(dateOfBirth),
      gender: gender.toUpperCase(),
    });

    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name,
        sessionVersion: user.sessionVersion,
        portal: 'patient',
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn } as SignOptions
    );

    res.cookie(PATIENT_COOKIE, token, patientCookieOptions(7 * 24 * 60 * 60 * 1000));
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

// ─── Patient login (/api/auth/login) — patients only ─────────────────────────

export const login = async (req: Request, res: Response): Promise<void> => {
  const ip = req.ip ?? 'unknown';
  const genericError = { success: false, message: 'Invalid credentials' };
  try {
    const parsedInput = loginInputSchema.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(401).json(genericError);
      return;
    }
    const { email, password, rememberMe } = parsedInput.data;
    const normalizedEmail = email.toLowerCase();

    const user = await User.findOne({ email: normalizedEmail, role: 'PATIENT' });

    // Reject any non-PATIENT account with the same generic error
    if (!user || user.role !== 'PATIENT' || user.status !== 'ACTIVE') {
      res.status(401).json(genericError);
      return;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      res.status(401).json(genericError);
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const now = new Date();
      await User.updateOne(
        {
          _id: user._id,
          $or: [
            { lockedUntil: { $exists: false } },
            { lockedUntil: null },
            { lockedUntil: { $lte: now } },
          ],
        },
        createFailedLoginUpdatePipeline(new Date(now.getTime() + LOGIN_LOCKOUT_DURATION_MS))
      );
      res.status(401).json(genericError);
      return;
    }

    const expiresIn = rememberMe ? '30d' : '7d';
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name,
        sessionVersion: user.sessionVersion,
        portal: 'patient',
      },
      config.jwtSecret,
      { expiresIn } as SignOptions
    );

    user.failedLoginCount = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    await recordAudit({
      actorId: user._id.toString(),
      action: 'LOGIN',
      hospitalId: user.hospitalId?.toString(),
      ipAddress: ip,
    });

    res.cookie(PATIENT_COOKIE, token, patientCookieOptions(maxAge));
    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// ─── Staff login (/api/auth/staff-login) — OWNER/ADMIN/DOCTOR/STAFF ──────────

const STAFF_SESSION_MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours

export const staffLogin = async (req: Request, res: Response): Promise<void> => {
  const ip = req.ip ?? 'unknown';
  const GENERIC_ERROR = 'Invalid credentials';
  try {
    const parsedInput = loginInputSchema.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ success: false, message: GENERIC_ERROR });
      return;
    }
    const { email, password } = parsedInput.data;
    const normalizedEmail = email.toLowerCase();

    const candidates = await User.find({
      email: normalizedEmail,
      role: { $in: ['OWNER', 'ADMIN', 'DOCTOR', 'STAFF'] },
      ...(parsedInput.data.hospitalId ? { hospitalId: parsedInput.data.hospitalId } : {}),
    }).limit(2);
    const user = candidates.length === 1 ? candidates[0] : null;

    if (!user) {
      res.status(401).json({ success: false, message: GENERIC_ERROR });
      return;
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await recordAudit({
        hospitalId: user.hospitalId?.toString(),
        actorId: user._id.toString(),
        action: 'LOGIN_LOCKED',
        ipAddress: ip,
      });
      res.status(401).json({ success: false, message: GENERIC_ERROR });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(401).json({ success: false, message: GENERIC_ERROR });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const now = new Date();
      await User.updateOne(
        {
          _id: user._id,
          $or: [
            { lockedUntil: { $exists: false } },
            { lockedUntil: null },
            { lockedUntil: { $lte: now } },
          ],
        },
        createFailedLoginUpdatePipeline(new Date(now.getTime() + LOGIN_LOCKOUT_DURATION_MS))
      );
      await recordAudit({
        hospitalId: user.hospitalId?.toString(),
        actorId: user._id.toString(),
        action: 'LOGIN_FAILURE',
        ipAddress: ip,
      });
      res.status(401).json({ success: false, message: GENERIC_ERROR });
      return;
    }

    // Reset counter on success
    user.failedLoginCount = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name,
        hospitalId: user.hospitalId?.toString(),
        portal: 'staff',
        sessionVersion: user.sessionVersion,
      },
      config.jwtSecret,
      { expiresIn: '8h' } as SignOptions
    );

    await recordAudit({
      hospitalId: user.hospitalId?.toString(),
      actorId: user._id.toString(),
      action: 'LOGIN',
      ipAddress: ip,
    });

    res.cookie(STAFF_COOKIE, token, staffCookieOptions(STAFF_SESSION_MAX_AGE));
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        mustChangePassword: user.mustChangePassword ?? false,
      },
    });
  } catch (error) {
    console.error('Staff login error:', error);
    res.status(500).json({ success: false, message: GENERIC_ERROR });
  }
};

export const staffLogout = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'PATIENT') {
    await recordAudit({
      hospitalId: req.user?.hospitalId,
      actorId: req.user?.id,
      action: 'LOGOUT',
      ipAddress: req.ip,
    });
  }
  res.clearCookie(STAFF_COOKIE, { ...staffCookieOptions(0), path: '/' });
  res.json({ success: true });
};

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = req.ip ?? 'unknown';
  if (req.user) {
    await recordAudit({
      hospitalId: (req.user as { hospitalId?: string }).hospitalId,
      actorId: req.user.id,
      action: 'LOGOUT',
      ipAddress: ip,
    });
  }
  res.clearCookie(PATIENT_COOKIE, { httpOnly: true, sameSite: 'lax' });
  res.clearCookie(STAFF_COOKIE, { httpOnly: true, sameSite: 'lax' });
  res.json({ success: true, message: 'Logged out successfully' });
};

// ─── Get me ───────────────────────────────────────────────────────────────────

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id).select(
      '-passwordHash -resetPasswordToken -resetPasswordExpires -failedLoginCount -lockedUntil -sessionVersion'
    );
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    // Live status check
    if (user.role !== 'PATIENT' && user.status === 'REMOVED') {
      res.status(401).json({ success: false, message: 'Account removed' });
      return;
    }
    res.json({ success: true, user });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

// ─── Change password (first-login or voluntary) ───────────────────────────────

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = changePasswordInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid password details' });
      return;
    }
    const { currentPassword, newPassword } = parsed.data;
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' });
      return;
    }
    user.passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
    user.mustChangePassword = false;
    user.sessionVersion += 1;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update password' });
  }
};

// ─── Get hospital info (public, for login pages) ──────────────────────────────

// ─── Forgot / reset password ──────────────────────────────────────────────────

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedInput = forgotPasswordInputSchema.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ success: false, message: 'Invalid email address' });
      return;
    }
    const { email } = parsedInput.data;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      res.json({ success: true, message: 'If this email exists, a reset link has been sent' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    res.json({
      success: true,
      message: 'If this email exists, a reset link has been sent',
      ...(config.nodeEnv === 'development' && { resetToken }),
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedInput = resetPasswordInputSchema.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ success: false, message: 'Invalid password reset details' });
      return;
    }
    const { token, password } = parsedInput.data;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      return;
    }

    user.passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    user.sessionVersion += 1;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};
