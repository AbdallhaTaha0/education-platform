import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminPost, createCatalogWorld, createFullDraft, type CatalogWorld } from './catalog-helpers.js';

/** Exact regression: unconfigured DRM deletion must be side-effect free. */
let world: CatalogWorld;

beforeAll(async () => {
  world = await createCatalogWorld(false);
});

afterAll(async () => {
  await world.close();
});

describe('unconfigured deletion is side-effect free', () => {
  it('returns 503 with zero operations, markers, or media changes', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'unconf-reg');
    const mapping = await world.prisma.mediaMapping.create({
      data: {
        lessonId,
        externalAssetId: `edu-unconf-${Date.now().toString(36)}`,
        assetId: '11111111-1111-4111-8111-111111111111',
        status: 'READY',
        idempotencyKey: `idem-unconf-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`,
      },
    });
    const before = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { id: mapping.id } });
    const opsBefore = await world.prisma.catalogDeletionOperation.count();
    const auditsBefore = await world.prisma.auditEvent.count();

    const course = await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    const res = await adminPost(world.app, `/admin/catalog/courses/${courseId}/delete`, world.adminJar, { confirmation: course.slug });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DRM_UNCONFIGURED');

    expect(await world.prisma.catalogDeletionOperation.count()).toBe(opsBefore);
    expect((await world.prisma.course.findUnique({ where: { id: courseId } }))?.deletionRequestedAt).toBeNull();
    const after = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { id: mapping.id } });
    expect(after.status).toBe(before.status);
    expect(after.assetId).toBe(before.assetId);
    expect(await world.prisma.lesson.findUnique({ where: { id: lessonId } })).not.toBeNull();
    expect(await world.prisma.auditEvent.count()).toBe(auditsBefore);
  });

  it('still completes platform-only deletion when no external media exists', async () => {
    const { lessonId } = await createFullDraft(world, 'unconf-empty');
    const lesson = await world.prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    const res = await adminPost(world.app, `/admin/catalog/lessons/${lesson.id}/delete`, world.adminJar, { confirmation: lesson.id });
    expect(res.status).toBe(202);
    expect(res.body.data.operation.status).toBe('COMPLETED');
  });
});
