import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDrmClient } from '../../src/modules/catalog/drmClient.js';
import {
  acquireDeletionLease,
  isDeletionLeaseOwner,
  releaseDeletionLease,
  renewDeletionLease,
} from '../../src/modules/catalog/deletion/lease.js';
import {
  reconcilePendingOperations,
  runDeletionCycle,
} from '../../src/modules/catalog/deletion/reconciler.js';
import {
  adminPost,
  createCatalogWorld,
  createFullDraft,
  type CatalogWorld,
} from './catalog-helpers.js';
import { loadConfig } from '../../src/config.js';

let world: CatalogWorld;

beforeAll(async () => {
  world = await createCatalogWorld(true);
});

afterAll(async () => {
  await world.fixture?.stop();
  await world.close();
});

function cfg() {
  const config = loadConfig(process.env);
  return {
    ...config,
    drmBaseUrl: world.fixture!.url,
    drmClientId: world.fixture!.expectedClientId,
    drmClientSecret: world.fixture!.expectedClientSecret,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readyLesson(lessonId: string): Promise<void> {
  await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media`, world.adminJar, {
    contentType: 'video/mp4',
    securityTier: 'STANDARD',
  });
  await adminPost(
    world.app,
    `/admin/catalog/lessons/${lessonId}/media/complete`,
    world.adminJar,
    {},
  );
  const mapping = await world.prisma.mediaMapping.findFirstOrThrow({ where: { lessonId } });
  world.fixture!.markReady(mapping.assetId as string);
  await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media/sync`, world.adminJar, {});
}

async function requestCourseDeletion(courseId: string, slug: string) {
  const del = await adminPost(
    world.app,
    `/admin/catalog/courses/${courseId}/delete`,
    world.adminJar,
    { confirmation: slug },
  );
  expect(del.status).toBe(202);
  return del.body.data.operation.id as string;
}

function deleteRequestCount(): number {
  return world.fixture!.requests.filter((r) => r.method === 'DELETE').length;
}

describe('leased deletion ownership', () => {
  it('delayed initial request racing a reconciler produces exactly one external DELETE', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'own-race');
    await readyLesson(lessonId);
    const course = await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    // Delay stays below the test env's 1000ms DRM client timeout so the
    // adapter itself never retries: any second DELETE would be a lease bug.
    world.fixture!.delayMs = 500;
    try {
      const before = deleteRequestCount();
      const [requested, reconciled] = await Promise.all([
        adminPost(world.app, `/admin/catalog/courses/${courseId}/delete`, world.adminJar, {
          confirmation: course.slug,
        }),
        (async () => {
          await sleep(200);
          return reconcilePendingOperations(world.prisma, cfg(), createDrmClient, world.redis, 10);
        })(),
      ]);
      expect(requested.status).toBe(202);
      expect(deleteRequestCount() - before).toBe(1);
      void reconciled;
    } finally {
      world.fixture!.delayMs = 0;
    }
  });

  it('lease is renewed while work exceeds its original TTL', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'own-renew');
    await readyLesson(lessonId);
    const section = await world.prisma.courseSection.findFirstOrThrow({ where: { courseId } });
    const l2 = await adminPost(
      world.app,
      `/admin/catalog/sections/${section.id}/lessons`,
      world.adminJar,
      { titleAr: 'درس ثان', titleEn: 'Lesson two' },
    );
    await readyLesson(l2.body.data.lesson.id as string);
    const course = await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    const opId = await requestCourseDeletion(courseId, course.slug);
    // Slow every external call so one cycle (2 polls) outlives a short lease.
    // Delays stay below the 1000ms client timeout: no adapter retry interferes.
    world.fixture!.delayMs = 500;
    try {
      const drm = createDrmClient(cfg())!;
      const cycle = runDeletionCycle(world.prisma, drm, world.redis, opId, { leaseTtlMs: 300 });
      // Throughout the post-TTL window the lease must stay held (renewed).
      for (let elapsed = 400; elapsed <= 1000; elapsed += 150) {
        await sleep(150);
        expect(await acquireDeletionLease(world.redis, opId, 5000)).toBeNull();
      }
      const outcome = await cycle;
      expect(outcome.leaseLost).toBe(false);
      expect(outcome.acted).toBe(true);
    } finally {
      world.fixture!.delayMs = 0;
    }
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
    const { courseId, lessonId } = await createFullDraft(world, 'own-restart');
    await readyLesson(lessonId);
    const course = await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    const opId = await requestCourseDeletion(courseId, course.slug);
    const drm = createDrmClient(cfg())!;
    for (let i = 0; i < 8; i += 1) {
      await runDeletionCycle(world.prisma, drm, world.redis, opId);
      if (
        (await world.prisma.catalogDeletionOperation.findUniqueOrThrow({ where: { id: opId } }))
          .status === 'COMPLETED'
      )
        break;
    }
    expect(
      (await world.prisma.catalogDeletionOperation.findUniqueOrThrow({ where: { id: opId } }))
        .status,
    ).toBe('COMPLETED');
    // Re-running after completion is a no-op and adds no audits.
    const auditsBefore = await world.prisma.auditEvent.count({
      where: { entityId: courseId, action: 'DELETION_COMPLETED' },
    });
    expect(auditsBefore).toBe(1);
    await runDeletionCycle(world.prisma, drm, world.redis, opId);
    await runDeletionCycle(world.prisma, drm, world.redis, opId);
    expect(
      await world.prisma.auditEvent.count({
        where: { entityId: courseId, action: 'DELETION_COMPLETED' },
      }),
    ).toBe(1);
    expect(await world.prisma.course.findUnique({ where: { id: courseId } })).toBeNull();
  });
});
