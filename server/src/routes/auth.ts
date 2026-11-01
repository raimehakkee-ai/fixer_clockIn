import { Router, type Request } from 'express';
import { z } from 'zod';

import { prisma } from '../db';
import { env } from '../env';
import { writeAudit } from '../lib/audit';
import { ApiError } from '../lib/errors';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from '../lib/jwt';
import { comparePassword, hashPassword } from '../lib/password';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';

const platformSchema = z.enum(['android', 'ios', 'web']);

const loginSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200),
  deviceIdentifier: z.string().trim().min(8).max(200).optional(),
  deviceName: z.string().trim().max(150).optional(),
  platform: platformSchema.default('web'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(500),
  deviceIdentifier: z.string().trim().min(8).max(200).optional(),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(20).max(500),
});

type UserForDto = {
  id: string;
  email: string;
  role: 'EMPLOYEE' | 'ADMIN';
  isActive: boolean;
  employee: {
    id: string;
    employeeNumber: string;
    fullName: string;
    department: string | null;
    position: string | null;
    officeLocationId: string | null;
  } | null;
};

function toUserDto(user: UserForDto) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    employee: user.employee
      ? {
          id: user.employee.id,
          number: user.employee.employeeNumber,
          fullName: user.employee.fullName,
          department: user.employee.department,
          position: user.employee.position,
          officeLocationId: user.employee.officeLocationId,
        }
      : null,
  };
}

type SessionInput = {
  userId: string;
  deviceId: string | null;
  req: Request;
};

async function createSession({ userId, deviceId, req }: SessionInput) {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const session = await prisma.session.create({
    data: {
      userId,
      deviceId,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent')?.slice(0, 255) ?? null,
    },
  });

  return { session, refreshToken };
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => {
    const email =
      typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `${req.ip ?? 'unknown'}:${email}`;
  },
  message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.',
});

const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  key: (req) => req.ip ?? 'unknown',
  message: 'Terlalu banyak percobaan login dari jaringan ini. Coba lagi nanti.',
});

let dummyPasswordHash: Promise<string> | null = null;

/**
 * Menyamakan biaya komputasi login untuk email yang tidak dikenal agar
 * penyerang tidak dapat menyimpulkan keberadaan akun dari waktu respons.
 */
function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= hashPassword('timing-equalizer-not-a-real-password');
  return dummyPasswordHash;
}

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
});

export const authRouter = Router();

authRouter.post('/login', loginIpLimiter, loginLimiter, async (req, res) => {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: body.email },
    include: {
      employee: {
        include: {
          devices: {
            where: { status: 'ACTIVE' },
            orderBy: { registeredAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!user) {
    await comparePassword(body.password, await getDummyPasswordHash()).catch(
      () => false,
    );

    await writeAudit({
      action: 'LOGIN_FAILED',
      entityType: 'user',
      metadata: { email: body.email, reason: 'unknown' },
      req,
    });
    throw ApiError.unauthorized('Email atau password salah.');
  }

  const passwordMatches = await comparePassword(body.password, user.passwordHash);

  if (!passwordMatches) {
    await writeAudit({
      actorUserId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'user',
      entityId: user.id,
      metadata: { reason: 'invalid_password' },
      req,
    });
    throw ApiError.unauthorized('Email atau password salah.');
  }

  if (!user.isActive) {
    await writeAudit({
      actorUserId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'user',
      entityId: user.id,
      metadata: { reason: 'inactive_account' },
      req,
    });
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Akun Anda dinonaktifkan. Hubungi Admin untuk informasi lebih lanjut.',
    );
  }

  let deviceId: string | null = null;

  if (user.role === 'EMPLOYEE') {
    if (!user.employee) {
      throw new ApiError(403, 'FORBIDDEN', 'Akun karyawan tidak memiliki data karyawan.');
    }

    if (!body.deviceIdentifier) {
      throw ApiError.badRequest('deviceIdentifier wajib diisi untuk login karyawan.');
    }

    const identifierHash = hashToken(body.deviceIdentifier);
    const activeDevice = user.employee.devices[0] ?? null;

    if (!activeDevice) {
      const previousDevice = await prisma.device.findUnique({
        where: {
          employeeId_deviceIdentifier: {
            employeeId: user.employee.id,
            deviceIdentifier: identifierHash,
          },
        },
      });

      const device = previousDevice
        ? await prisma.device.update({
            where: { id: previousDevice.id },
            data: {
              status: 'ACTIVE',
              revokedAt: null,
              revokedById: null,
              platform: body.platform,
              deviceName: body.deviceName ?? previousDevice.deviceName,
              registeredAt: new Date(),
              lastSeenAt: new Date(),
            },
          })
        : await prisma.device.create({
            data: {
              employeeId: user.employee.id,
              deviceIdentifier: identifierHash,
              platform: body.platform,
              deviceName: body.deviceName ?? null,
              registeredAt: new Date(),
              lastSeenAt: new Date(),
            },
          });
      deviceId = device.id;

      await writeAudit({
        actorUserId: user.id,
        action: 'DEVICE_REGISTERED',
        entityType: 'device',
        entityId: device.id,
        metadata: { platform: body.platform },
        req,
      });
    } else if (activeDevice.deviceIdentifier !== identifierHash) {
      await writeAudit({
        actorUserId: user.id,
        action: 'LOGIN_DEVICE_MISMATCH',
        entityType: 'device',
        entityId: activeDevice.id,
        metadata: { platform: body.platform },
        req,
      });
      throw new ApiError(
        403,
        'DEVICE_NOT_AUTHORIZED',
        'Akun ini terikat pada perangkat lain. Hubungi Admin untuk reset perangkat.',
      );
    } else {
      deviceId = activeDevice.id;
      await prisma.device.update({
        where: { id: activeDevice.id },
        data: {
          lastSeenAt: new Date(),
          deviceName: body.deviceName ?? activeDevice.deviceName,
        },
      });
    }
  }

  const { session, refreshToken } = await createSession({
    userId: user.id,
    deviceId,
    req,
  });

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    sid: session.id,
    ...(deviceId ? { deviceId } : {}),
  });

  await writeAudit({
    actorUserId: user.id,
    action: 'LOGIN_SUCCESS',
    entityType: 'user',
    entityId: user.id,
    metadata: { platform: body.platform },
    req,
  });

  res.json({
    accessToken,
    refreshToken,
    user: toUserDto(user),
    device: deviceId ? { id: deviceId, status: 'ACTIVE' as const } : null,
    serverTime: new Date().toISOString(),
  });
});

