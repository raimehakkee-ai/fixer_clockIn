import type { Request } from 'express';

import { ApiError } from './errors';
import type { AuthUser } from '../types/auth-user';

export function actor(req: Request): AuthUser {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return req.user;
}

export function actorEmployeeId(req: Request): string {
  const current = actor(req);

  if (!current.employeeId) {
    throw ApiError.forbidden('Akun ini tidak memiliki data karyawan.');
  }

  return current.employeeId;
}
