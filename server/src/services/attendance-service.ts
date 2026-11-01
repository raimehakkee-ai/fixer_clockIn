import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../db';
import { dateStringToUtcDate as toDateOnly } from '../lib/date-range';
import { ApiError } from '../lib/errors';
import { haversineMeters, isWithinRadius, roundDistance } from '../lib/geo';
import { skipFor } from '../lib/pagination';
import { prismaErrorCode } from '../lib/prisma-error';
import { storage } from '../lib/storage';
import {
  computeLateMinutes,
  isWithinShiftWindow,
  minutesSinceShiftStart,
  resolveWorkDate,
  shiftDurationMinutes,
} from '../lib/time';
import type { AuthUser } from '../types/auth-user';

export type ClockPhoto = {
  buffer: Buffer;
  mime: 'image/jpeg' | 'image/png';
};

export type ClockInput = {
  employeeId: string;
  shiftId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  photo: ClockPhoto;
  ip?: string | null;
  now: Date;
};

export type AttendanceQuery = {
  from?: string;
  to?: string;
  shiftId?: string;
  page: number;
  limit: number;
};

export type AdminAttendanceQuery = AttendanceQuery & {
  date?: string;
  employeeId?: string;
  status?: 'PRESENT' | 'LATE' | 'INCOMPLETE';
  q?: string;
};

async function getActiveOffice() {
  const office = await prisma.officeLocation.findFirst({
    where: { isActive: true },
  });

  if (!office) {
    throw ApiError.unprocessable(
      'OFFICE_NOT_CONFIGURED',
      'Lokasi kantor aktif belum dikonfigurasi.',
    );
  }

  return office;
}

async function getActiveShift(shiftId: string) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });

  if (!shift || !shift.isActive) {
    throw ApiError.unprocessable(
      'INVALID_SHIFT',
      'Shift tidak aktif atau tidak ditemukan.',
    );
  }

  return shift;
}

export async function clockIn(input: ClockInput) {
  const office = await getActiveOffice();
  const shift = await getActiveShift(input.shiftId);

  if (!isWithinShiftWindow(input.now, shift, office.timezone)) {
    throw ApiError.unprocessable(
      'OUTSIDE_SHIFT_WINDOW',
      'Clock-In hanya dapat dilakukan pada jendela shift yang dipilih.',
    );
  }

  const distanceMeters = haversineMeters(
    { latitude: input.latitude, longitude: input.longitude },
    { latitude: Number(office.latitude), longitude: Number(office.longitude) },
  );

  if (!isWithinRadius(distanceMeters, office.radiusMeters)) {
    throw ApiError.unprocessable(
      'OUT_OF_RANGE',
      'Anda berada di luar radius kantor.',
      {
        distanceMeters: roundDistance(distanceMeters),
        radiusMeters: office.radiusMeters,
      },
    );
  }

  const workDateString = resolveWorkDate(input.now, shift, office.timezone);
  const workDate = toDateOnly(workDateString);

  const existing = await prisma.attendanceRecord.findUnique({
    where: {
      employeeId_workDate_shiftId: {
        employeeId: input.employeeId,
        workDate,
        shiftId: shift.id,
      },
    },
    select: { id: true },
  });

  if (existing) {
    throw ApiError.conflict(
      'ALREADY_CLOCKED_IN',
      'Anda sudah Clock-In untuk shift ini.',
    );
  }

  const photoKey = await storage.save(
    input.photo.buffer,
    input.photo.mime,
    `attendance/${workDateString}`,
  );
  const lateMinutes = computeLateMinutes(input.now, shift, office.timezone);

  try {
    const record = await prisma.attendanceRecord.create({
      data: {
        employeeId: input.employeeId,
        officeLocationId: office.id,
        shiftId: shift.id,
        workDate,
        clockInAt: input.now,
        clockInLatitude: input.latitude,
        clockInLongitude: input.longitude,
        clockInAccuracy: input.accuracy,
        clockInDistanceMeters: distanceMeters,
        clockInMocked: false,
        clockInPhotoKey: photoKey,
        clockInPhotoMime: input.photo.mime,
        clockInIp: input.ip ?? null,
        status: lateMinutes > 0 ? 'LATE' : 'PRESENT',
        lateMinutes,
      },
      include: { shift: true },
    });

    return {
      record,
      office,
      shift,
      workDateString,
      distanceMeters,
    };
  } catch (error) {
    await storage.delete(photoKey).catch(() => undefined);

    if (prismaErrorCode(error) === 'P2002') {
      throw ApiError.conflict(
        'ALREADY_CLOCKED_IN',
        'Anda sudah Clock-In untuk shift ini.',
      );
    }

    throw error;
  }
}

