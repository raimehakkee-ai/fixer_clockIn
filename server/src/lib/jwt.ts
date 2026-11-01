import { createHash, randomBytes } from 'node:crypto';

import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../env';

export type AccessTokenPayload = {
  sub: string;
  role: 'EMPLOYEE' | 'ADMIN';
  sid: string;
  deviceId?: string;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

  if (typeof decoded === 'string') {
    throw new Error('Token tidak valid');
  }

  const { sub, role, sid, deviceId } = decoded as jwt.JwtPayload &
    Partial<AccessTokenPayload>;

  if (!sub || !sid || (role !== 'EMPLOYEE' && role !== 'ADMIN')) {
    throw new Error('Token tidak valid');
  }

  return { sub, role, sid, deviceId };
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
