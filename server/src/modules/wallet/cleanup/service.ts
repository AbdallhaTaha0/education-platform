import type { PrismaClient } from '@prisma/client';
import { audit } from '../../catalog/audit.js';
import { PROOF_RETENTION_DAYS } from '../errors.js';

export interface CleanupSummary {
  examined: number;
  cleared: number;
}

/**
 * Idempotent, replica-safe proof-retention cleanup (D21). Clears proof
 * BYTES whose request was reviewed more than PROOF_RETENTION_DAYS ago while
 * preserving metadata + sanitized audit trail. Safe under concurrency: the
 * compare-and-set update only clears rows that still hold bytes.
 */
export async function cleanupExpiredProofs(prisma: PrismaClient, batchLimit = 100, actorUserId = 'system'): Promise<CleanupSummary> {
  const deadline = new Date(Date.now() - PROOF_RETENTION_DAYS * 86_400_000);
  const candidates = await prisma.rechargeProof.findMany({
    where: {
      bytes: { not: null },
      request: { status: { in: ['APPROVED', 'REJECTED'] }, reviewedAt: { lt: deadline } },
    },
    select: { requestId: true },
    take: Math.min(Math.max(batchLimit, 1), 1000),
  });
  let cleared = 0;
  for (const candidate of candidates) {
    const didClear = await prisma.$transaction(async (tx) => {
      const done = await tx.rechargeProof.updateMany({
        where: { requestId: candidate.requestId, bytes: { not: null } },
        data: { bytes: null, cleanedAt: new Date() },
      });
      if (done.count === 0) return false;
      await audit(tx, {
        actorUserId, action: 'RECHARGE_PROOF_CLEANED',
        entityType: 'RechargeRequest', entityId: candidate.requestId,
        metadata: { retentionDays: PROOF_RETENTION_DAYS },
      });
      return true;
    });
    if (didClear) cleared += 1;
  }
  return { examined: candidates.length, cleared };
}
