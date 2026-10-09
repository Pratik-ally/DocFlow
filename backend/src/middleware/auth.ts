import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User, UserRole } from '../models/User';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    name: string;
    hospitalId?: string;
    portal?: string;
  };
}

interface JwtPayload {
  id: string;
  sessionVersion: number;
  hospitalId?: string;
  portal?: string;
}

/**
 * Reads the JWT from:
 *   - `staff_token` cookie  (staff portal)
 *   - `token` cookie        (patient portal)
 *   - Authorization header  (API clients)
 *
 * Then ALWAYS re-reads the user from the database to get the live status.
 * A removed user with a valid token is rejected here.
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token =
    req.cookies?.staff_token ||
    req.cookies?.token ||
    req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
    return;
  }

  try {
    const user = await User.findById(decoded.id).select(
      'name email role status hospitalId mustChangePassword sessionVersion'
    );
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    const databaseHospitalId = user.hospitalId?.toString();
    if (
      user.status !== 'ACTIVE' ||
      !Number.isSafeInteger(decoded.sessionVersion) ||
      decoded.sessionVersion !== user.sessionVersion ||
      (decoded.hospitalId ?? '') !== (databaseHospitalId ?? '') ||
      (user.role === 'PATIENT' ? decoded.portal !== 'patient' : decoded.portal !== 'staff') ||
      (user.role !== 'PATIENT' && !databaseHospitalId)
    ) {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      hospitalId: user.hospitalId?.toString(),
      portal: decoded.portal,
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    next();
  };
};
