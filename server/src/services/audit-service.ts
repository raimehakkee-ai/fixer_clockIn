import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../db';
import { skipFor } from '../lib/pagination';

export type AuditQuery = {
  action?: string;
  actorId?: string;
  entityType?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
};

export async function listAuditLogs(query: AuditQuery) {
  const where: Prisma.AuditLogWhereInput = {};

  if (query.action) where.action = query.action;
  if (query.actorId) where.actorUserId = query.actorId;
  if (query.entityType) where.entityType = query.entityType;

  if (query.from || query.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) createdAt.lte = new Date(`${query.to}T23:59:59.999Z`);
    where.createdAt = createdAt;
  }

  const [rows, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: skipFor(query),
      take: query.limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { rows, total };
}
