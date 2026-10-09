import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { recordAudit } from '../services/audit';

export const auditLog = (action: string, resource: string) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await recordAudit({
        hospitalId: req.user?.hospitalId,
        actorId: req.user?.id,
        action: `${action}:${resource}`,
        targetId: req.params.id,
        ipAddress: req.ip,
      });
    } catch (error) {
      next(error);
      return;
    }
    next();
  };
};
