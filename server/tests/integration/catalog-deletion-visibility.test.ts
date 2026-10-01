import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createDrmClient } from '../../src/modules/catalog/drmClient.js';
import { reconcilePendingOperations } from '../../src/modules/catalog/deletion/reconciler.js';
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

describe('course visibility across partial deletion', () => {
  it('no-media lesson deletion completes and clears the course marker', async () => {
    const { courseId } = await createFullDraft(world, 'vis-lesson');
    const lesson = await world.prisma.lesson.findFirstOrThrow({ where: { section: { courseId } } });
    const res = await adminPost(
      world.app,
      `/admin/catalog/lessons/${lesson.id}/delete`,
      world.adminJar,
      { confirmation: lesson.id },
    );
    expect(res.status).toBe(202);
    expect(res.body.data.operation.status).toBe('COMPLETED');
    const course = await world.prisma.course.findUnique({ where: { id: courseId } });
    expect(course).not.toBeNull();
    expect(course?.deletionRequestedAt).toBeNull();
  });

  it('no-media section deletion completes and clears the marker', async () => {
    const { courseId, sectionId } = await createFullDraft(world, 'vis-section');
    const res = await adminPost(
      world.app,
      `/admin/catalog/sections/${sectionId}/delete`,
      world.adminJar,
      { confirmation: sectionId },
    );
    expect(res.status).toBe(202);
    expect(res.body.data.operation.status).toBe('COMPLETED');
    const course = await world.prisma.course.findUnique({ where: { id: courseId } });
    expect(course).not.toBeNull();
    expect(course?.deletionRequestedAt).toBeNull();
  });

  it('media-backed lesson deletion clears the marker only after DRM completion', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'vis-media');
    await readyLesson(lessonId);
    const del = await adminPost(
      world.app,
      `/admin/catalog/lessons/${lessonId}/delete`,
      world.adminJar,
      { confirmation: lessonId },
    );
    expect(del.status).toBe(202);
    const opId = del.body.data.operation.id as string;
    expect(
      (await world.prisma.course.findUnique({ where: { id: courseId } }))?.deletionRequestedAt,
    ).not.toBeNull();
    for (let i = 0; i < 8; i += 1) {
      await reconcilePendingOperations(world.prisma, cfg(), createDrmClient, world.redis, 10);
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
    const course = await world.prisma.course.findUnique({ where: { id: courseId } });
    expect(course).not.toBeNull();
    expect(course?.deletionRequestedAt).toBeNull();
    expect(await world.prisma.lesson.findUnique({ where: { id: lessonId } })).toBeNull();
  });

  it('failure keeps the course hidden; retry-to-completion restores the survivor', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'vis-fail');
    await readyLesson(lessonId);
    world.fixture!.failNextDeletes = 99;
    const del = await adminPost(
      world.app,
      `/admin/catalog/lessons/${lessonId}/delete`,
      world.adminJar,
      { confirmation: lessonId },
    );
    const opId = del.body.data.operation.id as string;
    await reconcilePendingOperations(world.prisma, cfg(), createDrmClient, world.redis, 10);
    const failed = await world.prisma.catalogDeletionOperation.findUniqueOrThrow({
      where: { id: opId },
    });
    expect(failed.status).toBe('FAILED');
    expect(
      (await world.prisma.course.findUnique({ where: { id: courseId } }))?.deletionRequestedAt,
    ).not.toBeNull();
    world.fixture!.failNextDeletes = 0;
    await adminPost(world.app, `/admin/catalog/deletions/${opId}/retry`, world.adminJar, {});
    for (let i = 0; i < 8; i += 1) {
      await reconcilePendingOperations(world.prisma, cfg(), createDrmClient, world.redis, 10);
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
    const course = await world.prisma.course.findUnique({ where: { id: courseId } });
    expect(course).not.toBeNull();
    expect(course?.deletionRequestedAt).toBeNull();
  });

  it('a second deletion in the same course cannot race the first', async () => {
    const { courseId, sectionId, lessonId } = await createFullDraft(world, 'vis-race');
    await readyLesson(lessonId);
    const s2 = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/sections`,
      world.adminJar,
      { titleAr: 'قسم ثان', titleEn: 'Section two' },
    );
    const section2 = s2.body.data.section.id as string;
    // Media-backed section deletion stays active (RUNNING) until DRM polls complete.
    const first = await adminPost(
      world.app,
      `/admin/catalog/sections/${sectionId}/delete`,
      world.adminJar,
      { confirmation: sectionId },
    );
    expect(first.status).toBe(202);
    expect(['PENDING', 'RUNNING', 'FAILED']).toContain(first.body.data.operation.status);
    const second = await adminPost(
      world.app,
      `/admin/catalog/sections/${section2}/delete`,
      world.adminJar,
      { confirmation: section2 },
    );
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DELETION_IN_PROGRESS');
  });

  it('deleting one course never changes another course', async () => {
    const a = await createFullDraft(world, 'vis-iso-a');
    const b = await createFullDraft(world, 'vis-iso-b');
    const lessonA = await world.prisma.lesson.findFirstOrThrow({
      where: { section: { courseId: a.courseId } },
    });
    await adminPost(world.app, `/admin/catalog/lessons/${lessonA.id}/delete`, world.adminJar, {
      confirmation: lessonA.id,
    });
    const courseB = await world.prisma.course.findUnique({ where: { id: b.courseId } });
    expect(courseB).not.toBeNull();
    expect(courseB?.deletionRequestedAt).toBeNull();
    expect(
      await request(world.app)
        .get('/catalog/courses')
        .then((r) => r.status),
    ).toBe(200);
  });
});
