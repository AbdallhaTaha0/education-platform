/** Real cookie/CSRF HTTP, PostgreSQL, Redis and private MinIO bytes. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createLearningWorld, createPublishedCourse, grantSubscription, studentGet, adminGet, adminDelete, type LearningWorld } from './learning-helpers.js';
import { TEST_ORIGIN, uniqueIp, registerStudent } from './identity-helpers.js';
import { StorageClient } from '../../src/infra/storage.js';
import { reconcileMaterialObjects, uploadResource, type MaterialsDeps } from '../../src/modules/learning/materials/service.js';
import { lockCourseRow } from '../../src/modules/catalog/locks.js';
import { createWorkingCopy, publishWorkingCopy } from '../../src/modules/catalog/courses/revisions.js';
import { withCourseLock } from '../../src/modules/catalog/courseTx.js';
import { getAdminMaterials } from '../../src/modules/learning/materials/service.js';
let world: LearningWorld;
let course: Awaited<ReturnType<typeof createPublishedCourse>>;
let storage: StorageClient, deps: MaterialsDeps;
const resourcePath = () => `/admin/learning/lessons/${course.lessonId}/resources`;
const post = (path: string, csrf = true, admin = true) => request(world.app).post(path).set('Origin', TEST_ORIGIN).set('X-Forwarded-For', uniqueIp()).set('Cookie', (admin ? world.adminJar : world.studentJar).header()).set('X-CSRF-Token', csrf ? (admin ? world.adminJar : world.studentJar).csrf() : 'wrong');
const upload = (bytes = Buffer.from('hello'), filename = 'lesson.txt', mime = 'text/plain') => post(resourcePath()).field('metadata', JSON.stringify({ labelAr: 'ملف الدرس', labelEn: 'Lesson file' })).attach('file', bytes, { filename, contentType: mime });
const materials = () => studentGet(world.app, `/learning/lessons/${course.lessonId}/materials`, world.studentJar);
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('course_learning_test') || !process.env.STORAGE_ENDPOINT?.includes('minio:9000')) throw Error('Disposable fixture guard refused');
  world = await createLearningWorld();
  storage = world.app.get('learning').storage;
  deps = { prisma: world.prisma, storage, now: Date.now };
  // PUT bucket root through the same signer: idempotent fixture provisioning.
  try { await storage.putObject('', new Uint8Array(), 'application/octet-stream'); } catch { /* existing bucket checked by the first real upload */ }
  course = await createPublishedCourse(world, 'materials', { extraLessons: 1 });
  await grantSubscription(world, world.studentId, course.courseId, Date.now() + 30 * 86400000);
});
afterAll(async () => { await world?.fixture?.stop(); await world?.close(); });
describe('real material contract', () => {
  it('lists empty metadata without storage while uploads still fail closed and authentication remains required', async () => {
    const context = world.app.get('learning');
    const configured = context.storage;
    context.storage = null;
    try {
      const student = await materials();
      expect(student.status).toBe(200);
      expect(student.body.data.resources).toEqual([]);
      const admin = await adminGet(world.app, `/admin/learning/lessons/${course.lessonId}/materials`, world.adminJar);
      expect(admin.status).toBe(200);
      expect(admin.body.data.resources).toEqual([]);
      expect((await request(world.app).get(`/learning/lessons/${course.lessonId}/materials`)).status).toBe(401);
      const denied = await upload();
      expect(denied.status).toBe(503);
      expect(denied.body.error.code).toBe('MATERIAL_STORAGE_UNAVAILABLE');
    } finally { context.storage = configured; }
  });
  it('removed caption endpoints are absent and metadata contains only lesson files', async () => {
    for (const method of ['get','post','delete'] as const) { const path=method==='get'?'/learning/captions/retired':`/admin/learning/lessons/${course.lessonId}/captions`; const r=await request(world.app)[method](path); expect(r.status).toBe(404); }
    expect((await materials()).body.data).not.toHaveProperty('captions');
    expect((await adminGet(world.app, `/admin/learning/lessons/${course.lessonId}/materials`, world.adminJar)).body.data).not.toHaveProperty('captions');
  });
  it('ADMIN GET works with cookie authentication and no Origin/CSRF', async () => { const r = await request(world.app).get(`/admin/learning/lessons/${course.lessonId}/materials`).set('Cookie', world.adminJar.header()); expect(r.status).toBe(200); });
  it('refreshes a still-valid session after its access cookie is gone, then reads and uploads materials', async () => {
    expect((await upload()).status).toBe(201);
    for (const [jar, admin] of [[world.studentJar, false], [world.adminJar, true]] as const) {
      const noAccess = jar.header().split('; ').filter(c => !c.startsWith('edu_access=')).join('; ');
      if (admin) {
        const rejected = await request(world.app).post(resourcePath()).set('Origin', TEST_ORIGIN).set('Cookie', noAccess).set('X-CSRF-Token', jar.csrf()).field('metadata', JSON.stringify({labelAr:'ع',labelEn:'File'})).attach('file',Buffer.from('x'),'x.txt');
        expect(rejected.status).toBe(401); expect(rejected.body.error.code).toBe('TOKEN_MISSING');
      } else {
        const resource = (await materials()).body.data.resources[0];
        const rejected = await request(world.app).get(`/learning/resources/${resource.id}/download`).set('Cookie', noAccess);
        expect(rejected.status).toBe(401); expect(rejected.body.error.code).toBe('TOKEN_MISSING');
      }
      const refresh = await request(world.app).post('/auth/refresh').set('Origin', TEST_ORIGIN).set('Cookie', noAccess).set('X-CSRF-Token', jar.csrf()).send({});
      expect(refresh.status).toBe(200); jar.setFrom(refresh);
      if (admin) expect((await upload()).status).toBe(201);
      else {
        const resource = (await materials()).body.data.resources[0];
        expect((await studentGet(world.app, `/learning/resources/${resource.id}/download`, jar)).status).toBe(200);
      }
    }
  });
  it.each([
    ['ملف.pdf', 'application/pdf', Buffer.from('%PDF-1.4\n% binary \xff\x80\n%%EOF\n', 'latin1')],
    ['lesson.zip', 'application/zip', Buffer.from([80,75,5,6,...Array(18).fill(0)])],
    ['lesson.txt', 'text/plain', Buffer.from('ملف عربي')],
    ['lesson.js', 'application/javascript', Buffer.from('console.log(1);')],
    ['lesson.json', 'application/json', Buffer.from('{"مرحبا":1}')],
  ])('downloads %s byte-exactly with safe Unicode filenames', async (filename, mime, bytes) => {
    const r = await upload(bytes, filename, mime); expect(r.status, JSON.stringify(r.body)).toBe(201); expect(Object.keys(r.body.data.resource)).not.toContain('storageKey');
    const url = `/learning/resources/${r.body.data.resource.id}/download`;
    const response = await request(world.app).get(url).set('Cookie', world.studentJar.header()).buffer(true).parse((res, done) => { const chunks: Buffer[] = []; res.on('data', c => chunks.push(c)); res.on('end', () => done(null, Buffer.concat(chunks))); });
    expect(response.status).toBe(200); expect(response.body).toEqual(bytes); expect(response.headers['content-disposition']).toContain(encodeURIComponent(filename)); expect(response.headers['cache-control']).toBe('private, no-store');
  });
  it('rejects malformed metadata, binary text, misleading MIME and body limits', async () => {
    expect((await upload(Buffer.from('bad'), 'x.pdf', 'application/pdf')).status).toBe(400);
    expect((await upload(Buffer.from([255,0]), 'x.txt', 'text/plain')).status).toBe(400);
    expect((await upload(Buffer.from('{bad}'), 'x.json', 'application/json')).status).toBe(400);
    expect((await upload(Buffer.from('hello'), 'x.txt', 'application/pdf')).status).toBe(400);
    const bad = await post(resourcePath()).field('metadata', '{').attach('file', Buffer.from('x'), 'x.txt'); expect(bad.status).toBe(400);
    const big = await upload(Buffer.alloc(10_485_761)); expect(big.body.error.code).toBe('MATERIAL_TOO_LARGE');
  });
  it('requires ADMIN, Origin and CSRF for every mutation', async () => {
    expect((await post(resourcePath(), false).field('metadata', JSON.stringify({labelAr:'ع',labelEn:'File'})).attach('file',Buffer.from('x'),'x.txt')).status).toBe(403);
    expect((await post(resourcePath(), true, false).field('metadata', JSON.stringify({labelAr:'ع',labelEn:'File'})).attach('file',Buffer.from('x'),'x.txt')).status).toBe(403);
    expect((await request(world.app).post(resourcePath()).set('Cookie', world.adminJar.header()).set('X-CSRF-Token', world.adminJar.csrf())).status).toBe(403);
  });
  it('denies anonymous, another student, ADMIN-as-student and cross-course requests', async () => {
    const r = await materials(); const resourceId = r.body.data.resources[0].id;
    const other = await registerStudent(world.app);
    for (const path of [`/learning/lessons/${course.lessonId}/materials`, `/learning/resources/${resourceId}/download`]) {
      expect((await request(world.app).get(path)).status).toBe(401);
      expect((await studentGet(world.app, path, other.jar)).status).toBe(403);
      expect((await studentGet(world.app, path, world.adminJar)).status).toBe(403);
    }
    const stranger = await createPublishedCourse(world, 'stranger');
    expect((await studentGet(world.app, `/learning/lessons/${stranger.lessonId}/materials`, world.studentJar)).status).toBe(403);
  });
  it('denies expired, archived and deleting lessons on every list/download', async () => {
    const r = await materials(); const paths = [`/learning/lessons/${course.lessonId}/materials`, `/learning/resources/${r.body.data.resources[0].id}/download`];
    await world.prisma.subscription.updateMany({ where: { studentId: world.studentId, courseId: course.courseId }, data: { startsAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() - 1000) } });
    for (const path of paths) expect((await studentGet(world.app, path, world.studentJar)).body.error.code).toBe('SUBSCRIPTION_EXPIRED');
    await world.prisma.subscription.updateMany({ where: { studentId: world.studentId, courseId: course.courseId }, data: { expiresAt: new Date(Date.now() + 86400000) } });
    for (const change of [{ status: 'ARCHIVED' as const }, { status: 'PUBLISHED' as const, deletionRequestedAt: new Date() }]) {
      await world.prisma.course.update({ where: { id: course.courseId }, data: change });
      for (const path of paths) expect((await studentGet(world.app, path, world.studentJar)).body.error.code).toBe('LESSON_NOT_FOUND');
      expect((await upload()).status).toBe(409);
    }
    await world.prisma.course.update({ where: { id: course.courseId }, data: { status: 'PUBLISHED', deletionRequestedAt: null } });
  });
  it('refuses locked lessons for list and resource downloads', async () => {
    const locked = course.lessonIds[1];
    const assessment = await world.prisma.assessment.create({ data: { lessonId: course.lessonId, kind: 'QUIZ', status: 'PUBLISHED', required: true, content: {} } });
    const resource = await uploadResource(deps, locked, { labelAr: 'ع', labelEn: 'En', fileName: 'locked.txt', mimeType: 'text/plain', content: Buffer.from('locked') }, world.adminUser.id);
    try {
      for (const path of [`/learning/lessons/${locked}/materials`, `/learning/resources/${resource.id}/download`]) expect((await studentGet(world.app, path, world.studentJar)).body.error.code).toBe('ASSESSMENTS_REQUIRED');
    } finally { await world.prisma.assessment.delete({ where: { id: assessment.id } }); }
  });
  it('keeps archive objects and existing progress, subscriptions and wallet unchanged', async () => {
    const before = await world.prisma.user.findUniqueOrThrow({ where: { id: world.studentId } });
    const subscriptions = await world.prisma.subscription.findMany({ where: { studentId: world.studentId } });
    const progress = await world.prisma.lessonProgress.findMany({ where: { studentId: world.studentId } });
    const live = await world.prisma.materialObject.count({ where: { state: 'LIVE' } });
    await world.prisma.course.update({ where: { id: course.courseId }, data: { status: 'ARCHIVED' } });
    expect(await world.prisma.materialObject.count({ where: { state: 'LIVE' } })).toBe(live);
    await world.prisma.course.update({ where: { id: course.courseId }, data: { status: 'PUBLISHED' } });
    expect(await world.prisma.user.findUniqueOrThrow({ where: { id: world.studentId } })).toEqual(before);
    expect(await world.prisma.subscription.findMany({ where: { studentId: world.studentId } })).toEqual(subscriptions);
    expect(await world.prisma.lessonProgress.findMany({ where: { studentId: world.studentId } })).toEqual(progress);
  });
  it('durably retries deletion after outage, recovers crash intents, and retains LIVE objects', async () => {
    const broken = Object.create(storage) as StorageClient; broken.deleteObject = async () => { throw Error('outage'); };
    const temporary = await upload(); expect(temporary.status).toBe(201); await adminDelete(world.app, `/admin/learning/resources/${temporary.body.data.resource.id}`, world.adminJar);
    const count = await world.prisma.materialObject.count({ where: { state: 'DELETE' } }); expect(count).toBeGreaterThan(0);
    expect(await reconcileMaterialObjects({ ...deps, storage: broken })).toBe(0);
    expect(await world.prisma.materialObject.count({ where: { state: 'DELETE' } })).toBe(count);
    await world.prisma.materialObject.create({ data: { storageKey: 'resources/crash-intent', updatedAt: new Date(Date.now() - 7200000) } });
    await storage.putObject('resources/crash-intent', Buffer.from('orphan'), 'text/plain');
    await reconcileMaterialObjects(deps, 100);
    expect(await world.prisma.materialObject.count({ where: { state: { not: 'LIVE' } } })).toBe(0);
    expect(await storage.headObject('resources/crash-intent')).toBeNull();
    expect((await materials()).body.data.resources.length).toBeGreaterThan(0);
  });
  it('fences an in-flight upload when course deletion starts; keeps cleanup intent', async () => {
    let arrived!: () => void, release!: () => void;
    const started = new Promise<void>(r => { arrived = r; }), barrier = new Promise<void>(r => { release = r; });
    const delayed = Object.create(storage) as StorageClient; delayed.putObject = async (...args) => { await storage.putObject(...args); arrived(); await barrier; };
    const uploading = uploadResource({ ...deps, storage: delayed }, course.lessonId, { labelAr: 'ع', labelEn: 'En', fileName: 'race.txt', mimeType: 'text/plain', content: Buffer.from('race') }, world.adminUser.id);
    const rejected = expect(uploading).rejects.toMatchObject({ code: 'DELETION_PENDING' });
    await started;
    await world.prisma.$transaction(async tx => { await lockCourseRow(tx, course.courseId); await tx.course.update({ where: { id: course.courseId }, data: { deletionRequestedAt: new Date() } }); });
    release(); await rejected;
    expect(await world.prisma.lessonResource.count({ where: { fileName: 'race.txt' } })).toBe(0);
    await world.prisma.course.update({ where: { id: course.courseId }, data: { deletionRequestedAt: null } });
  });
  it('queues owned objects on permanent lesson, section and course cascades and cleans them', async () => {
    for (const target of ['lesson', 'section', 'course']) {
      const c = await world.prisma.course.create({ data: { slug: 'cascade-' + target, titleAr: 'ع', titleEn: 'E', descriptionAr: 'ع', descriptionEn: 'E', sections: { create: { titleAr: 'ع', titleEn: 'E', position: 1, lessons: { create: { titleAr: 'ع', titleEn: 'E', position: 1 } } } } }, include: { sections: { include: { lessons: true } } } });
      const section = c.sections[0], lesson = section.lessons[0];
      const r = await uploadResource(deps, lesson.id, { labelAr: 'ع', labelEn: 'En', fileName: 'cascade.txt', mimeType: 'text/plain', content: Buffer.from('cascade') }, world.adminUser.id);
      const key = (await world.prisma.lessonResource.findUniqueOrThrow({ where: { id: r.id } })).storageKey;
      if (target === 'lesson') await world.prisma.lesson.delete({ where: { id: lesson.id } });
      if (target === 'section') await world.prisma.courseSection.delete({ where: { id: section.id } });
      if (target === 'course') await world.prisma.course.delete({ where: { id: c.id } });
      expect((await world.prisma.materialObject.findUniqueOrThrow({ where: { storageKey: key } })).state).toBe('DELETE');
      await reconcileMaterialObjects(deps, 100);
      expect(await storage.headObject(key)).toBeNull();
    }
  });
  it('MinIO refuses unsigned downloads and wrong credentials', async () => {
    const resource = await world.prisma.lessonResource.findFirstOrThrow({ where: { lessonId: course.lessonId } });
    const unsigned = await fetch(`${process.env.STORAGE_ENDPOINT}/${process.env.STORAGE_BUCKET}/${resource.storageKey}`); expect(unsigned.status).toBe(403);
    const wrong = new StorageClient({ endpoint: process.env.STORAGE_ENDPOINT!, region: 'us-east-1', bucket: process.env.STORAGE_BUCKET!, accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!, secretAccessKey: 'wrong-secret', forcePathStyle: true, timeoutMs: 2000, maxRetries: 0 });
    await expect(wrong.getObject(resource.storageKey)).rejects.toBeDefined();
  });
  it('keeps live materials intact during draft editing and merges replacements only on publication', async () => {
    const c = await createPublishedCourse(world, 'materials-working-copy');
    const resource = await uploadResource(deps, c.lessonId, { labelAr: 'ملف', labelEn: 'File', fileName: 'original.txt', mimeType: 'text/plain', content: Buffer.from('original') }, world.adminUser.id);
    const original = await getAdminMaterials(deps, c.lessonId);
    const copy = await withCourseLock(world.prisma, c.courseId, async tx => createWorkingCopy(tx, world.adminUser.id, await tx.course.findUniqueOrThrow({ where: { id: c.courseId } })));
    const lesson = await world.prisma.lesson.findFirstOrThrow({ where: { originId: c.lessonId, section: { courseId: copy.id } } });
    const inherited = await getAdminMaterials(deps, lesson.id);
    expect(inherited.resources.find(x => x.id === resource.id)?.inherited).toBe(true);
    await uploadResource(deps, lesson.id, { labelAr: 'جديد', labelEn: 'New', fileName: 'added.txt', mimeType: 'text/plain', content: Buffer.from('added') }, world.adminUser.id);
    expect(await getAdminMaterials(deps, c.lessonId)).toEqual(original);
    await withCourseLock(world.prisma, copy.id, async tx => publishWorkingCopy(tx, world.adminUser.id, await tx.course.findUniqueOrThrow({ where: { id: copy.id } })));
    const published = await getAdminMaterials(deps, c.lessonId);
    expect(published.resources.map(x => x.fileName).sort()).toEqual(['added.txt', 'original.txt']);
  });
});
