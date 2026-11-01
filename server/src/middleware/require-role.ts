import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../lib/errors';
import type { AppRole } from '../types/auth-user';

export function requireRole(...roles: AppRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(ApiError.forbidden());
      return;
    }

    next();
  };
}
