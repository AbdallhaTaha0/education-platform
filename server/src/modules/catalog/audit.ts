import type { Prisma, PrismaClient } from '@prisma/client';
import { sanitizeForLog } from '../../logger.js';
import type { DbClient } from './types.js';

export interface AuditEntry {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/** Sanitized audit writer. Metadata never carries secrets (enforced here). */
export async function audit(prisma: DbClient, entry: AuditEntry): Promise<void> {
  const client = prisma as PrismaClient;
  const metadata =
    entry.metadata === undefined ? undefined : (sanitizeForLog(entry.metadata) as Prisma.InputJsonValue);
  await client.auditEvent.create({
    data: {
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      ...(metadata === undefined ? {} : { metadata }),
    },
  });
}
