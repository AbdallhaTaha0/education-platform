import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { StorageClient } from '../../src/infra/storage.js';
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

async function readyLesson(lessonId: string): Promise<void> {
  const registration = await registerTestVideo(world, lessonId);
  await uploadTestVideo(registration.uploadUrl);
  await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media/complete`, world.adminJar, {});
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

  it('media-backed lesson deletion removes the private object before clearing the marker', async () => {
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
    expect(del.body.data.operation.status).toBe('COMPLETED');
    expect(
      (await world.prisma.catalogDeletionOperation.findUniqueOrThrow({ where: { id: opId } }))
        .status,
    ).toBe('COMPLETED');
    const course = await world.prisma.course.findUnique({ where: { id: courseId } });
    expect(course).not.toBeNull();
    expect(course?.deletionRequestedAt).toBeNull();
    expect(await world.prisma.lesson.findUnique({ where: { id: lessonId } })).toBeNull();
  });

  it('storage failure keeps the course hidden until a retry succeeds', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'vis-fail');
    await readyLesson(lessonId);
    const failedDelete = vi.spyOn(StorageClient.prototype, 'deleteObject').mockRejectedValueOnce(new Error('synthetic storage outage'));
    const del = await adminPost(
      world.app,
      `/admin/catalog/lessons/${lessonId}/delete`,
      world.adminJar,
      { confirmation: lessonId },
    );
    const opId = del.body.data.operation.id as string;
    expect(del.status).toBe(202);
    failedDelete.mockRestore();
    const failed = await world.prisma.catalogDeletionOperation.findUniqueOrThrow({
      where: { id: opId },
    });
    expect(failed.status).toBe('FAILED');
    expect(await world.prisma.lesson.findUnique({ where: { id: lessonId } })).not.toBeNull();
    expect(
      (await world.prisma.course.findUnique({ where: { id: courseId } }))?.deletionRequestedAt,
    ).not.toBeNull();
    const retry = await adminPost(world.app, `/admin/catalog/deletions/${opId}/retry`, world.adminJar, {});
    expect(retry.status).toBe(200);
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
    let releaseDelete!: () => void;
    let deleteStarted!: () => void;
    const blocked = new Promise<void>((resolve) => { releaseDelete = resolve; });
    const started = new Promise<void>((resolve) => { deleteStarted = resolve; });
    const realDelete = StorageClient.prototype.deleteObject;
    const blockedDelete = vi.spyOn(StorageClient.prototype, 'deleteObject').mockImplementation(
      async function (this: StorageClient, key: string) {
        deleteStarted();
        await blocked;
        await realDelete.call(this, key);
      },
    );
    const firstRequest = adminPost(
      world.app,
      `/admin/catalog/sections/${sectionId}/delete`,
      world.adminJar,
      { confirmation: sectionId },
    );
    const enteredStorage = await Promise.race([
      started.then(() => true),
      firstRequest.then((response) => { throw new Error(`first deletion returned before storage request (${response.status}: ${JSON.stringify(response.body)})`); }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('first deletion did not reach storage in time')), 5_000)),
    ]);
    expect(enteredStorage).toBe(true);
    const second = await adminPost(
      world.app,
      `/admin/catalog/sections/${section2}/delete`,
      world.adminJar,
      { confirmation: section2 },
    );
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DELETION_IN_PROGRESS');
    releaseDelete();
    const first = await firstRequest;
    blockedDelete.mockRestore();
    expect(first.status).toBe(202);
    expect(first.body.data.operation.status).toBe('COMPLETED');
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
