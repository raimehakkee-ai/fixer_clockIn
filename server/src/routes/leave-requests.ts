import { Router, type Request } from 'express';
import { z } from 'zod';

import { writeAudit } from '../lib/audit';
import { toLeaveDto } from '../lib/dto';
import { ApiError } from '../lib/errors';
import {
  ATTACHMENT_TYPES,
  detectFileType,
  isAllowedType,
} from '../lib/image';
import { idParam } from '../lib/params';
import { paginated } from '../lib/pagination';
import { actor, actorEmployeeId } from '../lib/request-user';
import {
  dateStringSchema,
  paginationSchema,
} from '../lib/validation';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { requireRole } from '../middleware/require-role';
import { attachmentUpload } from '../middleware/upload';
import * as leaves from '../services/leave-service';

const leaveTypeSchema = z.enum(['SICK', 'ANNUAL', 'PERMISSION', 'OTHER']);
const leaveStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);

const createLeaveSchema = z
  .object({
    type: leaveTypeSchema,
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    reason: z.string().trim().min(10).max(2000),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: 'Tanggal selesai harus sama atau setelah tanggal mulai.',
    path: ['endDate'],
  });

const mineQuerySchema = paginationSchema.extend({
  status: leaveStatusSchema.optional(),
});

const adminQuerySchema = mineQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

const approveSchema = z.object({
  reviewNote: z.string().trim().max(2000).optional(),
});

const rejectSchema = z.object({
  reviewNote: z.string().trim().min(3).max(2000),
});

const createLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  key: (req) => req.user?.id ?? req.ip ?? 'unknown',
  message: 'Batas pengajuan per hari tercapai. Coba lagi besok.',
});

function requireAttachment(req: Request): leaves.LeaveAttachment | null {
  const file = req.file;

  if (!file) {
    return null;
  }

  if (file.size === 0) {
    throw ApiError.badRequest('Lampiran kosong.');
  }

  const detected = detectFileType(file.buffer);

  if (!isAllowedType(detected, ATTACHMENT_TYPES)) {
    throw ApiError.badRequest(
      'Lampiran harus berupa gambar JPEG/PNG atau PDF yang valid.',
    );
  }

  return {
    buffer: file.buffer,
    mime: detected as 'image/jpeg' | 'image/png' | 'application/pdf',
  };
}

export const leaveRequestsRouter = Router();

leaveRequestsRouter.use(authenticate);

leaveRequestsRouter.get('/me', requireRole('EMPLOYEE'), async (req, res) => {
  const employeeId = actorEmployeeId(req);
  const query = mineQuerySchema.parse(req.query);

  const { rows, total } = await leaves.listMyLeaves(employeeId, query);

  res.json(paginated(rows.map(toLeaveDto), total, query));
});

leaveRequestsRouter.get('/', requireRole('ADMIN'), async (req, res) => {
  const query = adminQuerySchema.parse(req.query);
  const { rows, total } = await leaves.listLeaves(query);

  res.json(paginated(rows.map(toLeaveDto), total, query));
});

leaveRequestsRouter.post(
  '/',
  requireRole('EMPLOYEE'),
  createLimiter,
  attachmentUpload.single('attachment'),
  async (req, res) => {
    const current = actor(req);
    const employeeId = actorEmployeeId(req);
    const body = createLeaveSchema.parse(req.body);
    const attachment = requireAttachment(req);

    const leave = await leaves.createLeave({
      employeeId,
      type: body.type,
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason,
      attachment,
    });

    await writeAudit({
      actorUserId: current.id,
      action: 'LEAVE_CREATED',
      entityType: 'leave_request',
      entityId: leave.id,
      metadata: {
        type: body.type,
        startDate: body.startDate,
        endDate: body.endDate,
      },
      req,
    });

    res.status(201).json({ leave: toLeaveDto(leave) });
  },
);

leaveRequestsRouter.post(
  '/:id/approve',
  requireRole('ADMIN'),
  async (req, res) => {
    const body = approveSchema.parse(req.body ?? {});
    const current = actor(req);

    const leave = await leaves.decideLeave(
      idParam(req),
      current.id,
      'APPROVED',
      body.reviewNote ?? null,
    );

    await writeAudit({
      actorUserId: current.id,
      action: 'LEAVE_APPROVED',
      entityType: 'leave_request',
      entityId: leave.id,
      metadata: { type: leave.type, noteProvided: Boolean(body.reviewNote) },
      req,
    });

    res.json({ leave: toLeaveDto(leave) });
  },
);

leaveRequestsRouter.post(
  '/:id/reject',
  requireRole('ADMIN'),
  async (req, res) => {
    const body = rejectSchema.parse(req.body ?? {});
    const current = actor(req);

    const leave = await leaves.decideLeave(
      idParam(req),
      current.id,
      'REJECTED',
      body.reviewNote,
    );

    await writeAudit({
      actorUserId: current.id,
      action: 'LEAVE_REJECTED',
      entityType: 'leave_request',
      entityId: leave.id,
      metadata: { type: leave.type },
      req,
    });

    res.json({ leave: toLeaveDto(leave) });
  },
);

leaveRequestsRouter.post(
  '/:id/cancel',
  requireRole('EMPLOYEE'),
  async (req, res) => {
    const current = actor(req);
    const leave = await leaves.cancelLeave(idParam(req), current);

    await writeAudit({
      actorUserId: current.id,
      action: 'LEAVE_CANCELLED',
      entityType: 'leave_request',
      entityId: leave.id,
      metadata: { type: leave.type },
      req,
    });

    res.json({ leave: toLeaveDto(leave) });
  },
);

leaveRequestsRouter.get('/:id/attachment', async (req, res) => {
  const result = await leaves.readLeaveAttachment(
    idParam(req),
    actor(req),
  );

  res.setHeader('Content-Type', result.mime);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (result.mime === 'application/pdf') {
    // PDF tidak dijalankan inline di origin admin.
    res.setHeader('Content-Disposition', 'attachment; filename="lampiran.pdf"');
  }
  res.send(result.buffer);
});

leaveRequestsRouter.get('/:id', async (req, res) => {
  const leave = await leaves.getLeaveForAccess(idParam(req), actor(req));
  res.json({ leave: toLeaveDto(leave) });
});
