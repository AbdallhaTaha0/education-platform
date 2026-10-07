/**
 * M10 agent-2 backend: ADMIN rosters, per-student views, report-courses,
 * transient parent-report generation. Uses a real PostgreSQL database (Docker
 * test service) plus the LABELED test-only view-fact fixture until agent 1's
 * real migration lands; see m10-agent-2-report.md for the rerun requirement.
 */
import request from 'supertest';
import { generateParentReport } from '../../src/modules/parent-reports/reportServer.js';
import { postgresViewFactsReader } from '../../src/modules/parent-reports/viewFacts.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createWorld,
  createTestAdmin,
  loginWith,
  registerStudent,
  TEST_ORIGIN,
  uniqueIp,
  type IdentityWorld,
} from './identity-helpers.js';
import {
  ensureM10ViewTablesForTest,
  resetM10ViewFactsForTest,
  setTrackingStartedAt,
  insertViewSession,
} from './m10-view-fixture.js';

const NOW = new Date('2026-10-30T12:00:00Z'); // Cairo Oct 30 2026, DST ended Oct 29

async function seedEnvironment(world: IdentityWorld) {
  await world.prisma.playbackReference.deleteMany();
  await world.prisma.lessonProgress.deleteMany();
  await world.prisma.catalogDeletionAsset.deleteMany();
  await world.prisma.catalogDeletionOperation.deleteMany();
  await world.prisma.auditEvent.deleteMany();
  await world.prisma.mediaMapping.deleteMany();
  await world.prisma.subscriptionPlan.deleteMany();
  await world.prisma.lesson.deleteMany();
  await world.prisma.courseSection.deleteMany();
  await world.prisma.course.deleteMany();
  await world.prisma.subscription.deleteMany();
  await world.prisma.packagePurchaseItem.deleteMany();
  await world.prisma.packagePurchase.deleteMany();
  await world.prisma.assessmentPass.deleteMany();
  await world.prisma.assessmentSubmission.deleteMany();
  await world.prisma.assessmentVersion.deleteMany();
  await world.prisma.assessment.deleteMany();
  await world.prisma.studentProfile.deleteMany();
  await world.prisma.user.deleteMany({ where: { role: 'STUDENT' } });

  const admin = await createTestAdmin(world, 'M10 Admin', 'm10 admin password eleven');
  const adminLogin = await loginWith(world.app, admin.email, 'm10 admin password eleven');

  const stamp = NOW.getTime().toString(36);
  const courseA = await world.prisma.course.create({
    data: { slug: `m10a-${stamp}`, titleAr: 'دورة أ', titleEn: 'Course A', descriptionAr: 'و', descriptionEn: 'd', status: 'PUBLISHED' },
  });
  const courseB = await world.prisma.course.create({
    data: { slug: `m10b-${stamp}`, titleAr: 'دورة ب', titleEn: 'Course B', descriptionAr: 'و', descriptionEn: 'd', status: 'PUBLISHED' },
  });
  const sectionA = await world.prisma.courseSection.create({
    data: { courseId: courseA.id, titleAr: 'قسم', titleEn: 'Section', position: 1 },
  });
  const lessonA1 = await world.prisma.lesson.create({
    data: { sectionId: sectionA.id, titleAr: 'الدرس الأول', titleEn: 'Lesson One', position: 1 },
  });
  const lessonA2 = await world.prisma.lesson.create({
    data: { sectionId: sectionA.id, titleAr: 'الدرس الثاني', titleEn: 'Lesson Two', position: 2 },
  });
  const sectionB = await world.prisma.courseSection.create({
    data: { courseId: courseB.id, titleAr: 'قسم ب', titleEn: 'Section B', position: 1 },
  });
  const lessonB1 = await world.prisma.lesson.create({
    data: { sectionId: sectionB.id, titleAr: 'درس ب', titleEn: 'Lesson B1', position: 1 },
  });
  await world.prisma.mediaMapping.create({
    data: { lessonId: lessonA1.id, externalAssetId: `ia-ext-a1-${stamp}`, assetId: `asset-a1-${stamp}`, status: 'READY', idempotencyKey: `ia-a1-${stamp}` },
  });
  await world.prisma.mediaMapping.create({
    data: { lessonId: lessonA2.id, externalAssetId: `ia-ext-a2-${stamp}`, assetId: `asset-a2-${stamp}`, status: 'READY', idempotencyKey: `ia-a2-${stamp}` },
  });
  await world.prisma.mediaMapping.create({
    data: { lessonId: lessonB1.id, externalAssetId: `ib-ext-b1-${stamp}`, assetId: `asset-b1-${stamp}`, status: 'READY', idempotencyKey: `ib-b1-${stamp}` },
  });
  return { adminJar: adminLogin.jar, courseA, courseB, lessonA1, lessonA2, lessonB1 };
}

async function makeStudent(world: IdentityWorld, displayName: string, parentPhone: string | null = null) {
  const s = await registerStudent(world.app, { displayName, ...(parentPhone ? { parentPhone } : {}) });
  const row = await world.prisma.user.findUniqueOrThrow({ where: { email: s.user.email } });
  if (parentPhone === null) await world.prisma.studentProfile.update({ where: { userId: row.id }, data: { parentPhone: null } });
  return { studentId: row.id, jar: s.jar, email: s.user.email };
}

