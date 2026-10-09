import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog';
import { AuthRequest } from './auth';

export const auditLog = (action: string, resource: string) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await AuditLog.create({
        userId: req.user?.id,
        action,
        resource,
        resourceId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { method: req.method, path: req.path },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Audit log error:', error);
    }
    next();
  };
};