authRouter.post('/refresh', refreshLimiter, async (req, res) => {
  const body = refreshSchema.parse(req.body);
  const tokenHash = hashToken(body.refreshToken);

  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: tokenHash },
    include: {
      user: { include: { employee: true } },
      device: true,
    },
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= Date.now() ||
    !session.user.isActive
  ) {
    throw ApiError.unauthorized('Refresh token tidak valid atau sudah berakhir.');
  }

  if (session.device) {
    if (!body.deviceIdentifier) {
      throw ApiError.badRequest('deviceIdentifier wajib diisi untuk memperbarui sesi.');
    }
    if (session.device.status !== 'ACTIVE') {
      throw new ApiError(403, 'DEVICE_NOT_AUTHORIZED', 'Perangkat sudah tidak aktif.');
    }
    if (hashToken(body.deviceIdentifier) !== session.device.deviceIdentifier) {
      throw new ApiError(
        403,
        'DEVICE_NOT_AUTHORIZED',
        'Perangkat tidak cocok dengan sesi ini.',
      );
    }
  }

  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const newSession = await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });

    return tx.session.create({
      data: {
        userId: session.userId,
        deviceId: session.deviceId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent')?.slice(0, 255) ?? null,
      },
    });
  });

  const accessToken = signAccessToken({
    sub: session.user.id,
    role: session.user.role,
    sid: newSession.id,
    ...(session.deviceId ? { deviceId: session.deviceId } : {}),
  });

  res.json({
    accessToken,
    refreshToken,
    serverTime: new Date().toISOString(),
  });
});

authRouter.post('/logout', async (req, res) => {
  const body = logoutSchema.parse(req.body);

  await prisma.session.updateMany({
    where: {
      refreshTokenHash: hashToken(body.refreshToken),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  res.status(204).send();
});

authRouter.get('/me', authenticate, async (req, res) => {
  const current = req.user;
  if (!current) {
    throw ApiError.unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: current.id },
    include: { employee: true },
  });

  if (!user) {
    throw ApiError.unauthorized();
  }

  const device = current.deviceId
    ? await prisma.device.findUnique({ where: { id: current.deviceId } })
    : null;

  res.json({
    user: toUserDto(user),
    device: device
      ? {
          id: device.id,
          platform: device.platform,
          deviceName: device.deviceName,
          status: device.status,
        }
      : null,
    serverTime: new Date().toISOString(),
  });
});