async function grant(
  world: IdentityWorld,
  studentId: string,
  courseId: string,
  startsAt: Date,
  expiresAt: Date | null,
  packagePurchaseId?: string,
) {
  if (packagePurchaseId) {
    return world.prisma.subscription.create({
      data: { studentId, courseId, startsAt, expiresAt, packagePurchaseId },
    });
  }
  const plan =
    (await world.prisma.subscriptionPlan.findFirst({ where: { courseId } })) ??
    (await world.prisma.subscriptionPlan.create({
      data: { courseId, currentPricePiastres: 100, durationDays: 30 } as never,
    }));
  const purchase = await world.prisma.purchase.create({
    data: {
      studentId,
      planId: plan.id,
      courseId,
      pricePiastres: 100,
      durationDays: expiresAt === null ? undefined : Math.max(1, Math.ceil((expiresAt.getTime() - startsAt.getTime()) / 86400000)),
      accessMode: expiresAt === null ? 'UNTIL_REMOVAL' : 'DURATION',
      idempotencyKey: `m10-${studentId}-${courseId}-${startsAt.getTime()}-${Math.random().toString(36).slice(2)}`,
    },
  });
  return world.prisma.subscription.create({
    data: { studentId, courseId, startsAt, expiresAt, purchaseId: purchase.id },
  });
}

const QUIZ_CONTENT = {
  titleAr: 'تقييم',
  titleEn: 'Quiz',
  instructionsAr: 'تعليمات',
  instructionsEn: 'Instructions',
  questions: [
    {
      id: 'q1',
      titleAr: 'س',
      titleEn: 'Q',
      type: 'CHOICE',
      choices: [
        { id: 'a', textAr: 'أ', textEn: 'A' },
        { id: 'b', textAr: 'ب', textEn: 'B' },
      ],
      correctChoiceId: 'a',
    },
  ],
};

async function makeAssessment(world: IdentityWorld, lessonId: string, kind: 'QUIZ' | 'ASSIGNMENT', titleEn: string) {
  return world.prisma.assessment.create({
    data: {
      lessonId,
      kind,
      status: 'PUBLISHED',
      required: true,
      content: QUIZ_CONTENT as never,
      version: 1,
      versions: { create: { version: 1, content: QUIZ_CONTENT as never } },
    },
  });
}

function adminPost(world: IdentityWorld, path: string, jar: { header(): string; csrf(): string }, body: Record<string, unknown>) {
  return request(world.app)
    .post(path)
    .set('Origin', TEST_ORIGIN)
    .set('X-Forwarded-For', uniqueIp())
    .set('Cookie', jar.header())
    .set('X-Csrf-Token', jar.csrf())
    .send(body);
}

function adminGet(world: IdentityWorld, path: string, jar: { header(): string; csrf(): string }) {
  return request(world.app).get(path).set('X-Forwarded-For', uniqueIp()).set('Cookie', jar.header());
}

