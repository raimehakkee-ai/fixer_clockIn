import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { env } from '../env';
import { ApiError } from '../lib/errors';

function readCode(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const code = (value as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function isInvalidJsonBody(error: unknown): boolean {
  if (!(error instanceof SyntaxError)) {
    return false;
  }
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return false;
  }
  return (error as { status?: unknown }).status === 400;
}

function multerErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  if ((error as { name?: unknown }).name !== 'MulterError') {
    return undefined;
  }
  return readCode(error);
}

function isBodyTooLarge(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  return (error as { status?: unknown }).status === 413;
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId;

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Data yang dikirim tidak valid.',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      requestId,
    });
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
      requestId,
    });
    return;
  }

  if (readCode(error) === 'P2002') {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'Data dengan nilai unik yang sama sudah ada.',
      },
      requestId,
    });
    return;
  }

  const uploadErrorCode = multerErrorCode(error);
  if (uploadErrorCode) {
    const tooLarge = uploadErrorCode === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: tooLarge
          ? `Ukuran file maksimal ${env.MAX_UPLOAD_MB} MB.`
          : 'Upload file tidak valid.',
      },
      requestId,
    });
    return;
  }

  if (isBodyTooLarge(error)) {
    res.status(413).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Body request terlalu besar (maksimal 1 MB).',
      },
      requestId,
    });
    return;
  }

  if (isInvalidJsonBody(error)) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Body request bukan JSON yang valid.',
      },
      requestId,
    });
    return;
  }

  console.error(`[api] unhandled error requestId=${requestId}`, error);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan pada server.',
    },
    requestId,
    ...(env.NODE_ENV === 'development' && error instanceof Error
      ? { debug: { name: error.name } }
      : {}),
  });
}
