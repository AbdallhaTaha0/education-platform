import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { ApiError } from '../../identity/errors.js';
import { audit } from '../audit.js';
import type { DrmClient } from '../drmClient.js';
import type { ServerConfig } from '../../../config.js';
import { getLogger } from '../../../logger.js';
import { isDeletionLeaseOwner, withRenewingLease } from './lease.js';
import { finalizeMediaBackedTarget } from './finalizer.js';
import { assertUuid } from '../validation.js';
import { reconcileRetiredMedia } from '../media/retirement.js';

const DEFAULT_LEASE_TTL_MS = 30_000;

export interface DeletionCycleOptions {
  leaseTtlMs?: number;
}

export interface DeletionCycleOutcome {
  /** At least one external DRM call was issued by this owner. */
  acted: boolean;
  /** The operation reached COMPLETED (platform rows removed, evidence kept). */
  completed: boolean;
  /** Ownership was lost mid-cycle; work stopped, durable state left retryable. */
  leaseLost: boolean;
}

async function recordSchedule(
  prisma: PrismaClient,
  drm: DrmClient,
  operationId: string,
  asset: { id: string; drmAssetId: string | null; externalAssetId: string },
): Promise<'scheduled' | 'failed' | 'completed'> {
  if (asset.drmAssetId === null) return 'completed';
  try {
    const res = await drm.deleteMedia(asset.drmAssetId, asset.externalAssetId);
    await prisma.catalogDeletionAsset.update({
      where: { id: asset.id },
      data: {
        drmDeletionId: res.deletionId,
        lastState: res.status,
        attemptCount: { increment: 1 },
        lastCheckedAt: new Date(),
        errorCategory: null,
      },
    });
    return res.status === 'COMPLETED' ? 'completed' : 'scheduled';
  } catch (err) {
    const code = err instanceof ApiError ? err.code : 'DRM_UNKNOWN';
    await prisma.catalogDeletionAsset.update({
      where: { id: asset.id },
      data: {
        attemptCount: { increment: 1 },
        lastCheckedAt: new Date(),
        errorCategory: code,
        lastState: 'FAILED',
      },
    });
    return 'failed';
  }
}

async function recordPoll(
  prisma: PrismaClient,
  drm: DrmClient,
  asset: { id: string; drmDeletionId: string },
): Promise<boolean> {
  try {
    const remote = await drm.deletionStatus(asset.drmDeletionId);
    await prisma.catalogDeletionAsset.update({
      where: { id: asset.id },
      data: {
        lastState: remote.status,
        lastCheckedAt: new Date(),
        attemptCount: { increment: 1 },
        ...(remote.status === 'FAILED' ? { errorCategory: 'DRM_SERVER' } : { errorCategory: null }),
      },
    });
    return remote.status === 'COMPLETED';
  } catch (err) {
    const code = err instanceof ApiError ? err.code : 'DRM_UNKNOWN';
    await prisma.catalogDeletionAsset.update({
      where: { id: asset.id },
      data: { attemptCount: { increment: 1 }, lastCheckedAt: new Date(), errorCategory: code },
    });
    return false;
  }
}

/**
 * One shared deletion-work function for the request path, background
 * reconciliation, and explicit retry. The whole external-work interval runs
 * under a renewing token-checked lease: ownership is re-verified before
 * every external call and before finalization, and work stops on loss.
 * No database transaction ever spans external I/O.
 */
export async function runDeletionCycle(
  prisma: PrismaClient,
  drm: DrmClient,
  redis: Redis,
  operationId: string,
  opts: DeletionCycleOptions = {},
): Promise<DeletionCycleOutcome> {
  assertUuid(operationId, 'operationId');
  const ttlMs = opts.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS;
  const outcome = await withRenewingLease(redis, operationId, ttlMs, async (scope) => {
    const op = await prisma.catalogDeletionOperation.findUnique({
      where: { id: operationId },
      include: { assets: true },
    });
    if (op === null || op.status === 'COMPLETED')
      return { acted: false, completed: op?.status === 'COMPLETED', leaseLost: false };
    const wasAlreadyFailed = op.status === 'FAILED';
    let acted = false;
    let allCompleted = true;
    for (const asset of op.assets) {
      if (scope.lost || !(await isDeletionLeaseOwner(redis, scope.lease))) {
        return { acted, completed: false, leaseLost: true };
      }
      if (asset.drmDeletionId === null) {
        const scheduled = await recordSchedule(prisma, drm, operationId, asset);
        acted = true;
        if (scheduled !== 'completed') allCompleted = false;
        continue;
      }
      acted = true;
      const done = await recordPoll(prisma, drm, {
        id: asset.id,
        drmDeletionId: asset.drmDeletionId,
      });
      if (!done) allCompleted = false;
    }
    if (!allCompleted) {
      if (scope.lost) return { acted, completed: false, leaseLost: true };
      const failed = await prisma.catalogDeletionAsset.count({
        where: { operationId, lastState: 'FAILED' },
      });
      await prisma.catalogDeletionOperation.update({
        where: { id: operationId },
        data: {
          status: failed > 0 ? 'FAILED' : 'RUNNING',
          ...(failed > 0 ? { errorCategory: 'DRM_SERVER' } : { errorCategory: null }),
        },
      });
      // Exactly one failure audit per operation: only on transition into FAILED.
      if (failed > 0 && !wasAlreadyFailed && acted) {
        await audit(prisma, {
          actorUserId: op.requestedBy,
          action: 'DELETION_FAILED',
          entityType: op.targetType as string,
          entityId: op.targetId,
          metadata: { operationId, errorCategory: 'DRM_SERVER' },
        });
      }
      return { acted, completed: false, leaseLost: false };
    }
    if (scope.lost || !(await isDeletionLeaseOwner(redis, scope.lease))) {
      return { acted, completed: false, leaseLost: true };
    }
    const done = await finalizeMediaBackedTarget(prisma, operationId);
    return { acted, completed: done, leaseLost: false };
  });
  if (!outcome.owned) return { acted: false, completed: false, leaseLost: false };
  return outcome.value;
}

