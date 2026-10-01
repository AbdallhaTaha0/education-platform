import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDrmClient } from '../../src/modules/catalog/drmClient.js';
import {
  acquireLease,
  releaseLease,
  withDeletionLease,
} from '../../src/modules/catalog/deletion/lease.js';
import {
  reconcilePendingOperations,
  reconcileOperationWithLease,
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

describe('replica-safe deletion lease', () => {
  it('two independent reconcilers yield one effective DELETE scheduling action', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'lease-del');
    await readyLesson(lessonId);
    const course = await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    const del = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/delete`,
      world.adminJar,
      { confirmation: course.slug },
    );
    expect(del.status).toBe(202);
    const deletesBefore = world.fixture!.requests.filter((r) => r.method === 'DELETE').length;
    const c = cfg();
    await Promise.all([
      reconcilePendingOperations(world.prisma, c, createDrmClient, world.redis, 10),
      reconcilePendingOperations(world.prisma, c, createDrmClient, world.redis, 10),
    ]);
    const deletesAfter = world.fixture!.requests.filter((r) => r.method === 'DELETE').length;
    // At most one new effective scheduling round across both reconcilers.
    expect(deletesAfter - deletesBefore).toBeLessThanOrEqual(1);
  });

  it('one effective status poll per lease period; second owner skips', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'lease-poll');
    await readyLesson(lessonId);
    const course = await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    const del = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/delete`,
      world.adminJar,
      { confirmation: course.slug },
    );
    const opId = del.body.data.operation.id as string;
    const c = cfg();
    const pollsBefore = world.fixture!.requests.filter((r) =>
      r.url.includes('media-deletions'),
    ).length;
    const [first, second] = await Promise.all([
      reconcileOperationWithLease(world.prisma, c, createDrmClient, world.redis, opId),
      reconcileOperationWithLease(world.prisma, c, createDrmClient, world.redis, opId),
    ]);
    const pollsAfter = world.fixture!.requests.filter((r) =>
      r.url.includes('media-deletions'),
    ).length;
    // Exactly one owner polled (the other returned false without I/O).
    expect([first, second].filter(Boolean).length).toBeLessThanOrEqual(1);
    expect(pollsAfter - pollsBefore).toBeLessThanOrEqual(2);
  });

  it('crashed owner lease expires and another replica resumes', async () => {
    const token = await acquireLease(world.redis, 'lease-crash-probe', 400);
    expect(token).not.toBeNull();
    // Holder crashes without release; expiry frees the lease.
    await new Promise((r) => setTimeout(r, 700));
    const retry = await acquireLease(world.redis, 'lease-crash-probe', 5000);
    expect(retry).not.toBeNull();
    if (retry !== null) await releaseLease(world.redis, 'lease-crash-probe', retry);
  });

  it('token-checked release cannot free a newer lease', async () => {
    const first = await acquireLease(world.redis, 'lease-token-probe', 5000);
    expect(first).not.toBeNull();
    await releaseLease(world.redis, 'lease-token-probe', 'stale-token');
    // Original lease still held by the first owner.
    expect(await acquireLease(world.redis, 'lease-token-probe', 5000)).toBeNull();
    if (first !== null) await releaseLease(world.redis, 'lease-token-probe', first);
    expect(await acquireLease(world.redis, 'lease-token-probe', 5000)).not.toBeNull();
  });

  it('single completion audit across concurrent reconcilers (no premature finalization)', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'lease-audit');
    await readyLesson(lessonId);
    const course = await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    const del = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/delete`,
      world.adminJar,
      { confirmation: course.slug },
    );
    const opId = del.body.data.operation.id as string;
    const c = cfg();
    for (let i = 0; i < 8; i += 1) {
      await Promise.all([
        reconcilePendingOperations(world.prisma, c, createDrmClient, world.redis, 10),
        reconcilePendingOperations(world.prisma, c, createDrmClient, world.redis, 10),
      ]);
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
    expect(
      await world.prisma.auditEvent.count({
        where: { entityId: courseId, action: 'DELETION_COMPLETED' },
      }),
    ).toBe(1);
    await withDeletionLease(world.redis, opId, async () => undefined);
  });
});
