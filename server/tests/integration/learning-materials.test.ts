/** Real cookie/CSRF HTTP, PostgreSQL, Redis and private MinIO bytes. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createLearningWorld, createPublishedCourse, grantSubscription, studentGet, adminGet, adminDelete, type LearningWorld } from './learning-helpers.js';
import { TEST_ORIGIN, uniqueIp, registerStudent } from './identity-helpers.js';
import { StorageClient } from '../../src/infra/storage.js';
import { reconcileMaterialObjects, uploadResource, uploadCaptionPair, type MaterialsDeps } from '../../src/modules/learning/materials/service.js';
import { lockCourseRow } from '../../src/modules/catalog/locks.js';
import { createWorkingCopy, publishWorkingCopy } from '../../src/modules/catalog/courses/revisions.js';
import { withCourseLock } from '../../src/modules/catalog/courseTx.js';
import { getAdminMaterials } from '../../src/modules/learning/materials/service.js';
let world: LearningWorld;
let course: Awaited<ReturnType<typeof createPublishedCourse>>;
let storage: StorageClient, deps: MaterialsDeps;
const vtt = Buffer.from('WEBVTT\r\n\r\n00:00:00.000 --> 00:00:02.000\r\nمرحبا بالطلاب\r\n');
const english = Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nWelcome\n');
const captionPath = () => `/admin/learning/lessons/${course.lessonId}/captions`;
const resourcePath = () => `/admin/learning/lessons/${course.lessonId}/resources`;
const post = (path: string, csrf = true, admin = true) => request(world.app).post(path).set('Origin', TEST_ORIGIN).set('X-Forwarded-For', uniqueIp()).set('Cookie', (admin ? world.adminJar : world.studentJar).header()).set('X-CSRF-Token', csrf ? (admin ? world.adminJar : world.studentJar).csrf() : 'wrong');
const pair = () => post(captionPath()).attach('ar', vtt, { filename: 'ar.vtt', contentType: 'text/vtt' }).attach('en', english, { filename: 'en.vtt', contentType: 'text/vtt' });
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
  it('ADMIN GET works with cookie authentication and no Origin/CSRF', async () => { const r = await request(world.app).get(`/admin/learning/lessons/${course.lessonId}/materials`).set('Cookie', world.adminJar.header()); expect(r.status).toBe(200); });
  it('publishes and repeatedly replaces real multipart bilingual captions', async () => {
    for (let i = 0; i < 3; i++) { const r = await pair(); expect(r.status, JSON.stringify(r.body)).toBe(200); expect(r.body.data.captions).toHaveLength(2); expect(JSON.stringify(r.body)).not.toContain('storageKey'); }
    expect(await world.prisma.lessonCaption.count({ where: { lessonId: course.lessonId } })).toBe(2);
    expect(await world.prisma.materialObject.count({ where: { state: 'DELETE' } })).toBeGreaterThanOrEqual(4);
  });
  it('round trips Arabic CRLF and English LF bytes through signed private storage', async () => {
    const r = await materials(); expect(r.status).toBe(200);
    for (const caption of r.body.data.captions) {
      const response = await studentGet(world.app, `/learning/captions/${caption.id}`, world.studentJar);
      expect(response.status).toBe(200); expect(Buffer.from(response.text)).toEqual(caption.language === 'ar' ? vtt : english);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    }
  });
  it('uploads and downloads positioned captions byte-exactly and preserves them on malformed settings', async () => {
    const positioned = Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:02.000 align:start position:10% line:-1,end size:80%\nمرحبا\n');
    const response = await post(captionPath()).attach('ar', positioned, 'ar.vtt').attach('en', positioned, 'en.vtt');
    expect(response.status).toBe(200);
    const before = (await materials()).body.data.captions;
    for (const caption of before) {
      const bytes = await studentGet(world.app, `/learning/captions/${caption.id}`, world.studentJar);
      expect(bytes.status).toBe(200); expect(Buffer.from(bytes.text)).toEqual(positioned);
    }
    const malformed = Buffer.from('WEBVTT\n\n00:00.000 --> 00:02.000 position:101%\nInvalid\n');
    const invalid = await post(captionPath()).attach('ar', malformed, 'ar.vtt').attach('en', positioned, 'en.vtt');
    expect(invalid.status).toBe(400); expect((await materials()).body.data.captions).toEqual(before);
    expect((await pair()).status).toBe(200);
  });
  it('refreshes a still-valid session after its access cookie is gone, then reads and uploads materials', async () => {
    for (const [jar, admin] of [[world.studentJar, false], [world.adminJar, true]] as const) {
      const noAccess = jar.header().split('; ').filter(c => !c.startsWith('edu_access=')).join('; ');
      if (admin) {
        const rejected = await request(world.app).post(captionPath()).set('Origin', TEST_ORIGIN).set('Cookie', noAccess).set('X-CSRF-Token', jar.csrf()).attach('ar', vtt, 'ar.vtt').attach('en', english, 'en.vtt');
        expect(rejected.status).toBe(401); expect(rejected.body.error.code).toBe('TOKEN_MISSING');
      } else {
        const caption = (await materials()).body.data.captions[0];
        const rejected = await request(world.app).get(`/learning/captions/${caption.id}`).set('Cookie', noAccess);
        expect(rejected.status).toBe(401); expect(rejected.body.error.code).toBe('TOKEN_MISSING');
      }
      const refresh = await request(world.app).post('/auth/refresh').set('Origin', TEST_ORIGIN).set('Cookie', noAccess).set('X-CSRF-Token', jar.csrf()).send({});
      expect(refresh.status).toBe(200); jar.setFrom(refresh);
      if (admin) expect((await pair()).status).toBe(200);
      else {
        const caption = (await materials()).body.data.captions[0];
        expect((await studentGet(world.app, `/learning/captions/${caption.id}`, jar)).status).toBe(200);
      }
    }
  });
  it('preserves the old pair on malformed, duplicate, missing or extra multipart fields', async () => {
    const before = (await materials()).body.data.captions;
    const bad = await post(captionPath()).attach('ar', Buffer.from('bad'), 'ar.vtt').attach('en', english, 'en.vtt'); expect(bad.status).toBe(400);
    const missing = await post(captionPath()).attach('ar', vtt, 'ar.vtt'); expect(missing.body.error.code).toBe('MATERIAL_INVALID');
    const extra = await post(captionPath()).attach('ar', vtt, 'ar.vtt').attach('en', english, 'en.vtt').field('secret', 'x'); expect(extra.status).toBe(400);
    const duplicate = await post(captionPath()).attach('ar', vtt, 'ar.vtt').attach('ar', vtt, 'ar.vtt').attach('en', english, 'en.vtt'); expect(duplicate.status).toBe(400);
    expect((await materials()).body.data.captions).toEqual(before);
  });
  it('keeps the old pair and durable partial-upload keys on storage failure', async () => {
    const before = (await materials()).body.data.captions;
    let calls = 0; const put = storage.putObject.bind(storage);
    const broken = Object.create(storage) as StorageClient;
    broken.putObject = async (...args) => { if (++calls === 2) throw Error('fixture outage'); await put(...args); };
    await expect(uploadCaptionPair({ ...deps, storage: broken }, course.lessonId, { language: 'ar', labelAr: 'ع', labelEn: 'Ar', content: vtt }, { language: 'en', labelAr: 'إ', labelEn: 'En', content: english }, world.adminUser.id)).rejects.toMatchObject({ code: 'MATERIAL_STORAGE_UNAVAILABLE' });
    expect((await materials()).body.data.captions).toEqual(before);
    expect(await world.prisma.materialObject.count({ where: { state: 'DELETE' } })).toBeGreaterThan(0);
  });
  it('keeps the old pair after a real transaction failure and recovers committed object intents', async () => {
    const before = (await materials()).body.data.captions;
    await world.prisma.$executeRawUnsafe(`CREATE FUNCTION material_test_fail() RETURNS trigger AS $$ BEGIN IF NEW.action = 'CAPTIONS_UPLOADED' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await world.prisma.$executeRawUnsafe(`CREATE TRIGGER material_test_failure BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION material_test_fail()`);
    try { await expect(pair()).resolves.toMatchObject({ status: 500 }); }
    finally { await world.prisma.$executeRawUnsafe('DROP TRIGGER material_test_failure ON "AuditEvent"'); await world.prisma.$executeRawUnsafe('DROP FUNCTION material_test_fail()'); }
    expect((await materials()).body.data.captions).toEqual(before);
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
    const cap = await post(captionPath()).attach('ar', Buffer.alloc(1_048_577), 'ar.vtt').attach('en', english, 'en.vtt'); expect(cap.body.error.code).toBe('MATERIAL_TOO_LARGE');
  });
  it('requires ADMIN, Origin and CSRF for every mutation', async () => {
    expect((await post(captionPath(), false).attach('ar', vtt, 'ar.vtt').attach('en', english, 'en.vtt')).status).toBe(403);
    expect((await post(captionPath(), true, false).attach('ar', vtt, 'ar.vtt').attach('en', english, 'en.vtt')).status).toBe(403);
    expect((await request(world.app).post(captionPath()).set('Cookie', world.adminJar.header()).set('X-CSRF-Token', world.adminJar.csrf())).status).toBe(403);
  });
  it('denies anonymous, another student, ADMIN-as-student and cross-course requests', async () => {
    const r = await materials(); const captionId = r.body.data.captions[0].id;
    const other = await registerStudent(world.app);
    for (const path of [`/learning/lessons/${course.lessonId}/materials`, `/learning/captions/${captionId}`]) {
      expect((await request(world.app).get(path)).status).toBe(401);
      expect((await studentGet(world.app, path, other.jar)).status).toBe(403);
      expect((await studentGet(world.app, path, world.adminJar)).status).toBe(403);
    }
    const stranger = await createPublishedCourse(world, 'stranger');
    expect((await studentGet(world.app, `/learning/lessons/${stranger.lessonId}/materials`, world.studentJar)).status).toBe(403);
  });
  it('denies expired, archived and deleting lessons on every list/caption/download', async () => {
    const r = await materials(); const paths = [`/learning/lessons/${course.lessonId}/materials`, `/learning/captions/${r.body.data.captions[0].id}`, `/learning/resources/${r.body.data.resources[0].id}/download`];
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
  it('refuses locked lessons for list, caption bytes and resource downloads', async () => {
    const locked = course.lessonIds[1];
    const assessment = await world.prisma.assessment.create({ data: { lessonId: course.lessonId, kind: 'QUIZ', status: 'PUBLISHED', required: true, content: {} } });
    const resource = await uploadResource(deps, locked, { labelAr: 'ع', labelEn: 'En', fileName: 'locked.txt', mimeType: 'text/plain', content: Buffer.from('locked') }, world.adminUser.id);
    const pair = await uploadCaptionPair(deps, locked, { language: 'ar', labelAr: 'ع', labelEn: 'Ar', content: vtt }, { language: 'en', labelAr: 'إ', labelEn: 'En', content: english }, world.adminUser.id);
    try {
      for (const path of [`/learning/lessons/${locked}/materials`, `/learning/captions/${pair.ar.id}`, `/learning/resources/${resource.id}/download`]) expect((await studentGet(world.app, path, world.studentJar)).body.error.code).toBe('ASSESSMENTS_REQUIRED');
    } finally { await world.prisma.assessment.delete({ where: { id: assessment.id } }); }
  });
  it('keeps archive objects and existing progress, subscriptions and wallet unchanged', async () => {
    const before = await world.prisma.user.findUniqueOrThrow({ where: { id: world.studentId } });
    const subscriptions = await world.prisma.subscription.findMany({ where: { studentId: world.studentId } });
    const progress = await world.prisma.lessonProgress.findMany({ where: { studentId: world.studentId } });
    const live = await world.prisma.materialObject.count({ where: { state: 'LIVE' } });
    await pair();
    await world.prisma.course.update({ where: { id: course.courseId }, data: { status: 'ARCHIVED' } });
    expect(await world.prisma.materialObject.count({ where: { state: 'LIVE' } })).toBe(live);
    await world.prisma.course.update({ where: { id: course.courseId }, data: { status: 'PUBLISHED' } });
    expect(await world.prisma.user.findUniqueOrThrow({ where: { id: world.studentId } })).toEqual(before);
    expect(await world.prisma.subscription.findMany({ where: { studentId: world.studentId } })).toEqual(subscriptions);
    expect(await world.prisma.lessonProgress.findMany({ where: { studentId: world.studentId } })).toEqual(progress);
  });
  it('durably retries deletion after outage, recovers crash intents, and retains LIVE objects', async () => {
    const broken = Object.create(storage) as StorageClient; broken.deleteObject = async () => { throw Error('outage'); };
    const count = await world.prisma.materialObject.count({ where: { state: 'DELETE' } }); expect(count).toBeGreaterThan(0);
    expect(await reconcileMaterialObjects({ ...deps, storage: broken })).toBe(0);
    expect(await world.prisma.materialObject.count({ where: { state: 'DELETE' } })).toBe(count);
    await world.prisma.materialObject.create({ data: { storageKey: 'resources/crash-intent', updatedAt: new Date(Date.now() - 7200000) } });
    await storage.putObject('resources/crash-intent', Buffer.from('orphan'), 'text/plain');
    await reconcileMaterialObjects(deps, 100);
    expect(await world.prisma.materialObject.count({ where: { state: { not: 'LIVE' } } })).toBe(0);
    expect(await storage.headObject('resources/crash-intent')).toBeNull();
    expect((await materials()).body.data.captions).toHaveLength(2);
  });
  it('serializes simultaneous caption replacements and removals', async () => {
    const results = await Promise.all([pair(), pair(), adminDelete(world.app, captionPath(), world.adminJar)]);
    expect(results.map(r => r.status)).toEqual([200,200,200]);
    const rows = await world.prisma.lessonCaption.findMany({ where: { lessonId: course.lessonId } }); expect([0,2]).toContain(rows.length);
    await pair();
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
    const caption = await world.prisma.lessonCaption.findFirstOrThrow({ where: { lessonId: course.lessonId } });
    const unsigned = await fetch(`${process.env.STORAGE_ENDPOINT}/${process.env.STORAGE_BUCKET}/${caption.storageKey}`); expect(unsigned.status).toBe(403);
    const wrong = new StorageClient({ endpoint: process.env.STORAGE_ENDPOINT!, region: 'us-east-1', bucket: process.env.STORAGE_BUCKET!, accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!, secretAccessKey: 'wrong-secret', forcePathStyle: true, timeoutMs: 2000, maxRetries: 0 });
    await expect(wrong.getObject(caption.storageKey)).rejects.toBeDefined();
  });
  it('keeps live materials intact during draft editing and merges replacements only on publication', async () => {
    const c = await createPublishedCourse(world, 'materials-working-copy');
    const captionInput = (language: 'ar' | 'en', bytes: Buffer) => ({ language, content: bytes, labelAr: 'ترجمة', labelEn: 'Caption' });
    await uploadCaptionPair(deps, c.lessonId, captionInput('ar', vtt), captionInput('en', english), world.adminUser.id);
    const resource = await uploadResource(deps, c.lessonId, { labelAr: 'ملف', labelEn: 'File', fileName: 'original.txt', mimeType: 'text/plain', content: Buffer.from('original') }, world.adminUser.id);
    const original = await getAdminMaterials(deps, c.lessonId);
    const copy = await withCourseLock(world.prisma, c.courseId, async tx => createWorkingCopy(tx, world.adminUser.id, await tx.course.findUniqueOrThrow({ where: { id: c.courseId } })));
    const lesson = await world.prisma.lesson.findFirstOrThrow({ where: { originId: c.lessonId, section: { courseId: copy.id } } });
    const inherited = await getAdminMaterials(deps, lesson.id);
    expect(inherited.captions.map(x => x.id)).toEqual(original.captions.map(x => x.id));
    expect(inherited.captions.every(x => x.inherited)).toBe(true);
    expect(inherited.resources.find(x => x.id === resource.id)?.inherited).toBe(true);
    const replacement = Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nReplacement\n');
    await uploadCaptionPair(deps, lesson.id, captionInput('ar', replacement), captionInput('en', replacement), world.adminUser.id);
    await uploadResource(deps, lesson.id, { labelAr: 'جديد', labelEn: 'New', fileName: 'added.txt', mimeType: 'text/plain', content: Buffer.from('added') }, world.adminUser.id);
    expect(await getAdminMaterials(deps, c.lessonId)).toEqual(original);
    await withCourseLock(world.prisma, copy.id, async tx => publishWorkingCopy(tx, world.adminUser.id, await tx.course.findUniqueOrThrow({ where: { id: copy.id } })));
    const published = await getAdminMaterials(deps, c.lessonId);
    expect(published.captions).toHaveLength(2);
    expect(published.resources.map(x => x.fileName).sort()).toEqual(['added.txt', 'original.txt']);
    for (const caption of await world.prisma.lessonCaption.findMany({ where: { lessonId: c.lessonId } })) {
      expect(Buffer.from((await storage.getObject(caption.storageKey)).body)).toEqual(replacement);
    }
    expect(await world.prisma.materialObject.count({ where: { storageKey: { in: original.captions.map(x => `captions/${c.lessonId}/${x.id}`) }, state: 'DELETE' } })).toBe(2);
  });
});
