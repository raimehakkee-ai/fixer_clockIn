import { Router, type Request } from 'express';
import { z } from 'zod';

import { env } from '../env';
import { writeAudit } from '../lib/audit';
import { toAttendanceDto } from '../lib/dto';
import { ApiError } from '../lib/errors';
import { roundDistance } from '../lib/geo';
import {
  detectFileType,
  IMAGE_TYPES,
  isAllowedType,
} from '../lib/image';
import { idParam } from '../lib/params';
import { paginated } from '../lib/pagination';
import { actor } from '../lib/request-user';
import {
  dateStringSchema,
  paginationSchema,
} from '../lib/validation';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { requireRole } from '../middleware/require-role';
import { imageUpload } from '../middleware/upload';
import * as attendance from '../services/attendance-service';

const clockSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().positive().max(10000),
  mocked: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  shiftId: z.string().uuid(),
});

const historyQuerySchema = paginationSchema.extend({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  shiftId: z.string().uuid().optional(),
});

const adminQuerySchema = historyQuerySchema.extend({
  date: dateStringSchema.optional(),
  employeeId: z.string().uuid().optional(),
  status: z.enum(['PRESENT', 'LATE', 'INCOMPLETE']).optional(),
  q: z.string().trim().max(100).optional(),
});

const photoQuerySchema = z.object({
  type: z.enum(['in', 'out']).default('in'),
});

const clockLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  key: (req) => req.user?.id ?? req.ip ?? 'unknown',
  message: 'Terlalu banyak permintaan absensi. Coba lagi nanti.',
});

function requireEmployeeId(req: Request): string {
  const current = actor(req);

  if (!current.employeeId) {
    throw ApiError.forbidden('Akun ini tidak memiliki data karyawan.');
  }

  return current.employeeId;
}

function ensureAttendancePlatformAllowed(platform: string | null): void {
  if (platform === 'web' && env.ALLOW_WEB_ATTENDANCE !== 'true') {
    throw ApiError.forbidden(
      'Absensi melalui browser dinonaktifkan. Gunakan aplikasi mobile ClockIn.',
    );
  }
}

async function auditClockFailure(
  req: Request,
  action: 'CLOCK_IN' | 'CLOCK_OUT',
  code: string,
  metadata: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  await writeAudit({
    actorUserId: actor(req).id,
    action: `${action}_REJECTED`,
    entityType: 'attendance_attempt',
    metadata: {
      code,
      shiftId:
        typeof req.body?.shiftId === 'string' ? req.body.shiftId : null,
      ...metadata,
    },
    req,
  });
}

function errorCode(error: unknown): string {
  return error instanceof ApiError ? error.code : 'UNKNOWN';
}

function requirePhoto(req: Request): attendance.ClockPhoto {
  const file = req.file;

  if (!file || file.size === 0) {
    throw ApiError.badRequest('Foto selfie wajib diunggah pada field "photo".');
  }

  const detected = detectFileType(file.buffer);

  if (!isAllowedType(detected, IMAGE_TYPES)) {
    throw ApiError.badRequest('File foto harus berupa JPEG atau PNG yang valid.');
  }

  return {
    buffer: file.buffer,
    mime: detected as 'image/jpeg' | 'image/png',
  };
}

export const attendanceRouter = Router();

attendanceRouter.use(authenticate);

attendanceRouter.get('/me', requireRole('EMPLOYEE'), async (req, res) => {
  const employeeId = requireEmployeeId(req);
  const query = historyQuerySchema.parse(req.query);

  const { rows, total } = await attendance.listMyAttendance(employeeId, query);

  res.json(paginated(rows.map(toAttendanceDto), total, query));
});

attendanceRouter.get('/', requireRole('ADMIN'), async (req, res) => {
  const query = adminQuerySchema.parse(req.query);
  const { rows, total } = await attendance.listAttendance(query);

  res.json(paginated(rows.map(toAttendanceDto), total, query));
});

