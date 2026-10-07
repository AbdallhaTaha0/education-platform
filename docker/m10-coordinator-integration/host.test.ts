/** TEST ONLY, never platform runtime. Actual Express application/PG/Redis,
 * synthetic identities/catalog/assessment data and an API-only DRM fixture.
 * Private Docker network only; no production, retained data or real messages. */
import { it } from 'vitest';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createLearningWorld, createPublishedCourse, grantSubscription } from './learning-helpers.js';
import { registerStudent, TEST_PASSWORD } from './identity-helpers.js';

it('hosts the actual M10 API for the isolated browser verification', async () => {
  const world = await createLearningWorld();
  let server: ReturnType<typeof createServer> | undefined;
  try {
    const now = Date.now();
    const DAY = 86400000;
    const old = new Date(now - 40 * DAY);
    const course = await createPublishedCourse(world, 'integrated-october', { extraLessons: 2 });
    const other = await createPublishedCourse(world, 'integrated-november');
    for (const [record, ar, en] of [[course, 'دورة أكتوبر', 'October course'], [other, 'دورة نوفمبر', 'November course']] as const) {
      await world.prisma.course.update({ where: { id: record.courseId }, data: { titleAr: ar, titleEn: en, firstPublicationAt: old, publishedAt: old, createdAt: old } });
    }
    // Add enough synthetic platform media rows to exercise server-side lesson paging.
    for (let position = 4; position <= 23; position++) {
      const lesson = await world.prisma.lesson.create({ data: { sectionId: course.sectionId, position, titleAr: `درس تجريبي ${position + 1}`, titleEn: `Synthetic lesson ${position + 1}`, createdAt: old } });
      await world.prisma.mediaMapping.create({ data: { lessonId: lesson.id, externalAssetId: randomUUID(), assetId: randomUUID(), idempotencyKey: randomUUID(), status: 'READY', createdAt: old, updatedAt: old, uploadCompletedAt: old, lastSyncedAt: old } });
    }
    await world.prisma.lesson.updateMany({ data: { createdAt: old } });
    await world.prisma.mediaMapping.updateMany({ data: { createdAt: old, updatedAt: old, uploadCompletedAt: old, lastSyncedAt: old } });
    await world.prisma.m10ViewTrackingState.upsert({ where: { id: 'global' }, create: { id: 'global', startedAt: old }, update: { startedAt: old } });
    await world.prisma.user.update({ where: { id: world.studentId }, data: { displayName: '00 Active Synthetic' } });
    await world.prisma.studentProfile.update({ where: { userId: world.studentId }, data: { parentPhone: '+201001234567' } });
    await grantSubscription(world, world.studentId, course.courseId, now + 30 * DAY);
    await grantSubscription(world, world.studentId, other.courseId, now + 30 * DAY);
    let quietId = '';
    for (let n = 1; n < 25; n++) {
      const student = await registerStudent(world.app, { displayName: n === 1 ? '01 Quiet Synthetic' : `${String(n).padStart(2, '0')} Roster Synthetic` });
      if (student.status !== 201) throw new Error(`synthetic student ${n} registration failed ${student.status}`);
      const id = student.user.id;
      if (n === 1) { quietId = id; await world.prisma.studentProfile.update({ where: { userId: id }, data: { parentPhone: null } }); }
      await grantSubscription(world, id, course.courseId, now + 30 * DAY);
    }
    await world.prisma.subscription.updateMany({ data: { startsAt: old } });
    const assessments = [];
    for (const [kind, state] of [['QUIZ', 'CORRECT'], ['ASSIGNMENT', 'INCORRECT']] as const) {
      const assessment = await world.prisma.assessment.create({ data: { lessonId: course.lessonId, kind, status: 'PUBLISHED', required: false, version: 1, createdAt: old,
        content: { titleAr: kind === 'QUIZ' ? 'اختبار التقدم' : 'واجب التدريب', titleEn: kind === 'QUIZ' ? 'Progress quiz' : 'Practice assignment' },
        versions: { create: { version: 1, content: {} } } }, include: { versions: true } });
      await world.prisma.assessmentSubmission.create({ data: { studentId: world.studentId, assessmentId: assessment.id, versionId: assessment.versions[0]!.id, idempotencyKey: randomUUID(), inputHash: 'fixture', state, result: state === 'CORRECT' ? { correct: true } : { error: 'CHECKING_UNAVAILABLE' }, createdAt: new Date(now - DAY), updatedAt: new Date(now - DAY) } });
      if (state === 'CORRECT') await world.prisma.assessmentPass.create({ data: { studentId: world.studentId, assessmentId: assessment.id, passedVersion: 1, passedAt: new Date(now - DAY) } });
      assessments.push(assessment.id);
    }
    const seed = { courseId: course.courseId, otherCourseId: other.courseId, courseSlug: course.slug, lessonId: course.lessonId, studentId: world.studentId, quietId,
      adminEmail: world.adminUser.email, adminPassword: 'catalog secret twelve words', studentEmail: world.studentUser.email, studentPassword: TEST_PASSWORD,
      phone: '+201001234567', assessmentIds: assessments };
    let finish!: () => void;
    const done = new Promise<void>(resolveDone => { finish = resolveDone; });
    server = createServer((req, res) => {
      void (async () => {
        const pathname = new URL(req.url ?? '/', 'http://fixture.invalid').pathname;
        if (pathname === '/__m10/seed') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(seed)); return; }
        if (pathname === '/__m10/player') { res.setHeader('Content-Type', 'text/html'); res.end('<div id="player-root"></div>'); return; }
        if (pathname === '/__m10/finish') { res.end('finished'); finish(); return; }
        if (pathname === '/__m10/contact/change') {
          await world.prisma.studentProfile.update({ where: { userId: seed.studentId }, data: { parentPhone: '+201001234568' } }); res.end('changed'); return;
        }
        if (pathname === '/__m10/contact/restore') {
          await world.prisma.studentProfile.update({ where: { userId: seed.studentId }, data: { parentPhone: seed.phone } }); res.end('restored'); return;
        }
        if (pathname.startsWith('/api/')) { req.url = (req.url ?? '').slice(4); world.app(req, res); return; }
        const root = '/web-output/dist';
        const filename = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!filename.startsWith(root + '/')) { res.statusCode = 404; res.end(); return; }
        const types: Record<string, string> = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp' };
        try { res.setHeader('Content-Type', types[extname(filename)] ?? 'application/octet-stream'); res.end(await readFile(filename)); }
        catch { res.statusCode = 404; res.end('missing'); }
      })().catch(() => { res.statusCode = 500; res.end('fixture failure'); });
    });
    await new Promise<void>(started => server!.listen(8080, '0.0.0.0', started));
    console.log('M10_REAL_API_BROWSER_HOST_READY');
    await done;
  } finally {
    if (server) await new Promise<void>(closed => server!.close(() => closed()));
    await world.fixture.stop();
    await world.close();
  }
}, 1200000);
