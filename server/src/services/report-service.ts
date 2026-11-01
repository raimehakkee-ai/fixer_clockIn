import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../db';
import { dateStringToUtcDate } from '../lib/date-range';
import { ApiError } from '../lib/errors';
import { summarizeAttendance } from '../lib/report';
import { officeDateString } from '../lib/time';

const EXPORT_MAX_ROWS = 20_000;

async function getActiveOffice() {
  return prisma.officeLocation.findFirst({ where: { isActive: true } });
}

export async function getSummary(dateInput?: string) {
  const office = await getActiveOffice();
  const timezone = office?.timezone ?? 'Asia/Jakarta';
  const date = dateInput ?? officeDateString(new Date(), timezone);
  const workDate = dateStringToUtcDate(date);

  const [totalEmployees, records, approvedLeaves, pendingLeaveRequests] =
    await prisma.$transaction([
      prisma.employee.count({ where: { isActive: true } }),
      prisma.attendanceRecord.findMany({
        where: { workDate },
        select: { employeeId: true, status: true },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: { lte: workDate },
          endDate: { gte: workDate },
        },
        select: { employeeId: true },
      }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
    ]);

  const approvedLeaveEmployeeIds = [
    ...new Set(approvedLeaves.map((leave) => leave.employeeId)),
  ];

  return {
    date,
    timezone,
    totalEmployees,
    ...summarizeAttendance({
      totalEmployees,
      records,
      approvedLeaveEmployeeIds,
    }),
    pendingLeaveRequests,
  };
}

export async function resolveExportRange(from?: string, to?: string) {
  const office = await getActiveOffice();
  const timezone = office?.timezone ?? 'Asia/Jakarta';
  const today = officeDateString(new Date(), timezone);
  const resolvedTo = to ?? today;
  const resolvedFrom = from ?? `${resolvedTo.slice(0, 7)}-01`;

  if (resolvedFrom > resolvedTo) {
    throw ApiError.badRequest(
      'Rentang tanggal tidak valid: tanggal mulai harus sebelum atau sama dengan tanggal selesai.',
    );
  }

  return { from: resolvedFrom, to: resolvedTo, timezone };
}

export type AttendanceExportFilters = {
  from: string;
  to: string;
  employeeId?: string;
  shiftId?: string;
  status?: 'PRESENT' | 'LATE' | 'INCOMPLETE';
};

export async function getAttendanceExportRows(filters: AttendanceExportFilters) {
  const where: Prisma.AttendanceRecordWhereInput = {
    workDate: {
      gte: dateStringToUtcDate(filters.from),
      lte: dateStringToUtcDate(filters.to),
    },
  };

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.shiftId) where.shiftId = filters.shiftId;
  if (filters.status) where.status = filters.status;

  const total = await prisma.attendanceRecord.count({ where });

  if (total > EXPORT_MAX_ROWS) {
    throw ApiError.unprocessable(
      'EXPORT_TOO_LARGE',
      `Jumlah baris melebihi batas ${EXPORT_MAX_ROWS}. Persempit periode atau filter.`,
      { total, limit: EXPORT_MAX_ROWS },
    );
  }

  return prisma.attendanceRecord.findMany({
    where,
    include: { employee: true, shift: true },
    orderBy: [{ workDate: 'asc' }, { clockInAt: 'asc' }],
  });
}

export type LeaveExportFilters = {
  from: string;
  to: string;
  employeeId?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
};

export async function getLeaveExportRows(filters: LeaveExportFilters) {
  const where: Prisma.LeaveRequestWhereInput = {
    startDate: { lte: dateStringToUtcDate(filters.to) },
    endDate: { gte: dateStringToUtcDate(filters.from) },
  };

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.status) where.status = filters.status;

  const total = await prisma.leaveRequest.count({ where });

  if (total > EXPORT_MAX_ROWS) {
    throw ApiError.unprocessable(
      'EXPORT_TOO_LARGE',
      `Jumlah baris melebihi batas ${EXPORT_MAX_ROWS}. Persempit periode atau filter.`,
      { total, limit: EXPORT_MAX_ROWS },
    );
  }

  return prisma.leaveRequest.findMany({
    where,
    include: {
      employee: true,
      reviewedBy: { select: { id: true, email: true } },
    },
    orderBy: { startDate: 'asc' },
  });
}
