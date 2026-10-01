import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminDelete,
  adminGet,
  adminPatch,
  adminPost,
  createCatalogWorld,
  type CatalogWorld,
} from './catalog-helpers.js';
import { TEST_ORIGIN, uniqueIp } from './identity-helpers.js';

let world: CatalogWorld;

beforeAll(async () => {
  world = await createCatalogWorld(false);
});

afterAll(async () => {
  await world.close();
});

describe('catalog authorization + request safety', () => {
  it('ADMIN can mutate; STUDENT gets 403; anonymous gets 401', async () => {
    const created = await adminPost(world.app, '/admin/catalog/courses', world.adminJar, {
      slug: `auth-${Date.now().toString(36)}`,
      titleAr: 'دورة',
      titleEn: 'Course',
      descriptionAr: 'وصف',
      descriptionEn: 'Description',
    });
    expect(created.status).toBe(201);
    const courseId = created.body.data.course.id as string;

    const studentAttempt = await adminPost(world.app, '/admin/catalog/courses', world.studentJar, {
      slug: `student-${Date.now().toString(36)}`,
      titleAr: 'د',
      titleEn: 'C',
      descriptionAr: 'و',
      descriptionEn: 'D',
    });
    expect(studentAttempt.status).toBe(403);

    const anon = await request(world.app)
      .post('/admin/catalog/courses')
      .set('Origin', TEST_ORIGIN)
      .set('X-Forwarded-For', uniqueIp())
      .send({ slug: 'anon-x', titleAr: 'د', titleEn: 'C', descriptionAr: 'و', descriptionEn: 'D' });
    expect(anon.status).toBe(401);

    // Admin read requires auth too.
    const anonRead = await request(world.app)
      .get(`/admin/catalog/courses/${courseId}`)
      .set('X-Forwarded-For', uniqueIp());
    expect(anonRead.status).toBe(401);
    const studentRead = await adminGet(
      world.app,
      `/admin/catalog/courses/${courseId}`,
      world.studentJar,
    );
    expect(studentRead.status).toBe(403);
  });

  it('enforces CSRF + origin on mutations', async () => {
    // Missing origin → 403.
    const noOrigin = await request(world.app)
      .post('/admin/catalog/courses')
      .set('Cookie', world.adminJar.header())
      .set('X-Csrf-Token', world.adminJar.csrf())
      .set('X-Forwarded-For', uniqueIp())
      .send({
        slug: 'no-origin-x',
        titleAr: 'د',
        titleEn: 'C',
        descriptionAr: 'و',
        descriptionEn: 'D',
      });
    expect(noOrigin.status).toBe(403);

    // Bad CSRF → 403.
    const badCsrf = await request(world.app)
      .post('/admin/catalog/courses')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', world.adminJar.header())
      .set('X-Csrf-Token', '0'.repeat(64))
      .set('X-Forwarded-For', uniqueIp())
      .send({
        slug: 'bad-csrf-x',
        titleAr: 'د',
        titleEn: 'C',
        descriptionAr: 'و',
        descriptionEn: 'D',
      });
    expect(badCsrf.status).toBe(403);
  });

  it('public queries expose only published courses without protected data', async () => {
    // Create a DRAFT (not public).
    const draft = await adminPost(world.app, '/admin/catalog/courses', world.adminJar, {
      slug: `draft-${Date.now().toString(36)}`,
      titleAr: 'مسودة',
      titleEn: 'Draft',
      descriptionAr: 'وصف',
      descriptionEn: 'Desc',
    });
    expect(draft.status).toBe(201);
    const list = await request(world.app).get('/catalog/courses');
    expect(list.status).toBe(200);
    const courses = list.body.data.courses as unknown[];
    // Draft must not appear.
    expect(JSON.stringify(courses)).not.toContain(draft.body.data.course.id);
    // Public shape never contains sections/lessons/media/drm ids.
    const dumped = JSON.stringify(list.body);
    expect(dumped).not.toContain('sections');
    expect(dumped).not.toContain('lessons');
    expect(dumped).not.toContain('assetId');
    expect(dumped).not.toContain('uploadUrl');
    // Unknown slug → 404.
    const missing = await request(world.app).get('/catalog/courses/no-such-slug-xyz');
    expect(missing.status).toBe(404);
  });

  it('rejects unknown fields on mutations', async () => {
    const res = await adminPost(world.app, '/admin/catalog/courses', world.adminJar, {
      slug: `unknown-${Date.now().toString(36)}`,
      titleAr: 'د',
      titleEn: 'C',
      descriptionAr: 'و',
      descriptionEn: 'D',
      hacker: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FIELD');
  });

  it('validates UUIDs server-side', async () => {
    const res = await adminGet(world.app, '/admin/catalog/courses/not-a-uuid', world.adminJar);
    expect(res.status).toBe(400);
    void adminPatch;
    void adminDelete;
  });
});
