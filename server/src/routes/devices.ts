import { Router } from 'express';
import { z } from 'zod';

import { writeAudit } from '../lib/audit';
import { toDeviceDto } from '../lib/dto';
import { actor } from '../lib/request-user';
import { authenticate } from '../middleware/auth';
import * as devices from '../services/device-service';

const revokeSchema = z.object({ deviceId: z.string().uuid() });

export const devicesRouter = Router();

devicesRouter.use(authenticate);

devicesRouter.get('/me', async (req, res) => {
  const current = actor(req);
  const rows = await devices.listMyDevices(current.id);
  res.json({ devices: rows.map(toDeviceDto) });
});

devicesRouter.post('/revoke', async (req, res) => {
  const body = revokeSchema.parse(req.body);
  const current = actor(req);
  const device = await devices.revokeMyDevice(current.id, body.deviceId);

  await writeAudit({
    actorUserId: current.id,
    action: 'DEVICE_REVOKED',
    entityType: 'device',
    entityId: device.id,
    metadata: { selfRevoked: true },
    req,
  });

  res.json({ device: toDeviceDto(device) });
});
