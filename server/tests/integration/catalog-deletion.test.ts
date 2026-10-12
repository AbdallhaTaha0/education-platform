import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createStorageClient } from '../../src/infra/storage.js';
import { reconcilePendingOperations } from '../../src/modules/catalog/deletion/reconciler.js';
import {
  adminPost,
  registerTestVideo,
  uploadTestVideo,
  createCatalogWorld,
  createFullDraft,
  type CatalogWorld,
} from './catalog-helpers.js';

let world: CatalogWorld;

beforeAll(async () => {
  world = await createCatalogWorld(false);
});

afterAll(async () => {
  await world.close();
});

async function publishCourse(courseId: string, lessonId: string): Promise<string> {
  const registration = await registerTestVideo(world, lessonId);
  await uploadTestVideo(registration.uploadUrl);
  await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media/complete`, world.adminJar, {});
  await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media/sync`, world.adminJar, {});
  await adminPost(world.app, `/admin/catalog/courses/${courseId}/transitions`, world.adminJar, { to: 'PROCESSING' });
  await adminPost(world.app, `/admin/catalog/courses/${courseId}/transitions`, world.adminJar, { to: 'READY' });
  await adminPost(world.app, `/admin/catalog/courses/${courseId}/transitions`, world.adminJar, { to: 'PUBLISHED' });
  const full = await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  return full.slug;
}

describe('permanent-deletion coordination', () => {
  it('removes private video objects before finalizing course deletion', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'delvis');
    const slug = await publishCourse(courseId, lessonId);
    expect((await request(world.app).get(`/catalog/courses/${slug}`)).status).toBe(200);
    const del = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/delete`,
      world.adminJar,
      { confirmation: slug },
    );
    expect(del.status).toBe(202);
    const opId = del.body.data.operation.id as string;
    expect((await request(world.app).get(`/catalog/courses/${slug}`)).status).toBe(404);
    expect(await world.prisma.course.findUnique({ where: { id: courseId } })).toBeNull();
    const op = await world.prisma.catalogDeletionOperation.findUniqueOrThrow({
      where: { id: opId },
      include: { assets: true },
    });
    expect(op.assets.length).toBe(1);
    expect(op.status).toBe('COMPLETED');
    expect(op.assets[0]?.lastState).toBe('COMPLETED');
    expect(await createStorageClient(world.config)!.headObject(`lesson-videos/${op.assets[0]!.drmAssetId}`)).toBeNull();
  });

  it('deletes every private video object and retains completion evidence', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'delmulti');
    const section = await world.prisma.courseSection.findFirstOrThrow({ where: { courseId } });
    const l2 = await adminPost(
      world.app,
      `/admin/catalog/sections/${section.id}/lessons`,
      world.adminJar,
      { titleAr: 'درس ثان', titleEn: 'Lesson two' },
    );
    const lesson2 = l2.body.data.lesson.id as string;
    const slug = await publishCourse(courseId, lessonId);
    const registration2 = await registerTestVideo(world, lesson2);
    await uploadTestVideo(registration2.uploadUrl);
    await adminPost(world.app, `/admin/catalog/lessons/${lesson2}/media/complete`, world.adminJar, {});
    await adminPost(world.app, `/admin/catalog/lessons/${lesson2}/media/sync`, world.adminJar, {});
    const del = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/delete`,
      world.adminJar,
      { confirmation: slug },
    );
    expect(del.status).toBe(202);
    const opId = del.body.data.operation.id as string;
    expect(
      (await world.prisma.catalogDeletionOperation.findUniqueOrThrow({ where: { id: opId } }))
        .status,
    ).toBe('COMPLETED');
    expect(await world.prisma.course.findUnique({ where: { id: courseId } })).toBeNull();
    const retained = await world.prisma.catalogDeletionOperation.findUniqueOrThrow({
      where: { id: opId },
      include: { assets: true },
    });
    expect(retained.assets.length).toBe(2);
    for (const asset of retained.assets) {
      expect(await createStorageClient(world.config)!.headObject(`lesson-videos/${asset.drmAssetId}`)).toBeNull();
    }
    expect(JSON.stringify(retained)).not.toContain('fixture-secret');
    const audits = await world.prisma.auditEvent.findMany({ where: { entityId: courseId } });
    expect(audits.some((a) => a.action === 'DELETION_COMPLETED')).toBe(true);
  });

  it('keeps completed deletion idempotent and retains its evidence', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'deldup');
    const slug = await publishCourse(courseId, lessonId);
    const first = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/delete`,
      world.adminJar,
      { confirmation: slug },
    );
    expect(first.status).toBe(202);
    const opId = first.body.data.operation.id as string;
    expect(first.body.data.operation.status).toBe('COMPLETED');
    const dup = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/delete`,
      world.adminJar,
      { confirmation: slug },
    );
    expect(dup.status).toBe(404);
    const retry = await adminPost(
      world.app,
      `/admin/catalog/deletions/${opId}/retry`,
      world.adminJar,
      {},
    );
    expect(retry.status).toBe(409);
    expect(retry.body.error.code).toBe('INVALID_TRANSITION');
    expect(
      await world.prisma.catalogDeletionOperation.count({ where: { targetId: courseId } }),
    ).toBe(1);
  });

  it('does not resurrect completed storage deletions during reconciliation', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'delrestart');
    const slug = await publishCourse(courseId, lessonId);
    const del = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/delete`,
      world.adminJar,
      { confirmation: slug },
    );
    const opId = del.body.data.operation.id as string;
    expect(del.body.data.operation.status).toBe('COMPLETED');
    const [a, b] = await Promise.all([
      reconcilePendingOperations(world.prisma, world.config, () => null, world.redis, 10),
      reconcilePendingOperations(world.prisma, world.config, () => null, world.redis, 10),
    ]);
    expect(a.checked + b.checked).toBe(0);
    expect((await world.prisma.catalogDeletionOperation.findUniqueOrThrow({ where: { id: opId } })).status).toBe('COMPLETED');
  });

  it('deletes targets with no media transactionally while preserving evidence', async () => {
    const { courseId } = await createFullDraft(world, 'nomedia');
    const lesson = await world.prisma.lesson.findFirstOrThrow({ where: { section: { courseId } } });
    const del = await adminPost(
      world.app,
      `/admin/catalog/lessons/${lesson.id}/delete`,
      world.adminJar,
      { confirmation: lesson.id },
    );
    expect(del.status).toBe(202);
    expect(del.body.data.operation.status).toBe('COMPLETED');
    expect(await world.prisma.lesson.findUnique({ where: { id: lesson.id } })).toBeNull();
    const course = await world.prisma.course.findUnique({ where: { id: courseId } });
    expect(course?.deletionRequestedAt).toBeNull();
    void courseId;
  });
});
