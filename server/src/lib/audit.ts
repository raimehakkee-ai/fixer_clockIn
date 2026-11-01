import type { Request } from 'express';

import { prisma } from '../db';

export type AuditMetadata = Record<string, string | number | boolean | null>;

export type AuditInput = {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: AuditMetadata;
  req?: Request;
};

/**
 * Audit log tidak boleh menggagalkan alur bisnis. Kegagalan pencatatan
 * dilaporkan ke stderr tanpa menyertakan data sensitif.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : {},
        ipAddress: input.req?.ip ?? null,
        userAgent: input.req?.get('user-agent')?.slice(0, 255) ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] gagal menulis audit log', {
      action: input.action,
      entityType: input.entityType,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
}
