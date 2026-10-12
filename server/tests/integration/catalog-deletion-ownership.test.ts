import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { StorageClient } from '../../src/infra/storage.js';
import {
  acquireDeletionLease,
  isDeletionLeaseOwner,
  releaseDeletionLease,
  renewDeletionLease,
} from '../../src/modules/catalog/deletion/lease.js';
import {
  runDeletionCycle,
} from '../../src/modules/catalog/deletion/reconciler.js';
import {
  createCatalogWorld,
  createFullDraft,
  type CatalogWorld,
} from './catalog-helpers.js';

let world: CatalogWorld;

beforeAll(async () => {
  world = await createCatalogWorld();
});

afterAll(async () => {
  await world.close();
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deletionOperation(suffix: string, assetCount = 1): Promise<string> {
  const ids = await createFullDraft(world, suffix);
  const lessonIds = [ids.lessonId];
  for (let index = 1; index < assetCount; index += 1) {
    const section = await world.prisma.courseSection.findFirstOrThrow({ where: { courseId: ids.courseId } });
    const lesson = await world.prisma.lesson.create({ data: { sectionId: section.id, titleAr: `درس ${index + 1}`, titleEn: `Lesson ${index + 1}`, position: index + 1 } });
    lessonIds.push(lesson.id);
  }
  const mappings = [];
  for (const lessonId of lessonIds) {
    const assetId = randomUUID();
    mappings.push(await world.prisma.mediaMapping.create({ data: { lessonId, assetId, externalAssetId: assetId, idempotencyKey: randomUUID(), status: 'DELETION_PENDING' } }));
  }
  await world.prisma.course.update({ where: { id: ids.courseId }, data: { deletionRequestedAt: new Date() } });
  const operation = await world.prisma.catalogDeletionOperation.create({ data: { targetType: 'COURSE', targetId: ids.courseId, courseId: ids.courseId, requestedBy: world.adminUser.id, status: 'RUNNING' } });
  await world.prisma.catalogDeletionAsset.createMany({ data: mappings.map(mapping => ({ operationId: operation.id, mappingId: mapping.id, drmAssetId: mapping.assetId, externalAssetId: mapping.externalAssetId, lastState: 'PENDING' })) });
  return operation.id;
}

function storageThatDeletes(deleteObject: () => Promise<void>): StorageClient {
  return { deleteObject } as unknown as StorageClient;
}

describe('leased private-storage deletion ownership', () => {
  it('concurrent workers produce one object deletion for an operation', async () => {
    const opId = await deletionOperation('own-race');
    let calls = 0;
    const storage = storageThatDeletes(async () => { calls += 1; await sleep(500); });
    const first = runDeletionCycle(world.prisma, null, storage, world.redis, opId);
    await sleep(200);
    const second = await runDeletionCycle(world.prisma, null, storage, world.redis, opId);
    const outcome = await first;
    expect(calls).toBe(1);
    expect(outcome.completed).toBe(true);
    expect(second.acted).toBe(false);
  });

  it('renews the lease while object deletion exceeds its original TTL', async () => {
    const opId = await deletionOperation('own-renew', 2);
    const storage = storageThatDeletes(() => sleep(500));
    const cycle = runDeletionCycle(world.prisma, null, storage, world.redis, opId, { leaseTtlMs: 300 });
    for (let elapsed = 150; elapsed <= 900; elapsed += 150) {
      await sleep(150);
      expect(await acquireDeletionLease(world.redis, opId, 5000)).toBeNull();
    }
    const outcome = await cycle;
    expect(outcome.leaseLost).toBe(false);
    expect(outcome.acted).toBe(true);
  });

  it('manual renewal extends ownership past the original TTL', async () => {
    const probe = 'ownership-manual-renew';
    const lease = await acquireDeletionLease(world.redis, probe, 300);
    expect(lease).not.toBeNull();
    await sleep(200);
    expect(await renewDeletionLease(world.redis, lease!)).toBe(true);
    await sleep(200);
    // t=400ms exceeds the original 300ms TTL: only renewal kept it alive.
    expect(await renewDeletionLease(world.redis, lease!)).toBe(true);
    expect(await isDeletionLeaseOwner(world.redis, lease!)).toBe(true);
    expect(await acquireDeletionLease(world.redis, probe, 5000)).toBeNull();
    await releaseDeletionLease(world.redis, lease!);
    expect(await acquireDeletionLease(world.redis, probe, 5000)).not.toBeNull();
  });

  it('stale token can neither renew nor release a newer owner lease', async () => {
    const probe = 'ownership-stale-probe';
    const first = await acquireDeletionLease(world.redis, probe, 300);
    expect(first).not.toBeNull();
    await sleep(500);
    const second = await acquireDeletionLease(world.redis, probe, 5000);
    expect(second).not.toBeNull();
    expect(await renewDeletionLease(world.redis, first!)).toBe(false);
    await releaseDeletionLease(world.redis, { ...first!, ttlMs: 300 });
    expect(await isDeletionLeaseOwner(world.redis, second!)).toBe(true);
    expect(await acquireDeletionLease(world.redis, probe, 5000)).toBeNull();
    await releaseDeletionLease(world.redis, second!);
    expect(await acquireDeletionLease(world.redis, probe, 5000)).not.toBeNull();
  });

  it('restart recovery completes idempotently with a single completion audit', async () => {
    const opId = await deletionOperation('own-restart');
    const op = await world.prisma.catalogDeletionOperation.findUniqueOrThrow({ where: { id: opId } });
    let attempts = 0;
    const unavailable = storageThatDeletes(async () => { attempts += 1; throw new Error('temporary storage outage'); });
    const failed = await runDeletionCycle(world.prisma, null, unavailable, world.redis, opId);
    expect(failed.completed).toBe(false);
    const storage = storageThatDeletes(async () => { attempts += 1; });
    const recovered = await runDeletionCycle(world.prisma, null, storage, world.redis, opId);
    expect(recovered.completed).toBe(true);
    expect(attempts).toBe(2);
    expect(
      (await world.prisma.catalogDeletionOperation.findUniqueOrThrow({ where: { id: opId } }))
        .status,
    ).toBe('COMPLETED');
    // Re-running after completion is a no-op and adds no audits.
    const auditsBefore = await world.prisma.auditEvent.count({
      where: { entityId: op.targetId, action: 'DELETION_COMPLETED' },
    });
    expect(auditsBefore).toBe(1);
    await runDeletionCycle(world.prisma, null, storage, world.redis, opId);
    await runDeletionCycle(world.prisma, null, storage, world.redis, opId);
    expect(
      await world.prisma.auditEvent.count({
        where: { entityId: op.targetId, action: 'DELETION_COMPLETED' },
      }),
    ).toBe(1);
    expect(await world.prisma.course.findUnique({ where: { id: op.targetId } })).toBeNull();
  });
});
