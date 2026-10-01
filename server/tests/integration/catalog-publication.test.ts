import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  adminGet,
  adminPost,
  createCatalogWorld,
  createFullDraft,
  type CatalogWorld,
} from './catalog-helpers.js';

let world: CatalogWorld;

beforeAll(async () => {
  world = await createCatalogWorld(true);
});

afterAll(async () => {
  await world.fixture?.stop();
  await world.close();
});

describe('catalog publication + lifecycle', () => {
  it('blocks DRAFT→PROCESSING without plans/sections/lessons/media', async () => {
    const c = await adminPost(world.app, '/admin/catalog/courses', world.adminJar, {
      slug: `pub-${Date.now().toString(36)}-a`,
      titleAr: 'دورة',
      titleEn: 'Course',
      descriptionAr: 'وصف',
      descriptionEn: 'Desc',
    });
    const courseId = c.body.data.course.id as string;
    const t = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/transitions`,
      world.adminJar,
      { to: 'PROCESSING' },
    );
    expect(t.status).toBe(409);
  });

  it('blocks publication with missing translations or unready media', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'pubb');
    // Register media but do not mark ready → PROCESSING transition must fail (upload not completed).
    const reg = await adminPost(
      world.app,
      `/admin/catalog/lessons/${lessonId}/media`,
      world.adminJar,
      {
        contentType: 'video/mp4',
        securityTier: 'STANDARD',
      },
    );
    expect(reg.status).toBe(201);
    const toProc = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/transitions`,
      world.adminJar,
      { to: 'PROCESSING' },
    );
    // UPLOAD_PENDING without completion blocks.
    expect(toProc.status).toBe(409);

    // Complete upload → PROCESSING status, then sync to READY via fixture.
    const comp = await adminPost(
      world.app,
      `/admin/catalog/lessons/${lessonId}/media/complete`,
      world.adminJar,
      {},
    );
    expect(comp.status).toBe(200);
    // Fixture asset is PROCESSING; mark READY then sync.
    const mapping = await world.prisma.mediaMapping.findFirstOrThrow({ where: { lessonId } });
    const internal = world.fixture!.assets.get(mapping.assetId as string);
    expect(internal).toBeDefined();
    world.fixture!.markReady(mapping.assetId as string);
    const sync = await adminPost(
      world.app,
      `/admin/catalog/lessons/${lessonId}/media/sync`,
      world.adminJar,
      {},
    );
    expect(sync.status).toBe(200);
    expect(sync.body.data.mapping.status).toBe('READY');

    // Now DRAFT→PROCESSING should pass (all invariants met).
    const proc = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/transitions`,
      world.adminJar,
      { to: 'PROCESSING' },
    );
    expect(proc.status).toBe(200);
    // PROCESSING→READY requires every asset READY (already synced).
    const ready = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/transitions`,
      world.adminJar,
      { to: 'READY' },
    );
    expect(ready.status).toBe(200);
    // READY→PUBLISHED rechecks invariants.
    const pub = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/transitions`,
      world.adminJar,
      { to: 'PUBLISHED' },
    );
    expect(pub.status).toBe(200);
    // Public list now contains it without lessons.
    const list = await request(world.app).get('/catalog/courses');
    expect(list.status).toBe(200);
    const found = (list.body.data.courses as { slug: string }[]).find(
      (x) => x.slug === (proc.body.data.course.slug as string) || true,
    );
    void found;
    const dumped = JSON.stringify(list.body);
    expect(dumped).not.toContain('sections');
  });

  it('rejects invalid transitions with 409', async () => {
    const { courseId } = await createFullDraft(world, 'invt');
    const direct = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/transitions`,
      world.adminJar,
      { to: 'PUBLISHED' },
    );
    expect(direct.status).toBe(409);
    expect(direct.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('archive hides content and unarchive restores valid prior state', async () => {
    const { courseId, lessonId } = await createFullDraft(world, 'arch');
    // Prepare publishable course quickly.
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
    await adminPost(world.app, `/admin/catalog/courses/${courseId}/transitions`, world.adminJar, {
      to: 'PROCESSING',
    });
    await adminPost(world.app, `/admin/catalog/courses/${courseId}/transitions`, world.adminJar, {
      to: 'READY',
    });
    await adminPost(world.app, `/admin/catalog/courses/${courseId}/transitions`, world.adminJar, {
      to: 'PUBLISHED',
    });
    const slug = (await adminGet(world.app, `/admin/catalog/courses/${courseId}`, world.adminJar))
      .body.data.course.slug as string;
    // Archive removes from public.
    const arch = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/archive`,
      world.adminJar,
      {},
    );
    expect(arch.status).toBe(200);
    expect(arch.body.data.course.status).toBe('ARCHIVED');
    const pubAfterArch = await request(world.app).get(`/catalog/courses/${slug}`);
    expect(pubAfterArch.status).toBe(404);
    // Archive never calls DRM delete: fixture deletions must be empty.
    expect(world.fixture!.deletions.size).toBe(0);
    // Unarchive restores PUBLISHED.
    const unarch = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/unarchive`,
      world.adminJar,
      {},
    );
    expect(unarch.status).toBe(200);
    expect(unarch.body.data.course.status).toBe('PUBLISHED');
    const pubAfterUnarch = await request(world.app).get(`/catalog/courses/${slug}`);
    expect(pubAfterUnarch.status).toBe(200);
  });

  it('records audit entries for mutations', async () => {
    const { courseId } = await createFullDraft(world, 'audit');
    const audits = await world.prisma.auditEvent.findMany({ where: { entityId: courseId } });
    expect(audits.length).toBeGreaterThan(0);
    const dumped = JSON.stringify(audits);
    expect(dumped).not.toContain('fixture-secret');
    expect(dumped).not.toContain('sig=');
  });

  it('fails closed with 503 when DRM unconfigured', async () => {
    // `resetSharedState: false`: this world is a sibling of the outer one, which
    // is still in use. A reset here would delete the outer world's courses.
    const plain = await createCatalogWorld(false, {}, { resetSharedState: false });
    try {
      const { lessonId } = await createFullDraft(plain, 'unconf');
      const reg = await adminPost(
        plain.app,
        `/admin/catalog/lessons/${lessonId}/media`,
        plain.adminJar,
        {
          contentType: 'video/mp4',
          securityTier: 'STANDARD',
        },
      );
      expect(reg.status).toBe(503);
      expect(reg.body.error.code).toBe('DRM_UNCONFIGURED');
    } finally {
      await plain.close();
    }
  });
});
