import type { NextFunction, Request, Response } from 'express';

import { prisma } from '../db';
import { ApiError } from '../lib/errors';
import { verifyAccessToken } from '../lib/jwt';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized();
    }

    const token = header.slice('Bearer '.length).trim();

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized();
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: { include: { employee: true } } },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now() ||
      session.userId !== payload.sub ||
      !session.user.isActive
    ) {
      throw ApiError.unauthorized();
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      employeeId: session.user.employee?.id ?? null,
      sessionId: session.id,
      deviceId: session.deviceId,
    };

    next();
  } catch (error) {
    next(error);
  }
}
