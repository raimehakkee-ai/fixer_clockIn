import { Router, type Response } from 'express';
import { z } from 'zod';

import { writeAudit } from '../lib/audit';
import { inclusiveDays } from '../lib/date-range';
import {
  exportFilename,
  formatDateTimeInZone,
  toCsv,
  toXlsx,
  type XlsxColumn,
} from '../lib/export';
import { actor } from '../lib/request-user';
import { dateStringSchema } from '../lib/validation';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { requireRole } from '../middleware/require-role';
import * as reports from '../services/report-service';

type TableRow = Record<string, string | number | null>;

const ATTENDANCE_LABEL: Record<string, string> = {
  PRESENT: 'Hadir',
  LATE: 'Terlambat',
  INCOMPLETE: 'Belum keluar',
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  SICK: 'Sakit',
  ANNUAL: 'Cuti',
  PERMISSION: 'Izin',
  OTHER: 'Lainnya',
};

const LEAVE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

const ATTENDANCE_COLUMNS: XlsxColumn[] = [
  { header: 'NIK', key: 'employeeNumber', width: 16 },
  { header: 'Nama', key: 'fullName', width: 24 },
  { header: 'Departemen', key: 'department', width: 18 },
  { header: 'Tanggal', key: 'workDate', width: 12 },
  { header: 'Shift', key: 'shift', width: 14 },
  { header: 'Masuk', key: 'clockIn', width: 18 },
  { header: 'Keluar', key: 'clockOut', width: 18 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Terlambat (menit)', key: 'lateMinutes', width: 16 },
  { header: 'Pulang Awal (menit)', key: 'earlyLeaveMinutes', width: 18 },
  { header: 'Jarak Masuk (m)', key: 'distanceIn', width: 16 },
  { header: 'Jarak Keluar (m)', key: 'distanceOut', width: 17 },
  { header: 'Mock Location', key: 'mocked', width: 14 },
  { header: 'Catatan', key: 'notes', width: 24 },
];

const LEAVE_COLUMNS: XlsxColumn[] = [
  { header: 'NIK', key: 'employeeNumber', width: 16 },
  { header: 'Nama', key: 'fullName', width: 24 },
  { header: 'Jenis', key: 'type', width: 12 },
  { header: 'Mulai', key: 'startDate', width: 12 },
  { header: 'Selesai', key: 'endDate', width: 12 },
  { header: 'Hari', key: 'days', width: 8 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Reviewer', key: 'reviewer', width: 22 },
  { header: 'Waktu Keputusan', key: 'reviewedAt', width: 18 },
  { header: 'Catatan', key: 'reviewNote', width: 28 },
  { header: 'Dibuat', key: 'createdAt', width: 18 },
];

const summaryQuerySchema = z.object({
  date: dateStringSchema.optional(),
});

const attendanceExportQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  employeeId: z.string().uuid().optional(),
  shiftId: z.string().uuid().optional(),
  status: z.enum(['PRESENT', 'LATE', 'INCOMPLETE']).optional(),
  format: z.enum(['csv', 'xlsx']).default('csv'),
});

const leaveExportQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  employeeId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  format: z.enum(['csv', 'xlsx']).default('csv'),
});

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  key: (req) => req.user?.id ?? req.ip ?? 'unknown',
  message: 'Batas unduhan laporan per jam tercapai. Coba lagi nanti.',
});

