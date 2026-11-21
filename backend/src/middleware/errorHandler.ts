import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const correlationId = req.correlationId;

  if (err instanceof AppError) {
    logger.warn({ correlationId, status: err.statusCode, msg: err.message, details: err.details });
    res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
      correlationId,
    });
    return;
  }

  if (err instanceof ZodError) {
    logger.warn({ correlationId, msg: 'Validation error', issues: err.issues });
    res.status(400).json({
      error: 'Validation failed',
      issues: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      correlationId,
    });
    return;
  }

  logger.error({ correlationId, err, msg: 'Unhandled internal error' });
  res.status(500).json({
    error: 'Internal server error',
    correlationId,
  });
}
