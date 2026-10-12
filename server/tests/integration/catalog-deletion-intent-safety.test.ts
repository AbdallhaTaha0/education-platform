import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { lockCourseRow } from '../../src/modules/catalog/locks.js';
import { createStorageClient } from '../../src/infra/storage.js';
import {
  adminPost,
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('deletion safety around media registration intents', () => {
  it('rejects an unresolved intent without catalog side effects', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'delete-unresolved');
    await world.prisma.mediaMapping.create({
      data: {
        lessonId,
        externalAssetId: `unresolved-${Date.now().toString(36)}`,
        assetId: null,
        status: 'UPLOAD_PENDING',
        idempotencyKey: `unresolved-idem-${Date.now().toString(36)}`,
      },
    });
    const course = await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    const operationsBefore = await world.prisma.catalogDeletionOperation.count();
    const auditsBefore = await world.prisma.auditEvent.count();

    const response = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/delete`,
      world.adminJar,
      {
        confirmation: course.slug,
      },
    );

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('MEDIA_REGISTRATION_UNRESOLVED');
    expect(await world.prisma.catalogDeletionOperation.count()).toBe(operationsBefore);
    expect(await world.prisma.auditEvent.count()).toBe(auditsBefore);
    expect(
      (await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } }))
        .deletionRequestedAt,
    ).toBeNull();
    expect(await world.prisma.mediaMapping.findUnique({ where: { lessonId } })).not.toBeNull();
  });

  it('uses the locked scope when media appears after the initial preview', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'delete-locked-scope');
    const course = await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    const lateAssetId = randomUUID();
    await createStorageClient(world.config)!.putObject(
      `lesson-videos/${lateAssetId}`,
      Buffer.from('late private video fixture'),
      'video/mp4',
    );
    let release!: () => void;
    let locked!: () => void;
    const releaseGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const lockGate = new Promise<void>((resolve) => {
      locked = resolve;
    });

    const holder = world.prisma.$transaction(
      async (tx) => {
        await lockCourseRow(tx, courseId);
        locked();
        await releaseGate;
        await tx.mediaMapping.create({
          data: {
            lessonId,
            externalAssetId: `late-media-${Date.now().toString(36)}`,
            assetId: lateAssetId,
            status: 'READY',
            idempotencyKey: `late-idem-${Date.now().toString(36)}`,
          },
        });
      },
      { timeout: 20_000, maxWait: 5_000 },
    );
    await lockGate;

    let settled = false;
    const deletion = adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/delete`,
      world.adminJar,
      {
        confirmation: course.slug,
      },
    ).then((response) => {
      settled = true;
      return response;
    });
    await sleep(300);
    expect(settled).toBe(false);
    release();
    await holder;

    const response = await deletion;
    expect(response.status).toBe(202);
    expect(response.body.data.operation.assets).toHaveLength(1);
    expect(response.body.data.operation.status).toBe('COMPLETED');
    expect(await world.prisma.course.findUnique({ where: { id: courseId } })).toBeNull();
    expect(await createStorageClient(world.config)!.headObject(`lesson-videos/${lateAssetId}`)).toBeNull();
  });
});