async function sendTable(
  res: Response,
  format: 'csv' | 'xlsx',
  filename: string,
  sheetName: string,
  columns: XlsxColumn[],
  records: TableRow[],
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  if (format === 'csv') {
    const csv = toCsv(
      columns.map((column) => column.header),
      records.map((record) =>
        columns.map((column) => record[column.key] ?? ''),
      ),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(csv);
    return;
  }

  const buffer = await toXlsx(sheetName, columns, records);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.send(buffer);
}

export const reportsRouter = Router();

reportsRouter.use(authenticate);
reportsRouter.use(requireRole('ADMIN'));

reportsRouter.get('/summary', async (req, res) => {
  const query = summaryQuerySchema.parse(req.query);
  const summary = await reports.getSummary(query.date);

  res.json({ summary });
});

reportsRouter.get('/attendance/export', exportLimiter, async (req, res) => {
  const query = attendanceExportQuerySchema.parse(req.query);
  const current = actor(req);
  const range = await reports.resolveExportRange(query.from, query.to);

  const records = await reports.getAttendanceExportRows({
    from: range.from,
    to: range.to,
    employeeId: query.employeeId,
    shiftId: query.shiftId,
    status: query.status,
  });

  const rows: TableRow[] = records.map((record) => ({
    employeeNumber: record.employee.employeeNumber,
    fullName: record.employee.fullName,
    department: record.employee.department ?? '',
    workDate: record.workDate.toISOString().slice(0, 10),
    shift: record.shift.name,
    clockIn: formatDateTimeInZone(record.clockInAt, range.timezone),
    clockOut: formatDateTimeInZone(record.clockOutAt, range.timezone),
    status: ATTENDANCE_LABEL[record.status] ?? record.status,
    lateMinutes: record.lateMinutes,
    earlyLeaveMinutes: record.earlyLeaveMinutes,
    distanceIn: Math.round(record.clockInDistanceMeters),
    distanceOut:
      record.clockOutDistanceMeters === null
        ? ''
        : Math.round(record.clockOutDistanceMeters),
    mocked:
      record.clockInMocked || record.clockOutMocked ? 'YA' : 'TIDAK',
    notes: Array.isArray(record.riskFlags)
      ? record.riskFlags.map(String).join('; ')
      : '',
  }));

  await writeAudit({
    actorUserId: current.id,
    action: 'EXPORT_DOWNLOADED',
    entityType: 'report',
    metadata: {
      report: 'attendance',
      from: range.from,
      to: range.to,
      format: query.format,
      rows: rows.length,
      employeeId: query.employeeId ?? null,
      shiftId: query.shiftId ?? null,
    },
    req,
  });

  await sendTable(
    res,
    query.format,
    exportFilename('rekap-absensi', range.from, range.to, query.format),
    'Rekap Absensi',
    ATTENDANCE_COLUMNS,
    rows,
  );
});

reportsRouter.get('/leave/export', exportLimiter, async (req, res) => {
  const query = leaveExportQuerySchema.parse(req.query);
  const current = actor(req);
  const range = await reports.resolveExportRange(query.from, query.to);

  const records = await reports.getLeaveExportRows({
    from: range.from,
    to: range.to,
    employeeId: query.employeeId,
    status: query.status,
  });

  const rows: TableRow[] = records.map((record) => {
    const startDate = record.startDate.toISOString().slice(0, 10);
    const endDate = record.endDate.toISOString().slice(0, 10);

    return {
      employeeNumber: record.employee.employeeNumber,
      fullName: record.employee.fullName,
      type: LEAVE_TYPE_LABEL[record.type] ?? record.type,
      startDate,
      endDate,
      days: inclusiveDays(startDate, endDate),
      status: LEAVE_STATUS_LABEL[record.status] ?? record.status,
      reviewer: record.reviewedBy?.email ?? '',
      reviewedAt: formatDateTimeInZone(record.reviewedAt, range.timezone),
      reviewNote: record.reviewNote ?? '',
      createdAt: formatDateTimeInZone(record.createdAt, range.timezone),
    };
  });

  await writeAudit({
    actorUserId: current.id,
    action: 'EXPORT_DOWNLOADED',
    entityType: 'report',
    metadata: {
      report: 'leave',
      from: range.from,
      to: range.to,
      format: query.format,
      rows: rows.length,
      employeeId: query.employeeId ?? null,
    },
    req,
  });

  await sendTable(
    res,
    query.format,
    exportFilename('rekap-izin', range.from, range.to, query.format),
    'Rekap Izin',
    LEAVE_COLUMNS,
    rows,
  );
});