/** Lease-guarded single-operation reconcile. Only the owner polls externally. */
export async function reconcileOperationWithLease(
  prisma: PrismaClient,
  config: ServerConfig,
  drmFactory: (cfg: ServerConfig) => DrmClient | null,
  redis: Redis,
  operationId: string,
  opts: DeletionCycleOptions = {},
): Promise<boolean> {
  assertUuid(operationId, 'operationId');
  const drm = drmFactory(config);
  if (drm === null) {
    await prisma.catalogDeletionOperation.update({
      where: { id: operationId },
      data: { status: 'FAILED', errorCategory: 'DRM_UNCONFIGURED' },
    });
    return false;
  }
  const outcome = await runDeletionCycle(prisma, drm, redis, operationId, opts);
  return outcome.completed;
}

/** Bounded batch reconcile; each op claimed independently via Redis lease. */
export async function reconcilePendingOperations(
  prisma: PrismaClient,
  config: ServerConfig,
  drmFactory: (cfg: ServerConfig) => DrmClient | null,
  redis: Redis,
  batchLimit = 10,
  opts: DeletionCycleOptions = {},
): Promise<{ checked: number; completed: number }> {
  const pending = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM "CatalogDeletionOperation" WHERE status IN ('PENDING','RUNNING') ORDER BY "createdAt" ASC LIMIT ${batchLimit}`,
  );
  let completed = 0;
  for (const row of pending) {
    const before = await prisma.catalogDeletionOperation.findUnique({
      where: { id: row.id },
      select: { status: true },
    });
    const done = await reconcileOperationWithLease(prisma, config, drmFactory, redis, row.id, opts);
    const after = await prisma.catalogDeletionOperation.findUnique({
      where: { id: row.id },
      select: { status: true },
    });
    if (done && before?.status !== 'COMPLETED' && after?.status === 'COMPLETED') completed += 1;
  }
  return { checked: pending.length, completed };
}

export async function retryDeletionOperation(
  prisma: PrismaClient,
  config: ServerConfig,
  drmFactory: (cfg: ServerConfig) => DrmClient | null,
  redis: Redis,
  actorId: string,
  operationId: string,
) {
  assertUuid(operationId, 'operationId');
  const op = await prisma.catalogDeletionOperation.findUnique({ where: { id: operationId } });
  if (op === null) throw new ApiError(404, 'DELETION_NOT_FOUND', 'Deletion operation not found.');
  if (op.status === 'COMPLETED')
    throw new ApiError(409, 'INVALID_TRANSITION', 'Deletion already completed.');
  if (op.status === 'FAILED') {
    await prisma.catalogDeletionOperation.update({
      where: { id: operationId },
      data: { status: 'RUNNING', errorCategory: null },
    });
    await audit(prisma, {
      actorUserId: actorId,
      action: 'DELETION_RETRIED',
      entityType: op.targetType as string,
      entityId: op.targetId,
      metadata: { operationId },
    });
  }
  await reconcileOperationWithLease(prisma, config, drmFactory, redis, operationId);
  return prisma.catalogDeletionOperation.findUnique({
    where: { id: operationId },
    include: { assets: true },
  });
}

export function startDeletionReconciler(
  prisma: PrismaClient,
  config: ServerConfig,
  drmFactory: (cfg: ServerConfig) => DrmClient | null,
  redis: Redis,
  intervalMs = 15000,
): { stop: () => void } {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await reconcilePendingOperations(prisma, config, drmFactory, redis, 10);
      await reconcileRetiredMedia(prisma, drmFactory(config), redis);
    } catch (err) {
      getLogger().warn({ err: (err as Error).message }, 'catalog deletion reconcile tick failed');
    } finally {
      if (!stopped) timer = setTimeout(() => void tick(), intervalMs);
    }
  };
  timer = setTimeout(() => void tick(), 3000);
  return {
    stop: () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
    },
  };
}