describe('M10 parent reports backend', () => {
  let world: IdentityWorld;
  let adminJar: { header(): string; csrf(): string };
  let courseA: { id: string };
  let courseB: { id: string };
  let lessonA1: { id: string };
  let lessonA2: { id: string };
  let lessonB1: { id: string };

  beforeAll(async () => {
    world = await createWorld({}, () => NOW.getTime());
    const seed = await seedEnvironment(world);
    adminJar = seed.adminJar;
    courseA = seed.courseA;
    courseB = seed.courseB;
    lessonA1 = seed.lessonA1;
    lessonA2 = seed.lessonA2;
    lessonB1 = seed.lessonB1;
    await ensureM10ViewTablesForTest(world.prisma);
  });

  afterAll(async () => {
    await world.close();
  });

  it('enforces ADMIN/origin/CSRF on every endpoint', async () => {
    const student = await makeStudent(world, 'Guard Student');
    const roster = `/admin/courses/${courseA.id}/students`;
    expect((await adminGet(world, roster, student.jar)).status).toBe(403);
    expect((await request(world.app).get(roster).set('X-Forwarded-For', uniqueIp())).status).toBe(401);
    const views = `/admin/courses/${courseA.id}/students/${student.studentId}/views`;
    expect((await adminGet(world, views, student.jar)).status).toBe(403);
    expect((await request(world.app).get(views).set('X-Forwarded-For', uniqueIp())).status).toBe(401);
    const rc = `/admin/students/${student.studentId}/report-courses`;
    expect((await adminGet(world, rc, student.jar)).status).toBe(403);
    expect((await request(world.app).get(rc).set('X-Forwarded-For', uniqueIp())).status).toBe(401);
    const contact = `/admin/students/${student.studentId}/report-contact`;
    expect((await adminGet(world, contact, student.jar)).status).toBe(403);
    expect((await request(world.app).get(contact).set('X-Forwarded-For', uniqueIp())).status).toBe(401);
    const gen = () => request(world.app).post('/admin/parent-reports/generate').set('X-Forwarded-For', uniqueIp());
    expect((await gen().set('Cookie', student.jar.header()).set('Origin', TEST_ORIGIN).set('X-Csrf-Token', student.jar.csrf()).send({})).status).toBe(403);
    expect((await gen().set('Cookie', adminJar.header()).set('X-Csrf-Token', adminJar.csrf()).send({})).status).toBe(403);
    expect((await gen().set('Cookie', adminJar.header()).set('Origin', TEST_ORIGIN).send({})).status).toBe(403);
    expect((await gen().set('Cookie', adminJar.header())).status).toBe(403);
  });

  it('lists zero-activity students and registered-but-not-enrolled are excluded', async () => {
    await resetM10ViewFactsForTest(world.prisma);
    const zero = await makeStudent(world, 'Zero Activity');
    const noSubs = await makeStudent(world, 'No Subscription');
    await grant(world, zero.studentId, courseA.id, new Date('2026-10-01'), null);
    await setTrackingStartedAt(world.prisma, new Date('2026-10-01T00:00:00Z'));
    const res = await adminGet(world, `/admin/courses/${courseA.id}/students`, adminJar);
    expect(res.status).toBe(200);
    const found = res.body.data.students.find((s: { name: string }) => s.name === 'Zero Activity');
    expect(found).toBeTruthy();
    expect(found.totalViews).toBe(0);
    expect(found.lastViewedAt).toBeNull();
    expect(res.body.data.students.find((s: { name: string }) => s.name === 'No Subscription')).toBeUndefined();
  });

  it('deduplicates package + standalone membership into one row with summed views', async () => {
    await resetM10ViewFactsForTest(world.prisma);
    await makeStudent(world, 'Pkg Student');
    const pkg = await world.prisma.packagePurchase.create({
      data: { studentId: (await world.prisma.user.findFirstOrThrow({ where: { displayName: 'Pkg Student' } })).id, packageId: `pkg-${NOW.getTime().toString(36)}`, version: 1, titleAr: 'باقة', titleEn: 'Package', pricePiastres: 1000, endsAt: new Date('2026-12-01'), idempotencyKey: `pkgkey-${NOW.getTime().toString(36)}` },
    });
    // simpler: create second student row reference
    const pkgStudent = await world.prisma.user.findFirstOrThrow({ where: { displayName: 'Pkg Student' } });
    await grant(world, pkgStudent.id, courseA.id, new Date('2026-10-01'), null, pkg.id);
    await grant(world, pkgStudent.id, courseA.id, new Date('2026-10-05'), null);
    await setTrackingStartedAt(world.prisma, new Date('2026-10-01T00:00:00Z'));
    await insertViewSession(world.prisma, { studentId: pkgStudent.id, courseId: courseA.id, lessonId: lessonA1.id, mediaAssetId: 'asset-a1', startedAt: new Date('2026-10-10T10:00:00Z') });
    await insertViewSession(world.prisma, { studentId: pkgStudent.id, courseId: courseA.id, lessonId: lessonA2.id, mediaAssetId: 'asset-a2', startedAt: new Date('2026-10-11T10:00:00Z') });
    const res = await adminGet(world, `/admin/courses/${courseA.id}/students?q=Pkg`, adminJar);
    expect(res.status).toBe(200);
    const rows = res.body.data.students.filter((s: { name: string }) => s.name === 'Pkg Student');
    expect(rows.length).toBe(1);
    expect(rows[0].totalViews).toBe(2);
  });

  it('keeps expired students in the roster with lifetime totals but excludes them from report-courses', async () => {
    await resetM10ViewFactsForTest(world.prisma);
    const expired = await makeStudent(world, 'Expired Student');
    const indefinite = await makeStudent(world, 'Indefinite Student');
    await grant(world, expired.studentId, courseA.id, new Date('2026-09-01'), new Date('2026-10-01'));
    await grant(world, indefinite.studentId, courseA.id, new Date('2026-10-01'), null);
    await setTrackingStartedAt(world.prisma, new Date('2026-10-01T00:00:00Z'));
    await insertViewSession(world.prisma, { studentId: expired.studentId, courseId: courseA.id, lessonId: lessonA1.id, mediaAssetId: 'asset-a1', startedAt: new Date('2026-09-15T10:00:00Z') });
    const roster = await adminGet(world, `/admin/courses/${courseA.id}/students?q=Expired`, adminJar);
    const row = roster.body.data.students.find((s: { name: string }) => s.name === 'Expired Student');
    expect(row).toBeTruthy();
    expect(row.totalViews).toBe(1);
    const rc = await adminGet(world, `/admin/students/${expired.studentId}/report-courses`, adminJar);
    expect(rc.status).toBe(200);
    expect(rc.body.data.courses.map((c: { courseId: string }) => c.courseId)).not.toContain(courseA.id);
    const rc2 = await adminGet(world, `/admin/students/${indefinite.studentId}/report-courses`, adminJar);
    expect(rc2.body.data.courses.map((c: { courseId: string }) => c.courseId)).toContain(courseA.id);
  });

  it('excludes working-copy/historical courses from canonical eligibility', async () => {
    const list = await adminGet(world, `/admin/students/${(await world.prisma.user.findFirstOrThrow({ where: { displayName: 'Indefinite Student' } })).id}/report-courses`, adminJar);
    expect(list.body.data.courses.length).toBe(1);
    // Simulate a hidden working copy: same student grants there too, but it must not surface.
    const draft = await world.prisma.course.create({
      data: { slug: `m10draft-${NOW.getTime().toString(36)}`, titleAr: 'نسخة', titleEn: 'Draft Copy', descriptionAr: 'و', descriptionEn: 'd', status: 'DRAFT', revisionOwnerId: courseA.id },
    });
    const sid = (await world.prisma.user.findFirstOrThrow({ where: { displayName: 'Indefinite Student' } })).id;
    await grant(world, sid, draft.id, new Date('2026-10-01'), null);
    const list2 = await adminGet(world, `/admin/students/${sid}/report-courses`, adminJar);
    expect(list2.body.data.courses.map((c: { courseId: string }) => c.courseId)).not.toContain(draft.id);
    expect((await adminGet(world, `/admin/courses/${draft.id}/students`, adminJar)).status).toBe(404);
  });

  it('produces bounded cursor pages with a name search', async () => {
    const res = await adminGet(world, `/admin/courses/${courseA.id}/students?limit=2&q=${encodeURIComponent('Student')}`, adminJar);
    expect(res.status).toBe(200);
    expect(res.body.data.students.length).toBeLessThanOrEqual(2);
    if (res.body.data.nextCursor) {
      const res2 = await adminGet(world, `/admin/courses/${courseA.id}/students?limit=2&q=${encodeURIComponent('Student')}&cursor=${encodeURIComponent(res.body.data.nextCursor)}`, adminJar);
      expect(res2.status).toBe(200);
      const ids1 = res.body.data.students.map((s: { studentId: string }) => s.studentId);
      const ids2 = res2.body.data.students.map((s: { studentId: string }) => s.studentId);
      expect(ids1.some((id: string) => ids2.includes(id))).toBe(false);
    }
  });

  it('rejects invalid limit and cursor with 400', async () => {
    expect((await adminGet(world, `/admin/courses/${courseA.id}/students?limit=51`, adminJar)).status).toBe(400);
    expect((await adminGet(world, `/admin/courses/${courseA.id}/students?cursor=garbage`, adminJar)).status).toBe(400);
  });

  it('labels tracking as unavailable (not zero) when state row is missing', async () => {
    await resetM10ViewFactsForTest(world.prisma);
    const s = await makeStudent(world, 'NoTracking');
    await grant(world, s.studentId, courseA.id, new Date('2026-10-01'), null);
    const res = await adminGet(world, `/admin/courses/${courseA.id}/students/${s.studentId}/views`, adminJar);
    expect(res.status).toBe(200);
    expect(res.body.data.trackingStartedAt).toBeNull();
    for (const l of res.body.data.lessons) expect(l.coverage).toBe('UNAVAILABLE');
    const gen = await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.studentId, courseIds: [courseA.id], reportType: 'WEEK', language: 'ar' });
    expect(gen.status).toBe(200);
    expect(gen.body.data.parts[0].text).toContain('غير متاحة');
  });

  it('keeps media-version identity with PARTIAL coverage when a lesson video is replaced', async () => {
    await resetM10ViewFactsForTest(world.prisma);
    const s = await makeStudent(world, 'ReplaceStudent');
    await grant(world, s.studentId, courseA.id, new Date('2026-10-01'), null);
    await setTrackingStartedAt(world.prisma, new Date('2026-10-01T00:00:00Z'));
    await insertViewSession(world.prisma, { studentId: s.studentId, courseId: courseA.id, lessonId: lessonA1.id, mediaAssetId: 'asset-a1-old', startedAt: new Date('2026-10-05T10:00:00Z') });
    const currentMapping = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { lessonId: lessonA1.id } });
    await insertViewSession(world.prisma, { studentId: s.studentId, courseId: courseA.id, lessonId: lessonA1.id, mediaAssetId: currentMapping.id, startedAt: new Date('2026-10-12T10:00:00Z') });
    const res = await adminGet(world, `/admin/courses/${courseA.id}/students/${s.studentId}/views`, adminJar);
    expect(res.status).toBe(200);
    const l = res.body.data.lessons.find((x: { lessonId: string }) => x.lessonId === lessonA1.id);
    expect(l.coverage).toBe('PARTIAL');
    expect(l.totalViews).toBe(2);
    expect(l.mediaAssetId).toBe(currentMapping.id);
    expect(l.mediaAssetId).not.toBe(currentMapping.assetId);
  });

  it('computes exact half-open weekly boundaries and four-week composition', async () => {
    await resetM10ViewFactsForTest(world.prisma);
    const s = await makeStudent(world, 'BoundaryStudent');
    await grant(world, s.studentId, courseA.id, new Date('2026-10-01'), null);
    await setTrackingStartedAt(world.prisma, new Date('2026-10-01T00:00:00Z'));
    // Window: Oct 3 12:00 -> Oct 30 12:00 UTC (28 days). Week boundaries at Oct 3, 10, 17, 24.
    const ts = (iso: string) => new Date(iso);
    const mapping1 = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { lessonId: lessonA1.id } });
    const mapping2 = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { lessonId: lessonA2.id } });
    await insertViewSession(world.prisma, { studentId: s.studentId, courseId: courseA.id, lessonId: lessonA1.id, mediaAssetId: mapping1.id, startedAt: ts('2026-10-03T12:00:00Z') });
    await insertViewSession(world.prisma, { studentId: s.studentId, courseId: courseA.id, lessonId: lessonA2.id, mediaAssetId: mapping2.id, startedAt: ts('2026-10-10T12:00:00Z') });
    await insertViewSession(world.prisma, { studentId: s.studentId, courseId: courseA.id, lessonId: lessonA1.id, mediaAssetId: mapping1.id, startedAt: ts('2026-10-29T00:00:00Z') });
    await insertViewSession(world.prisma, { studentId: s.studentId, courseId: courseA.id, lessonId: lessonA2.id, mediaAssetId: 'asset-a2', startedAt: ts('2026-10-30T12:00:00Z'), countedAt: new Date('2026-10-30T12:00:30Z') }); // exactly at cutoff: excluded
    const gen = await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.studentId, courseIds: [courseA.id], reportType: 'FOUR_WEEKS', language: 'en' });
    expect(gen.status).toBe(200);
    const data = gen.body.data;
    expect(data.period.timeZone).toBe('Africa/Cairo');
    expect(data.period.start).toBe('2026-10-02T12:00:00.000Z');
    expect(data.period.end).toBe('2026-10-30T12:00:00.000Z');
    const text: string = data.parts.map((p: { text: string }) => p.text).join('\n');
    expect(text).toContain('Week 1/4');
    expect(text).toContain('Week 4/4');
    expect(text).toContain('2026-10-02');
    expect(text).toContain('2026-10-30');
    // Week 1 includes the Oct 3 session, not the Oct 10 boundary session (which starts week 2).
    expect(text.indexOf('Week 1/4')).toBeLessThan(text.indexOf('Week 2/4'));
    // Count viewed lines: total "viewed" across the text should equal 3 (3 in-window sessions).
    const viewedCount = (text.match(/viewed/g) ?? []).length;
    expect(viewedCount).toBeGreaterThanOrEqual(3);
  });

  it('splits two-week reports into two weekly sections', async () => {
    const s = await world.prisma.user.findFirstOrThrow({ where: { displayName: 'BoundaryStudent' } });
    const gen = await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.id, courseIds: [courseA.id], reportType: 'TWO_WEEKS', language: 'ar' });
    expect(gen.status).toBe(200);
    const text: string = gen.body.data.parts.map((p: { text: string }) => p.text).join('\n');
    expect(text).toContain('الأسبوع 1/2');
    expect(text).toContain('الأسبوع 2/2');
    expect(text).not.toContain('الأسبوع 3/');
  });

  it('keeps passed status, separates period attempts from earned-pass, and distinguishes checking/service-error/not-submitted', async () => {
    await resetM10ViewFactsForTest(world.prisma);
    const s = await makeStudent(world, 'QuizStudent');
    await grant(world, s.studentId, courseA.id, new Date('2026-10-01'), null);
    const quiz = await makeAssessment(world, lessonA1.id, 'QUIZ', 'Weekly Quiz');
    const assignment = await makeAssessment(world, lessonA2.id, 'ASSIGNMENT', 'Weekly Assignment');
    const noSubmissions = await makeAssessment(world, lessonA2.id, 'QUIZ', 'Third Quiz');
    const checking = await makeAssessment(world, lessonA1.id, 'ASSIGNMENT', 'Pending Assignment');
    const failedOnly = await makeAssessment(world, lessonA1.id, 'QUIZ', 'Failed Quiz');
    const versionId = (await world.prisma.assessmentVersion.findFirstOrThrow({ where: { assessmentId: quiz.id } })).id;
    // Attempts for quiz: 3 attempts; final one CORRECT; pass row present.
    await world.prisma.assessmentSubmission.create({ data: { studentId: s.studentId, assessmentId: quiz.id, versionId, idempotencyKey: 'att1-quiz', inputHash: 'h1', state: 'INCORRECT', result: { correct: false }, createdAt: new Date('2026-10-17T09:00:00Z') } });
    await world.prisma.assessmentSubmission.create({ data: { studentId: s.studentId, assessmentId: quiz.id, versionId, idempotencyKey: 'att2-quiz', inputHash: 'h2', state: 'INCORRECT', result: { correct: false }, createdAt: new Date('2026-10-18T09:00:00Z') } });
    await world.prisma.assessmentSubmission.create({ data: { studentId: s.studentId, assessmentId: quiz.id, versionId, idempotencyKey: 'att3-quiz', inputHash: 'h3', state: 'CORRECT', result: { correct: true }, createdAt: new Date('2026-10-19T09:00:00Z') } });
    await world.prisma.assessmentPass.create({ data: { studentId: s.studentId, assessmentId: quiz.id, passedVersion: 1 }, });
    // Service error on assignment: INCORRECT with CHECKING_UNAVAILABLE.
    const versionId2 = (await world.prisma.assessmentVersion.findFirstOrThrow({ where: { assessmentId: assignment.id } })).id;
    await world.prisma.assessmentSubmission.create({ data: { studentId: s.studentId, assessmentId: assignment.id, versionId: versionId2, idempotencyKey: 'att1-assign', inputHash: 'ha', state: 'INCORRECT', result: { correct: false, error: 'CHECKING_UNAVAILABLE' }, createdAt: new Date('2026-10-19T10:00:00Z') } });
    // Checking: RUNNING submission.
    const versionId3 = (await world.prisma.assessmentVersion.findFirstOrThrow({ where: { assessmentId: checking.id } })).id;
    await world.prisma.assessmentSubmission.create({ data: { studentId: s.studentId, assessmentId: checking.id, versionId: versionId3, idempotencyKey: 'att1-pending', inputHash: 'hp', state: 'RUNNING', createdAt: new Date('2026-10-20T10:00:00Z') } });
    const failedVersion = (await world.prisma.assessmentVersion.findFirstOrThrow({ where: { assessmentId: failedOnly.id } })).id;
    await world.prisma.assessmentSubmission.create({ data: { studentId: s.studentId, assessmentId: failedOnly.id, versionId: failedVersion, idempotencyKey: 'att1-failed', inputHash: 'hf', state: 'INCORRECT', result: { correct: false }, createdAt: new Date('2026-10-20T11:00:00Z') } });
    await setTrackingStartedAt(world.prisma, new Date('2026-10-01T00:00:00Z'));
    const gen = await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.studentId, courseIds: [courseA.id], reportType: 'WEEK', language: 'en' });
    expect(gen.status).toBe(200);
    const text: string = gen.body.data.parts.map((p: { text: string }) => p.text).join('\n');
    expect(text).toContain('passed');
    expect(text).toContain('service error');
    expect(text).toContain('checking');
    expect(text).toContain('not submitted');
    expect(text).toContain('not yet passed');
    // Direct failed attempt (no pass, no error) → not yet passed.
    expect(text).toMatch(/not yet passed/);
  });

  it('isolates courses: a combined report only contains selected membership', async () => {
    const s = await world.prisma.user.findFirstOrThrow({ where: { displayName: 'QuizStudent' } });
    await grant(world, s.id, courseB.id, new Date('2026-10-01'), null);
    await setTrackingStartedAt(world.prisma, new Date('2026-10-01T00:00:00Z'));
    await insertViewSession(world.prisma, { studentId: s.id, courseId: courseB.id, lessonId: lessonB1.id, mediaAssetId: 'asset-b1', startedAt: new Date('2026-10-20T10:00:00Z') });
    const aOnly = await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.id, courseIds: [courseA.id], reportType: 'WEEK', language: 'en' });
    const tA: string = aOnly.body.data.parts.map((p: { text: string }) => p.text).join('\n');
    expect(tA).toContain('Course A');
    expect(tA).not.toContain('Course B');
    const both = await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.id, courseIds: [courseA.id, courseB.id], reportType: 'WEEK', language: 'en' });
    const tB: string = both.body.data.parts.map((p: { text: string }) => p.text).join('\n');
    expect(tB).toContain('Course A');
    expect(tB).toContain('Course B');
  });

  it('rejects invalid memberships and invalid input with actionable errors', async () => {
    const s = await world.prisma.user.findFirstOrThrow({ where: { displayName: 'QuizStudent' } });
    const expiredGrantStudent = await makeStudent(world, 'ExpiredCourse');
    await grant(world, expiredGrantStudent.studentId, courseA.id, new Date('2026-09-01'), new Date('2026-10-01'));
    expect((await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: expiredGrantStudent.studentId, courseIds: [courseA.id], reportType: 'WEEK', language: 'en' })).status).toBe(404);
    expect((await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: 'not-a-uuid', courseIds: [courseA.id], reportType: 'WEEK', language: 'en' })).status).toBe(400);
    expect((await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.id, courseIds: [], reportType: 'WEEK', language: 'en' })).status).toBe(400);
    expect((await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.id, courseIds: [courseA.id], reportType: 'MONTH', language: 'en' })).status).toBe(400);
    expect((await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.id, courseIds: [courseA.id], reportType: 'WEEK', language: 'fr' })).status).toBe(400);
    const many = Array.from({ length: 51 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
    expect((await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.id, courseIds: many, reportType: 'WEEK', language: 'en' })).status).toBe(400);
    expect((await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.id, courseIds: ['00000000-0000-0000-0000-000000000001'], reportType: 'WEEK', language: 'en' })).status).toBe(404);
  });

  it('returns the current guardian number via report-contact and allows missing contact', async () => {
    const s = await makeStudent(world, 'ContactStudent', `010${Math.floor(10000000 + Math.random() * 89999999)}`);
    const profile = await world.prisma.studentProfile.findUniqueOrThrow({ where: { userId: s.studentId } });
    const res = await adminGet(world, `/admin/students/${s.studentId}/report-contact`, adminJar);
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe(profile.parentPhone);
    const noPhone = await makeStudent(world, 'NoPhone', null);
    const res2 = await adminGet(world, `/admin/students/${noPhone.studentId}/report-contact`, adminJar);
    expect(res2.body.data.phone).toBeNull();
    const gen = await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: noPhone.studentId, courseIds: [], reportType: 'WEEK', language: 'ar' });
    expect(gen.status).toBe(400);
  });

  it('reports the guardian phone in generate and sets no-store', async () => {
    const s = await world.prisma.user.findFirstOrThrow({ where: { displayName: 'ContactStudent' } });
    const profile = await world.prisma.studentProfile.findUniqueOrThrow({ where: { userId: s.id } });
    await grant(world, s.id, courseA.id, new Date('2026-10-01'), null);
    const gen = await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.id, courseIds: [courseA.id], reportType: 'WEEK', language: 'ar' });
    expect(gen.status).toBe(200);
    expect(gen.body.data.guardian.phone).toBe(profile.parentPhone);
    expect(gen.headers['cache-control']).toBe('no-store');
  });

  it('labels each pretracking, partial, gap and newly available lesson honestly', async () => {
    await resetM10ViewFactsForTest(world.prisma);
    const s = await makeStudent(world, 'Coverage repair');
    const membership = await grant(world, s.studentId, courseA.id, new Date('2026-09-01'), null);
    const old = new Date('2026-09-01');
    await world.prisma.lesson.updateMany({ where: { section: { courseId: courseA.id } }, data: { createdAt: old } });
    await world.prisma.mediaMapping.updateMany({ where: { lesson: { section: { courseId: courseA.id } } }, data: { createdAt: old, updatedAt: old } });
    await setTrackingStartedAt(world.prisma, new Date('2026-10-25'));
    const gen = () => adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.studentId, courseIds: [courseA.id], reportType: 'FOUR_WEEKS', language: 'en' });
    const partial = await gen();
    const text = partial.body.data.parts.map((p: { text: string }) => p.text).join('\n');
    expect(text).toContain('Lesson One: tracking unavailable');
    expect(text).not.toContain('Lesson One: not viewed');
    await setTrackingStartedAt(world.prisma, old);
    const known = await gen();
    expect(known.body.data.parts.map((p: { text: string }) => p.text).join('\n')).toContain('Lesson One: not viewed');
    await world.prisma.subscription.update({ where: { id: membership.id }, data: { startsAt: new Date('2026-10-26') } });
    const gap = await gen();
    expect(gap.body.data.parts.map((p: { text: string }) => p.text).join('\n')).not.toContain('Lesson One: not viewed');
    await world.prisma.subscription.update({ where: { id: membership.id }, data: { startsAt: old } });
    await world.prisma.lesson.update({ where: { id: lessonA1.id }, data: { createdAt: new Date('2026-10-29') } });
    const fresh = await gen();
    expect(fresh.body.data.parts.map((p: { text: string }) => p.text).join('\n')).not.toContain('Lesson One: not viewed');
    const mapping = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { lessonId: lessonA1.id } });
    await insertViewSession(world.prisma, { studentId: s.studentId, courseId: courseA.id, lessonId: lessonA1.id, mediaAssetId: mapping.id, startedAt: new Date('2026-10-29T10:00:00Z') });
    const positive = await gen();
    expect(positive.body.data.parts.map((p: { text: string }) => p.text).join('\n')).toContain('Lesson One: viewed');
  });

  it('places immutable pass events in the correct week and keeps a deduplicated current summary', async () => {
    await resetM10ViewFactsForTest(world.prisma);
    const s = await makeStudent(world, 'Weekly pass repair');
    await grant(world, s.studentId, courseA.id, new Date('2026-09-01'), null);
    await setTrackingStartedAt(world.prisma, new Date('2026-09-01'));
    const assessment = await makeAssessment(world, lessonA2.id, 'QUIZ', 'Week4');
    await world.prisma.assessmentPass.create({ data: { studentId: s.studentId, assessmentId: assessment.id, passedVersion: 1, passedAt: new Date('2026-10-29T10:00:00Z') } });
    const gen = await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.studentId, courseIds: [courseA.id], reportType: 'FOUR_WEEKS', language: 'en' });
    const text = gen.body.data.parts.map((p: { text: string }) => p.text).join('\n');
    expect(text).toContain('Period summary — current assessment status at generation');
    const beforeWeek4 = text.slice(text.indexOf('Week 1/4'), text.indexOf('Week 4/4'));
    expect(beforeWeek4).not.toMatch(/Quiz .*: passed/);
    expect(beforeWeek4).toContain('no pass recorded this week');
    expect(text.slice(text.indexOf('Week 4/4'))).toMatch(/Quiz .*: passed/);
  });

  it('uses countedAt half-open events and separates one old media version from current views', async () => {
    await resetM10ViewFactsForTest(world.prisma);
    const s = await makeStudent(world, 'Count event repair');
    await grant(world, s.studentId, courseA.id, new Date('2026-09-01'), null);
    await setTrackingStartedAt(world.prisma, new Date('2026-09-01'));
    const start = new Date(NOW.getTime() - 7 * 86400000);
    const mapping = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { lessonId: lessonA1.id } });
    await insertViewSession(world.prisma, { studentId: s.studentId, courseId: courseA.id, lessonId: lessonA1.id, mediaAssetId: mapping.id, startedAt: new Date(start.getTime() - 1000), countedAt: start });
    await insertViewSession(world.prisma, { studentId: s.studentId, courseId: courseA.id, lessonId: lessonA1.id, mediaAssetId: mapping.id, startedAt: new Date(NOW.getTime() - 1000), countedAt: NOW });
    await insertViewSession(world.prisma, { studentId: s.studentId, courseId: courseA.id, lessonId: lessonA2.id, mediaAssetId: 'old-only-version', startedAt: start });
    const facts = await postgresViewFactsReader(world.prisma).sessionsInWindow(s.studentId, [courseA.id], start, NOW);
    expect(facts).toHaveLength(2);
    expect(facts.some((f) => f.startedAt < start && f.countedAt.getTime() === start.getTime())).toBe(true);
    const detail = await adminGet(world, `/admin/courses/${courseA.id}/students/${s.studentId}/views`, adminJar);
    const oldLesson = detail.body.data.lessons.find((l: { lessonId: string }) => l.lessonId === lessonA2.id);
    expect(oldLesson.coverage).toBe('PARTIAL');
    expect(oldLesson.currentMediaViews).toBe(0);
    expect(oldLesson.totalViews).toBe(1);
    expect(oldLesson.mediaVersions).toHaveLength(1);
  });

  it('rejects malformed body, array queries, oversized search and invalid scoped lesson cursors', async () => {
    const s = await makeStudent(world, 'Validation repair');
    await grant(world, s.studentId, courseA.id, new Date('2026-09-01'), null);
    const views = `/admin/courses/${courseA.id}/students/${s.studentId}/views`;
    for (const id of [lessonB1.id, '00000000-0000-0000-0000-000000000001']) {
      const cursor = Buffer.from(JSON.stringify({ name: '', id })).toString('base64url');
      expect((await adminGet(world, `${views}?cursor=${cursor}`, adminJar)).status).toBe(400);
    }
    expect((await adminGet(world, `${views}?limit=1&limit=2`, adminJar)).status).toBe(400);
    expect((await adminGet(world, `${views}?cursor=a&cursor=b`, adminJar)).status).toBe(400);
    expect((await adminGet(world, `/admin/courses/${courseA.id}/students?q=${'a'.repeat(101)}`, adminJar)).status).toBe(400);
    expect((await adminGet(world, `/admin/courses/${courseA.id}/students?q=a&q=b`, adminJar)).status).toBe(400);
    const invalidRosterCursor = Buffer.from(JSON.stringify({ name: 'Nobody', id: '00000000-0000-0000-0000-000000000001' })).toString('base64url');
    expect((await adminGet(world, `/admin/courses/${courseA.id}/students?cursor=${invalidRosterCursor}`, adminJar)).status).toBe(400);
    const malformed = await request(world.app).post('/admin/parent-reports/generate').set('Origin', TEST_ORIGIN).set('Cookie', adminJar.header()).set('X-Csrf-Token', adminJar.csrf()).set('X-Forwarded-For', uniqueIp()).set('Content-Type', 'application/json').send('null');
    expect(malformed.status).toBe(400);
  });

  it('bounds every actual Arabic combined four-week API part for a 4000-character click-to-chat URL', async () => {
    const s = await makeStudent(world, 'Arabic length repair');
    await grant(world, s.studentId, courseA.id, new Date('2026-09-01'), null);
    await grant(world, s.studentId, courseB.id, new Date('2026-09-01'), null);
    const original = await world.prisma.lesson.findUniqueOrThrow({ where: { id: lessonB1.id } });
    const title = 'عنوان عربي طويل 🧑‍💻 '.repeat(120);
    await world.prisma.lesson.update({ where: { id: lessonB1.id }, data: { titleAr: title } });
    try {
      const gen = await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.studentId, courseIds: [courseA.id, courseB.id], reportType: 'FOUR_WEEKS', language: 'ar' });
      expect(gen.status).toBe(200);
      expect(gen.body.data.parts.length).toBeGreaterThan(4);
      for (const p of gen.body.data.parts as Array<{ text: string }>) {
        expect(p.text.length).toBeLessThanOrEqual(1000);
        expect(`https://wa.me/201000000000000?text=${encodeURIComponent(p.text)}`.length).toBeLessThanOrEqual(4000);
      }
    } finally { await world.prisma.lesson.update({ where: { id: lessonB1.id }, data: { titleAr: original.titleAr } }); }
  });

  it('reads a coherent snapshot while a counted view and grading pass are written after the first report read', async () => {
    await resetM10ViewFactsForTest(world.prisma);
    const s = await makeStudent(world, 'Snapshot repair');
    await grant(world, s.studentId, courseA.id, new Date('2026-09-01'), null);
    await setTrackingStartedAt(world.prisma, new Date('2026-09-01'));
    const mapping = await world.prisma.mediaMapping.findUniqueOrThrow({ where: { lessonId: lessonA2.id } });
    const assessment = await makeAssessment(world, lessonA2.id, 'QUIZ', 'Snapshot');
    let wrote = false;
    const extended = world.prisma.$extends({ query: { user: { async findUnique({ args, query }) {
      const result = await query(args);
      if (!wrote) {
        wrote = true;
        await insertViewSession(world.prisma, { studentId: s.studentId, courseId: courseA.id, lessonId: lessonA2.id, mediaAssetId: mapping.id, startedAt: new Date('2026-10-29T10:00:00Z') });
        await world.prisma.assessmentPass.create({ data: { studentId: s.studentId, assessmentId: assessment.id, passedVersion: 1, passedAt: new Date('2026-10-29T10:00:00Z') } });
      }
      return result;
    } } } });
    const gen = await generateParentReport(extended as unknown as typeof world.prisma, undefined, { studentId: s.studentId, courseIds: [courseA.id], reportType: 'WEEK', language: 'en', nowMs: NOW.getTime() });
    expect(wrote).toBe(true);
    expect(gen.parts.map((p) => p.text).join('\n')).not.toContain('Lesson Two: viewed');
    expect(gen.parts.map((p) => p.text).join('\n')).not.toMatch(/Quiz .*: passed/);
    const next = await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.studentId, courseIds: [courseA.id], reportType: 'WEEK', language: 'en' });
    expect(next.body.data.parts.map((p: { text: string }) => p.text).join('\n')).toContain('Lesson Two: viewed');
    expect(next.body.data.parts.map((p: { text: string }) => p.text).join('\n')).toMatch(/Quiz .*: passed/);
  });

  it('does not persist generated reports or leak them into logs', async () => {
    const tables = await world.prisma.$queryRawUnsafe<Array<{ tablename: string }>>(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
    const names = tables.map((t) => t.tablename);
    expect(names.some((n) => /parent[-_]?report/i.test(n))).toBe(false);
    expect(names.some((n) => /report/i.test(n))).toBe(false);
  });
  it('returns one short combined message in either language and rejects invalid format', async () => {
    const s = await makeStudent(world, 'Short report student');
    await grant(world, s.studentId, courseA.id, new Date('2026-09-01'), null);
    await grant(world, s.studentId, courseB.id, new Date('2026-09-01'), null);
    for (const language of ['ar', 'en']) {
      const gen = await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.studentId, courseIds: [courseA.id, courseB.id], reportType: 'FOUR_WEEKS', language, format: 'SHORT' });
      expect(gen.status).toBe(200);
      expect(gen.body.data.parts).toHaveLength(1);
      const part = gen.body.data.parts[0];
      expect(part.index).toBe(1); expect(part.total).toBe(1);
      expect(part.text.match(language === 'ar' ? /تقرير ولي الأمر/g : /Parent Report/g)).toHaveLength(1);
      expect(part.text.match(language === 'ar' ? /الأسبوع [١-٤]/g : /Week [1-4]/g)).toHaveLength(8);
      expect(part.text).not.toContain('— 1/1 —');
    }
    const invalid = await adminPost(world, '/admin/parent-reports/generate', adminJar, { studentId: s.studentId, courseIds: [courseA.id], reportType: 'WEEK', language: 'ar', format: 'INVALID' });
    expect(invalid.status).toBe(400);
  });
});
