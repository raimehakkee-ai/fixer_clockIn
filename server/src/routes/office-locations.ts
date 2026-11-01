import { Router } from 'express';
import { z } from 'zod';

import { writeAudit } from '../lib/audit';
import { toOfficeDto } from '../lib/dto';
import { idParam } from '../lib/params';
import { actor } from '../lib/request-user';
import { timeZoneSchema } from '../lib/validation';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/require-role';
import * as offices from '../services/office-service';

const officeBaseSchema = z.object({
  name: z.string().trim().min(2).max(150),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(10).max(1000),
  timezone: timeZoneSchema,
});

const createOfficeSchema = officeBaseSchema.extend({
  isActive: z.boolean().default(true),
});

const updateOfficeSchema = officeBaseSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Minimal satu field harus diisi.',
  });

export const officeLocationsRouter = Router();

officeLocationsRouter.use(authenticate);

officeLocationsRouter.get('/', async (_req, res) => {
  const rows = await offices.listOffices();
  res.json({ data: rows.map(toOfficeDto) });
});

officeLocationsRouter.post('/', requireRole('ADMIN'), async (req, res) => {
  const body = createOfficeSchema.parse(req.body);
  const office = await offices.createOffice(body);
  const current = actor(req);

  await writeAudit({
    actorUserId: current.id,
    action: 'OFFICE_CREATED',
    entityType: 'office_location',
    entityId: office.id,
    metadata: { name: office.name },
    req,
  });

  res.status(201).json({ office: toOfficeDto(office) });
});

officeLocationsRouter.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const body = updateOfficeSchema.parse(req.body);
  const office = await offices.updateOffice(idParam(req), body);
  const current = actor(req);

  await writeAudit({
    actorUserId: current.id,
    action: 'OFFICE_UPDATED',
    entityType: 'office_location',
    entityId: office.id,
    metadata: { fields: Object.keys(body).join(',') },
    req,
  });

  res.json({ office: toOfficeDto(office) });
});

officeLocationsRouter.post(
  '/:id/activate',
  requireRole('ADMIN'),
  async (req, res) => {
    const office = await offices.activateOffice(idParam(req));
    const current = actor(req);

    await writeAudit({
      actorUserId: current.id,
      action: 'OFFICE_UPDATED',
      entityType: 'office_location',
      entityId: office.id,
      metadata: { activated: true },
      req,
    });

    res.json({ office: toOfficeDto(office) });
  },
);
