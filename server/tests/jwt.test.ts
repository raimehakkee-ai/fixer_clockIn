import { describe, expect, it } from 'vitest';

import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from '../src/lib/jwt';

const payload = {
  sub: 'user-1',
  role: 'EMPLOYEE' as const,
  sid: 'session-1',
  deviceId: 'device-1',
};

describe('access token', () => {
  it('menandatangani dan memverifikasi payload', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);

    expect(decoded.sub).toBe('user-1');
    expect(decoded.role).toBe('EMPLOYEE');
    expect(decoded.sid).toBe('session-1');
    expect(decoded.deviceId).toBe('device-1');
  });

  it('menolak token yang dimodifikasi', () => {
    const token = signAccessToken(payload);
    const tampered = `${token.slice(0, -3)}abc`;

    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('menolak token acak', () => {
    expect(() => verifyAccessToken('bukan.token.jwt')).toThrow();
  });
});

describe('refresh token', () => {
  it('menghasilkan token acak yang berbeda', () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(50);
  });

  it('menghasilkan hash deterministik', () => {
    const token = generateRefreshToken();

    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toHaveLength(64);
  });
});