export async function clockOut(input: ClockInput) {
  const office = await getActiveOffice();
  const shift = await getActiveShift(input.shiftId);

  if (!isWithinShiftWindow(input.now, shift, office.timezone)) {
    throw ApiError.unprocessable(
      'OUTSIDE_SHIFT_WINDOW',
      'Clock-Out hanya dapat dilakukan pada jendela shift yang dipilih.',
    );
  }

  const workDateString = resolveWorkDate(input.now, shift, office.timezone);
  const workDate = toDateOnly(workDateString);

  const record = await prisma.attendanceRecord.findUnique({
    where: {
      employeeId_workDate_shiftId: {
        employeeId: input.employeeId,
        workDate,
        shiftId: shift.id,
      },
    },
    include: { shift: true, officeLocation: true },
  });

  if (!record) {
    throw ApiError.conflict(
      'NOT_CLOCKED_IN',
      'Tidak ada Clock-In untuk shift ini.',
    );
  }

  if (record.clockOutAt) {
    throw ApiError.conflict(
      'ALREADY_CLOCKED_OUT',
      'Anda sudah Clock-Out untuk shift ini.',
    );
  }

  const distanceMeters = haversineMeters(
    { latitude: input.latitude, longitude: input.longitude },
    {
      latitude: Number(record.officeLocation.latitude),
      longitude: Number(record.officeLocation.longitude),
    },
  );

  if (!isWithinRadius(distanceMeters, record.officeLocation.radiusMeters)) {
    throw ApiError.unprocessable(
      'OUT_OF_RANGE',
      'Anda berada di luar radius kantor.',
      {
        distanceMeters: roundDistance(distanceMeters),
        radiusMeters: record.officeLocation.radiusMeters,
      },
    );
  }

  const photoKey = await storage.save(
    input.photo.buffer,
    input.photo.mime,
    `attendance/${workDateString}`,
  );

  const relative = minutesSinceShiftStart(input.now, shift, office.timezone);
  const duration = shiftDurationMinutes(shift);
  const earlyLeaveMinutes =
    relative >= 1440 - shift.earlyWindowMinutes
      ? duration
      : Math.max(0, duration - relative);

  try {
    const updated = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        clockOutAt: input.now,
        clockOutLatitude: input.latitude,
        clockOutLongitude: input.longitude,
        clockOutAccuracy: input.accuracy,
        clockOutDistanceMeters: distanceMeters,
        clockOutMocked: false,
        clockOutPhotoKey: photoKey,
        clockOutPhotoMime: input.photo.mime,
        clockOutIp: input.ip ?? null,
        earlyLeaveMinutes,
      },
      include: { shift: true },
    });

    return {
      record: updated,
      office,
      shift,
      workDateString,
      distanceMeters,
    };
  } catch (error) {
    await storage.delete(photoKey).catch(() => undefined);
    throw error;
  }
}

export async function listMyAttendance(
  employeeId: string,
  query: AttendanceQuery,
) {
  const where: Prisma.AttendanceRecordWhereInput = { employeeId };
  if (query.shiftId) where.shiftId = query.shiftId;

  const workDate: Prisma.DateTimeFilter = {};
  if (query.from) workDate.gte = toDateOnly(query.from);
  if (query.to) workDate.lte = toDateOnly(query.to);
  if (query.from || query.to) where.workDate = workDate;

  const [rows, total] = await prisma.$transaction([
    prisma.attendanceRecord.findMany({
      where,
      include: { shift: true },
      orderBy: [{ workDate: 'desc' }, { clockInAt: 'desc' }],
      skip: skipFor(query),
      take: query.limit,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return { rows, total };
}

export async function listAttendance(query: AdminAttendanceQuery) {
  const where: Prisma.AttendanceRecordWhereInput = {};

  if (query.date) {
    where.workDate = toDateOnly(query.date);
  } else {
    const workDate: Prisma.DateTimeFilter = {};
    if (query.from) workDate.gte = toDateOnly(query.from);
    if (query.to) workDate.lte = toDateOnly(query.to);
    if (query.from || query.to) where.workDate = workDate;
  }

  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.shiftId) where.shiftId = query.shiftId;
  if (query.status) where.status = query.status;

  if (query.q) {
    where.employee = {
      OR: [
        { fullName: { contains: query.q, mode: 'insensitive' } },
        { employeeNumber: { contains: query.q, mode: 'insensitive' } },
      ],
    };
  }

  const [rows, total] = await prisma.$transaction([
    prisma.attendanceRecord.findMany({
      where,
      include: { shift: true, employee: true },
      orderBy: [{ workDate: 'desc' }, { clockInAt: 'desc' }],
      skip: skipFor(query),
      take: query.limit,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return { rows, total };
}

export async function getAttendanceForAccess(id: string, actor: AuthUser) {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id },
    include: { shift: true, employee: true, officeLocation: true },
  });

  if (!record) {
    throw ApiError.notFound('Data absensi tidak ditemukan.');
  }

  const isOwner = actor.employeeId !== null && record.employeeId === actor.employeeId;
  if (actor.role !== 'ADMIN' && !isOwner) {
    throw ApiError.notFound('Data absensi tidak ditemukan.');
  }

  return record;
}

export async function getAttendanceDetail(id: string, actor: AuthUser) {
  return getAttendanceForAccess(id, actor);
}

export async function readAttendancePhoto(
  id: string,
  type: 'in' | 'out',
  actor: AuthUser,
) {
  const record = await getAttendanceForAccess(id, actor);
  const key = type === 'out' ? record.clockOutPhotoKey : record.clockInPhotoKey;
  const mime = type === 'out' ? record.clockOutPhotoMime : record.clockInPhotoMime;

  if (!key) {
    throw ApiError.notFound('Foto absensi tidak tersedia.');
  }

  try {
    const buffer = await storage.read(key);
    return { buffer, mime: mime ?? 'application/octet-stream' };
  } catch {
    throw ApiError.notFound('File foto tidak ditemukan.');
  }
}
