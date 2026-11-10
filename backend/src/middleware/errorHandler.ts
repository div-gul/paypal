import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'Request body exceeds the allowed size.' } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload validation failed',
        details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    const safeMessages: Record<number, string> = {
      202: 'If registration can be completed, sign in to continue.',
      400: 'Request could not be processed.',
      401: 'Authentication is required.',
      403: 'Request is not permitted.',
      404: 'Resource not found.',
      409: 'Request conflicts with the current state.',
      413: 'Request is too large.',
      422: 'Request could not be processed.',
      429: 'Too many requests. Please try again later.',
    };
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: process.env.NODE_ENV === 'production'
          ? safeMessages[err.statusCode] || 'An internal error occurred.'
          : err.message,
      },
    });
    return;
  }

  if (process.env.NODE_ENV === 'production') console.error('Unhandled server error');
  else console.error('Unhandled server error:', err);
  const message = process.env.NODE_ENV === 'production'
    ? 'An internal error occurred.'
    : err instanceof Error ? err.message : 'Internal Server Error';

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
}
