import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createDrmClient } from '../../src/modules/catalog/drmClient.js';
import { reconcilePendingOperations } from '../../src/modules/catalog/deletion/reconciler.js';
import { adminPost, createCatalogWorld, createFullDraft, type CatalogWorld } from './catalog-helpers.js';
import { loadConfig } from '../../src/config.js';

let world: CatalogWorld;

beforeAll(async () => {
  world = await createCatalogWorld(true);
});

afterAll(async () => {
  await world.fixture?.stop();
  await world.close();
});

async function publishCourse(courseId: string, lessonId: string): Promise<string> {
  await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media`, world.adminJar, { contentType: 'video/mp4', securityTier: 'STANDARD' });
  await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media/complete`, world.adminJar, {});
  const mapping = await world.prisma.mediaMapping.findFirstOrThrow({ where: { lessonId } });
  world.fixture!.markReady(mapping.assetId as string);
  await adminPost(world.app, `/admin/catalog/lessons/${lessonId}/media/sync`, world.adminJar, {});
  await adminPost(world.app, `/admin/catalog/courses/${courseId}/transitions`, world.adminJar, { to: 'PROCESSING' });
  await adminPost(world.app, `/admin/catalog/courses/${courseId}/transitions`, world.adminJar, { to: 'READY' });
  await adminPost(world.app, `/admin/catalog/courses/${courseId}/transitions`, world.adminJar, { to: 'PUBLISHED' });
  const full = await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  return full.slug;
}

function fixtureCfg() {
  const config = loadConfig(process.env);
  return { ...config, drmBaseUrl: world.fixture!.url, drmClientId: world.fixture!.expectedClientId, drmClientSecret: world.fixture!.expectedClientSecret };
}

describe('permanent-deletion coordination', () => {
  it('stops public visibility immediately and retains rows while pending', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'delvis');
    const slug = await publishCourse(courseId, lessonId);
    expect((await request(world.app).get(`/catalog/courses/${slug}`)).status).toBe(200);
    const del = await adminPost(world.app, `/admin/catalog/courses/${courseId}/delete`, world.adminJar, { confirmation: slug });
    expect(del.status).toBe(202);
    const opId = del.body.data.operation.id as string;
    expect((await request(world.app).get(`/catalog/courses/${slug}`)).status).toBe(404);
    expect(await world.prisma.course.findUnique({ where: { id: courseId } })).not.toBeNull();
    const op = await world.prisma.catalogDeletionOperation.findUniqueOrThrow({ where: { id: opId }, include: { assets: true } });
    expect(op.assets.length).toBe(1);
    expect(op.assets[0]?.drmDeletionId).toBeTruthy();
  });

  it('completes only after every asset is externally COMPLETED', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'delmulti');
    const section = await world.prisma.courseSection.findFirstOrThrow({ where: { courseId } });
    const l2 = await adminPost(world.app, `/admin/catalog/sections/${section.id}/lessons`, world.adminJar, { titleAr: 'درس ثان', titleEn: 'Lesson two' });
    const lesson2 = l2.body.data.lesson.id as string;
    const slug = await publishCourse(courseId, lessonId);
    await adminPost(world.app, `/admin/catalog/lessons/${lesson2}/media`, world.adminJar, { contentType: 'video/mp4', securityTier: 'STANDARD' });
    await adminPost(world.app, `/admin/catalog/lessons/${lesson2}/media/complete`, world.adminJar, {});
    const m2 = await world.prisma.mediaMapping.findFirstOrThrow({ where: { lessonId: lesson2 } });
    world.fixture!.markReady(m2.assetId as string);
    await adminPost(world.app, `/admin/catalog/lessons/${lesson2}/media/sync`, world.adminJar, {});
    const del = await adminPost(world.app, `/admin/catalog/courses/${courseId}/delete`, world.adminJar, { confirmation: slug });
    expect(del.status).toBe(202);
    const opId = del.body.data.operation.id as string;
    const cfg = fixtureCfg();
    for (let i = 0; i < 8; i += 1) {
      await reconcilePendingOperations(world.prisma, cfg, createDrmClient, world.redis, 10);
      const op = await world.prisma.catalogDeletionOperation.findUniqueOrThrow({ where: { id: opId } });
      if (op.status === 'COMPLETED') break;
    }
    expect((await world.prisma.catalogDeletionOperation.findUniqueOrThrow({ where: { id: opId } })).status).toBe('COMPLETED');
    expect(await world.prisma.course.findUnique({ where: { id: courseId } })).toBeNull();
    const retained = await world.prisma.catalogDeletionOperation.findUniqueOrThrow({ where: { id: opId }, include: { assets: true } });
    expect(retained.assets.length).toBe(2);
    expect(JSON.stringify(retained)).not.toContain('fixture-secret');
    const audits = await world.prisma.auditEvent.findMany({ where: { entityId: courseId } });
    expect(audits.some((a) => a.action === 'DELETION_COMPLETED')).toBe(true);
  });

  it('converges duplicate/concurrent deletes and supports retry without duplication', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'deldup');
    const slug = await publishCourse(courseId, lessonId);
    const first = await adminPost(world.app, `/admin/catalog/courses/${courseId}/delete`, world.adminJar, { confirmation: slug });
    expect(first.status).toBe(202);
    const opId = first.body.data.operation.id as string;
    const dup = await adminPost(world.app, `/admin/catalog/courses/${courseId}/delete`, world.adminJar, { confirmation: slug });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DELETION_IN_PROGRESS');
    const retry = await adminPost(world.app, `/admin/catalog/deletions/${opId}/retry`, world.adminJar, {});
    expect(retry.status).toBe(200);
    expect(retry.body.data.operation.id).toBe(opId);
    expect(await world.prisma.catalogDeletionOperation.count({ where: { targetId: courseId } })).toBe(1);
  });

  it('resumes pending operations after restart with lease ownership', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'delrestart');
    const slug = await publishCourse(courseId, lessonId);
    const del = await adminPost(world.app, `/admin/catalog/courses/${courseId}/delete`, world.adminJar, { confirmation: slug });
    const opId = del.body.data.operation.id as string;
    const cfg = fixtureCfg();
    const [a, b] = await Promise.all([
      reconcilePendingOperations(world.prisma, cfg, createDrmClient, world.redis, 10),
      reconcilePendingOperations(world.prisma, cfg, createDrmClient, world.redis, 10),
    ]);
    expect(a.checked + b.checked).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 8; i += 1) {
      await reconcilePendingOperations(world.prisma, cfg, createDrmClient, world.redis, 10);
      const op = await world.prisma.catalogDeletionOperation.findUniqueOrThrow({ where: { id: opId } });
      if (op.status === 'COMPLETED') break;
    }
    expect((await world.prisma.catalogDeletionOperation.findUniqueOrThrow({ where: { id: opId } })).status).toBe('COMPLETED');
  });

  it('deletes targets with no media transactionally while preserving evidence', async () => {
    const { courseId } = await createFullDraft(world, 'nomedia');
    const lesson = await world.prisma.lesson.findFirstOrThrow({ where: { section: { courseId } } });
    const del = await adminPost(world.app, `/admin/catalog/lessons/${lesson.id}/delete`, world.adminJar, { confirmation: lesson.id });
    expect(del.status).toBe(202);
    expect(del.body.data.operation.status).toBe('COMPLETED');
    expect(await world.prisma.lesson.findUnique({ where: { id: lesson.id } })).toBeNull();
    const course = await world.prisma.course.findUnique({ where: { id: courseId } });
    expect(course?.deletionRequestedAt).toBeNull();
    void courseId;
  });
});
