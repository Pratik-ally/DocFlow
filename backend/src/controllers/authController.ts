import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User';
import { Patient } from '../models/Patient';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
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
});

const forgotPasswordInputSchema = z.object({ email: emailSchema });

const resetPasswordInputSchema = z.object({
  token: z.string().regex(/^[a-f\d]{64}$/i),
  password: passwordSchema,
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedInput = registerInputSchema.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ success: false, message: 'Invalid registration details' });
      return;
    }
    const { name, email, phone, dateOfBirth, gender, password } = parsedInput.data;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
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
      role: 'PATIENT',
      isActive: true,
    });

    await Patient.create({
      userId: user._id,
      dateOfBirth: new Date(dateOfBirth),
      gender: gender.toUpperCase(),
    });

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role, name: user.name },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn } as SignOptions
    );

    res.cookie('token', token, COOKIE_OPTIONS);
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

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedInput = loginInputSchema.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ success: false, message: 'Invalid login details' });
      return;
    }
    const { email, password, rememberMe } = parsedInput.data;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const expiresIn = rememberMe ? '30d' : '7d';
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role, name: user.name },
      config.jwtSecret,
      { expiresIn } as SignOptions
    );

    res.cookie('token', token, { ...COOKIE_OPTIONS, maxAge });
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

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: 0 });
  res.json({ success: true, message: 'Logged out successfully' });
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id).select('-passwordHash');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, user });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedInput = forgotPasswordInputSchema.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ success: false, message: 'Invalid email address' });
      return;
    }
    const { email } = parsedInput.data;
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ success: true, message: 'If this email exists, a reset link has been sent' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    // In production, send email. For demo, return token.
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
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};
