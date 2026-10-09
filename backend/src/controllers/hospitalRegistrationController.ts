import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../config';
import { AuditLog } from '../models/AuditLog';
import { Hospital } from '../models/Hospital';
import { HospitalEmailVerification } from '../models/HospitalEmailVerification';
import { User } from '../models/User';
import { hospitalRegistrationEmailService } from '../services/hospitalRegistrationEmail';
import {
  hospitalRegistrationSchema,
  resendHospitalCodeSchema,
  verifyHospitalEmailSchema,
} from '../validation/hospitalRegistration';

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const REGISTRATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const GENERIC_REGISTRATION_ERROR = 'Unable to complete registration';
const GENERIC_VERIFICATION_ERROR = 'Unable to verify email';

function hashVerificationCode(email: string, code: string): string {
  return createHmac('sha256', config.jwtSecret)
    .update(`${email}:${code}`)
    .digest('hex');
}

function safelyCompareCode(expectedHash: string, email: string, code: string): boolean {
  const actualHash = Buffer.from(hashVerificationCode(email, code), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actualHash.length === expected.length && timingSafeEqual(actualHash, expected);
}

function createVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: unknown }).code === 11000;
}

export const registerHospital = async (req: Request, res: Response): Promise<void> => {
  const parsed = hospitalRegistrationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Check the required registration fields.' });
    return;
  }

  const input = parsed.data;
  const session = await mongoose.startSession();
  try {
    const duplicateEmail = await User.exists({ email: input.email });
    const duplicateMobile = await User.exists({
      $or: [{ mobile: input.mobile }, { phone: input.mobile }],
    });
    if (duplicateEmail || duplicateMobile) {
      res.status(409).json({ success: false, message: GENERIC_REGISTRATION_ERROR });
      return;
    }

    const code = createVerificationCode();
    await session.withTransaction(async () => {
      const [hospital] = await Hospital.create([{
        name: input.hospitalName,
        address: {
          street: input.addressLine1,
          city: input.city,
          state: input.state,
          pincode: input.postalCode,
          country: input.country,
        },
        phone: input.mobile,
        email: input.email,
        location: {
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          state: input.state,
          country: input.country,
          postalCode: input.postalCode,
        },
        status: 'PENDING',
        isActive: false,
      }], { session });

      const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);
      const [owner] = await User.create([{
        name: input.ownerName,
        email: input.email,
        mobile: input.mobile,
        phone: input.mobile,
        passwordHash,
        role: 'OWNER',
        hospitalId: hospital._id,
        status: 'PENDING_VERIFICATION',
        failedLoginCount: 0,
        sessionVersion: 0,
      }], { session });
      await Hospital.updateOne(
        { _id: hospital._id, status: 'PENDING' },
        { $set: { ownerId: owner._id } },
        { session }
      );
      await HospitalEmailVerification.create([{
        ownerId: owner._id,
        hospitalId: hospital._id,
        codeHash: hashVerificationCode(input.email, code),
        expiresAt: new Date(Date.now() + CODE_LIFETIME_MS),
        attempts: 0,
      }], { session });
      await AuditLog.create([{
        hospitalId: hospital._id,
        actorId: owner._id,
        targetId: owner._id,
        action: 'HOSPITAL_REGISTRATION_CREATED',
        ipAddress: req.ip,
        at: new Date(),
      }], { session });
    });

    try {
      await hospitalRegistrationEmailService.sendVerificationCode(input.email, code);
    } catch (error) {
      console.error('Hospital verification email could not be sent:', error instanceof Error ? error.name : 'Unknown error');
      res.status(503).json({ success: false, message: GENERIC_REGISTRATION_ERROR });
      return;
    }
    res.status(201).json({
      success: true,
      message: 'If registration can be completed, a verification code will be sent to the provided email address.',
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction().catch(() => undefined);
    }
    if (isDuplicateKeyError(error)) {
      res.status(409).json({ success: false, message: GENERIC_REGISTRATION_ERROR });
      return;
    }
    console.error('Hospital registration failed:', error instanceof Error ? error.name : 'Unknown error');
    res.status(500).json({ success: false, message: GENERIC_REGISTRATION_ERROR });
  } finally {
    await session.endSession();
  }
};

