import { Router } from 'express';
import { z } from 'zod';

import { paginated } from '../lib/pagination';
import { dateStringSchema, paginationSchema } from '../lib/validation';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/require-role';
import { listAuditLogs } from '../services/audit-service';

const auditQuerySchema = paginationSchema.extend({
  action: z.string().trim().max(64).optional(),
  actorId: z.string().uuid().optional(),
  entityType: z.string().trim().max(64).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

export const auditLogsRouter = Router();

auditLogsRouter.use(authenticate);
auditLogsRouter.use(requireRole('ADMIN'));

auditLogsRouter.get('/', async (req, res) => {
  const query = auditQuerySchema.parse(req.query);
  const { rows, total } = await listAuditLogs(query);

  const data = rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata,
    actor: row.actor ? { id: row.actor.id, email: row.actor.email } : null,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
  }));

  res.json(paginated(data, total, query));
});
