import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { env } from '../config/env.js';

/** Central error handler: consistent JSON errors, no stack traces leaked. */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (error instanceof MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Maximum size is ${env.MAX_FILE_SIZE_MB} MB.`
        : error.message;
    res.status(400).json({ error: message });
    return;
  }
  const message = error instanceof Error ? error.message : 'Internal server error';
  console.error('Unhandled error:', error);
  res.status(500).json({ error: message });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route not found' });
}
