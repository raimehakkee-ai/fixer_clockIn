import { Router } from 'express';
import { z } from 'zod';

import { writeAudit } from '../lib/audit';
import { toShiftDto } from '../lib/dto';
import { idParam } from '../lib/params';
import { actor } from '../lib/request-user';
import { hhmmSchema } from '../lib/validation';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/require-role';
import * as shifts from '../services/shift-service';

const shiftBaseSchema = z.object({
  name: z.string().trim().min(2).max(50),
  startTime: hhmmSchema,
  endTime: hhmmSchema,
  toleranceMinutes: z.number().int().min(0).max(120),
  earlyWindowMinutes: z.number().int().min(0).max(480),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
});

const createShiftSchema = shiftBaseSchema.extend({
  toleranceMinutes: z.number().int().min(0).max(120).default(15),
  earlyWindowMinutes: z.number().int().min(0).max(480).default(120),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

const updateShiftSchema = shiftBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Minimal satu field harus diisi.',
  });

export const shiftsRouter = Router();

shiftsRouter.use(authenticate);

shiftsRouter.get('/', async (req, res) => {
  const current = actor(req);
  const includeInactive =
    current.role === 'ADMIN' && req.query.includeInactive === 'true';

  const rows = await shifts.listShifts(includeInactive);
  res.json({ data: rows.map(toShiftDto) });
});

shiftsRouter.post('/', requireRole('ADMIN'), async (req, res) => {
  const body = createShiftSchema.parse(req.body);
  const shift = await shifts.createShift(body);
  const current = actor(req);

  await writeAudit({
    actorUserId: current.id,
    action: 'SHIFT_CREATED',
    entityType: 'shift',
    entityId: shift.id,
    metadata: { name: shift.name },
    req,
  });

  res.status(201).json({ shift: toShiftDto(shift) });
});

shiftsRouter.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const body = updateShiftSchema.parse(req.body);
  const shift = await shifts.updateShift(idParam(req), body);
  const current = actor(req);

  await writeAudit({
    actorUserId: current.id,
    action: 'SHIFT_UPDATED',
    entityType: 'shift',
    entityId: shift.id,
    metadata: { fields: Object.keys(body).join(',') },
    req,
  });

  res.json({ shift: toShiftDto(shift) });
});