export const verifyHospitalEmail = async (req: Request, res: Response): Promise<void> => {
  const parsed = verifyHospitalEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: GENERIC_VERIFICATION_ERROR });
    return;
  }

  const { email, code } = parsed.data;
  try {
    const owner = await User.findOne({
      email,
      role: 'OWNER',
      status: 'PENDING_VERIFICATION',
    }).select('_id hospitalId createdAt');
    if (!owner?.hospitalId || Date.now() - owner.createdAt.getTime() > REGISTRATION_LIFETIME_MS) {
      res.status(400).json({ success: false, message: GENERIC_VERIFICATION_ERROR });
      return;
    }

    const verification = await HospitalEmailVerification.findOne({ ownerId: owner._id }).select('+codeHash');
    if (
      !verification ||
      verification.expiresAt.getTime() <= Date.now() ||
      verification.attempts >= MAX_CODE_ATTEMPTS
    ) {
      res.status(400).json({ success: false, message: GENERIC_VERIFICATION_ERROR });
      return;
    }

    const attempt = await HospitalEmailVerification.updateOne(
      { _id: verification._id, attempts: verification.attempts, expiresAt: { $gt: new Date() } },
      { $inc: { attempts: 1 } }
    );
    if (attempt.modifiedCount !== 1 || !safelyCompareCode(verification.codeHash, email, code)) {
      res.status(400).json({ success: false, message: GENERIC_VERIFICATION_ERROR });
      return;
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const ownerUpdate = await User.updateOne(
          { _id: owner._id, role: 'OWNER', status: 'PENDING_VERIFICATION' },
          { $set: { status: 'ACTIVE', emailVerifiedAt: now } },
          { session }
        );
        const hospitalUpdate = await Hospital.updateOne(
          { _id: owner.hospitalId, ownerId: owner._id, status: 'PENDING' },
          { $set: { status: 'ACTIVE', isActive: true } },
          { session }
        );
        if (ownerUpdate.modifiedCount !== 1 || hospitalUpdate.modifiedCount !== 1) {
          throw new Error('Registration records changed before verification');
        }
        await HospitalEmailVerification.deleteOne({ _id: verification._id }, { session });
        await AuditLog.create([{
          hospitalId: owner.hospitalId,
          actorId: owner._id,
          targetId: owner._id,
          action: 'HOSPITAL_OWNER_EMAIL_VERIFIED',
          ipAddress: req.ip,
          at: now,
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    res.json({ success: true, hospitalId: owner.hospitalId.toString() });
  } catch (error) {
    console.error('Hospital email verification failed:', error instanceof Error ? error.name : 'Unknown error');
    res.status(400).json({ success: false, message: GENERIC_VERIFICATION_ERROR });
  }
};

export const resendHospitalVerificationCode = async (req: Request, res: Response): Promise<void> => {
  const parsed = resendHospitalCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: GENERIC_REGISTRATION_ERROR });
    return;
  }

  const { email } = parsed.data;
  try {
    const owner = await User.findOne({
      email,
      role: 'OWNER',
      status: 'PENDING_VERIFICATION',
      createdAt: { $gt: new Date(Date.now() - REGISTRATION_LIFETIME_MS) },
    }).select('_id hospitalId');
    const verification = owner?.hospitalId
      ? await HospitalEmailVerification.findOne({ ownerId: owner._id })
      : null;
    if (!owner?.hospitalId || !verification) {
      res.json({ success: true, message: 'If registration is pending, a new code will be sent.' });
      return;
    }

    const code = createVerificationCode();
    await HospitalEmailVerification.updateOne(
      { _id: verification._id },
      {
        $set: {
          codeHash: hashVerificationCode(email, code),
          expiresAt: new Date(Date.now() + CODE_LIFETIME_MS),
          attempts: 0,
        },
      }
    );
    await hospitalRegistrationEmailService.sendVerificationCode(email, code);
    res.json({ success: true, message: 'If registration is pending, a new code will be sent.' });
  } catch (error) {
    console.error('Hospital verification code resend failed:', error instanceof Error ? error.name : 'Unknown error');
    res.status(500).json({ success: false, message: GENERIC_REGISTRATION_ERROR });
  }
};
