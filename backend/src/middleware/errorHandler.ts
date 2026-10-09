import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: Error & { statusCode?: number }, req: Request, res: Response, _next: NextFunction): void => {
  console.error('Request failed:', req.method, req.path, err.name);
  const statusCode = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    message: 'Request failed',
  });
};

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: 'Not found' });
};