attendanceRouter.post(
  '/clock-in',
  requireRole('EMPLOYEE'),
  clockLimiter,
  imageUpload.single('photo'),
  async (req, res) => {
    const current = actor(req);
    const employeeId = requireEmployeeId(req);
    const body = clockSchema.parse(req.body);

    if (body.mocked) {
      await auditClockFailure(req, 'CLOCK_IN', 'MOCK_LOCATION', {
        mocked: true,
      });
      throw ApiError.unprocessable(
        'MOCK_LOCATION',
        'Mock location terdeteksi. Nonaktifkan aplikasi Fake GPS sebelum melakukan absensi.',
      );
    }

    if (body.accuracy > env.ACCURACY_LIMIT_M) {
      await auditClockFailure(req, 'CLOCK_IN', 'LOW_ACCURACY', {
        accuracy: body.accuracy,
        limit: env.ACCURACY_LIMIT_M,
      });
      throw ApiError.unprocessable(
        'LOW_ACCURACY',
        `Akurasi GPS terlalu rendah (${Math.round(body.accuracy)} m). Maksimal ${env.ACCURACY_LIMIT_M} m.`,
        { accuracy: body.accuracy, limit: env.ACCURACY_LIMIT_M },
      );
    }

    const photo = requirePhoto(req);
    const now = new Date();

    let result: Awaited<ReturnType<typeof attendance.clockIn>>;
    try {
      result = await attendance.clockIn({
        employeeId,
        shiftId: body.shiftId,
        latitude: body.latitude,
        longitude: body.longitude,
        accuracy: body.accuracy,
        photo,
        riskFlags:
          current.devicePlatform === 'web' ? ['WEB_ATTENDANCE'] : [],
        ip: req.ip ?? null,
        now,
      });
    } catch (error) {
      await auditClockFailure(req, 'CLOCK_IN', errorCode(error));
      throw error;
    }

    await writeAudit({
      actorUserId: current.id,
      action: 'CLOCK_IN',
      entityType: 'attendance_record',
      entityId: result.record.id,
      metadata: {
        workDate: result.workDateString,
        shiftId: body.shiftId,
        lateMinutes: result.record.lateMinutes,
      },
      req,
    });

    res.status(201).json({
      attendance: toAttendanceDto(result.record),
      distanceMeters: roundDistance(result.distanceMeters),
      serverTime: now.toISOString(),
    });
  },
);

attendanceRouter.post(
  '/clock-out',
  requireRole('EMPLOYEE'),
  clockLimiter,
  imageUpload.single('photo'),
  async (req, res) => {
    const current = actor(req);
    const employeeId = requireEmployeeId(req);
    ensureAttendancePlatformAllowed(current.devicePlatform);
    const body = clockSchema.parse(req.body);

    if (body.mocked) {
      await auditClockFailure(req, 'CLOCK_OUT', 'MOCK_LOCATION', {
        mocked: true,
      });
      throw ApiError.unprocessable(
        'MOCK_LOCATION',
        'Mock location terdeteksi. Nonaktifkan aplikasi Fake GPS sebelum melakukan absensi.',
      );
    }

    if (body.accuracy > env.ACCURACY_LIMIT_M) {
      await auditClockFailure(req, 'CLOCK_OUT', 'LOW_ACCURACY', {
        accuracy: body.accuracy,
        limit: env.ACCURACY_LIMIT_M,
      });
      throw ApiError.unprocessable(
        'LOW_ACCURACY',
        `Akurasi GPS terlalu rendah (${Math.round(body.accuracy)} m). Maksimal ${env.ACCURACY_LIMIT_M} m.`,
        { accuracy: body.accuracy, limit: env.ACCURACY_LIMIT_M },
      );
    }

    const photo = requirePhoto(req);
    const now = new Date();

    let result: Awaited<ReturnType<typeof attendance.clockOut>>;
    try {
      result = await attendance.clockOut({
        employeeId,
        shiftId: body.shiftId,
        latitude: body.latitude,
        longitude: body.longitude,
        accuracy: body.accuracy,
        photo,
        ip: req.ip ?? null,
        now,
      });
    } catch (error) {
      await auditClockFailure(req, 'CLOCK_OUT', errorCode(error));
      throw error;
    }

    await writeAudit({
      actorUserId: current.id,
      action: 'CLOCK_OUT',
      entityType: 'attendance_record',
      entityId: result.record.id,
      metadata: {
        workDate: result.workDateString,
        shiftId: body.shiftId,
        earlyLeaveMinutes: result.record.earlyLeaveMinutes,
      },
      req,
    });

    res.json({
      attendance: toAttendanceDto(result.record),
      distanceMeters: roundDistance(result.distanceMeters),
      serverTime: now.toISOString(),
    });
  },
);

attendanceRouter.get('/:id/photo', async (req, res) => {
  const query = photoQuerySchema.parse(req.query);
  const result = await attendance.readAttendancePhoto(
    idParam(req),
    query.type,
    actor(req),
  );

  res.setHeader('Content-Type', result.mime);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(result.buffer);
});

attendanceRouter.get('/:id', async (req, res) => {
  const record = await attendance.getAttendanceDetail(
    idParam(req),
    actor(req),
  );

  res.json({ attendance: toAttendanceDto(record) });
});
