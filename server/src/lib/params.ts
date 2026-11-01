import type { Request } from 'express';
import { z } from 'zod';

import { ApiError } from './errors';

const uuidSchema = z.string().uuid();

export function idParam(req: Request): string {
  const parsed = uuidSchema.safeParse(req.params.id);

  if (!parsed.success) {
    throw ApiError.badRequest('ID pada URL tidak valid.');
  }

  return parsed.data;
}
