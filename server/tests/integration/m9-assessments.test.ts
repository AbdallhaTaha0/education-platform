import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createLearningWorld, createPublishedCourse, grantSubscription, studentGet, studentPost, type LearningWorld } from './learning-helpers.js';
import { adminPost } from './catalog-helpers.js';
import { TEST_ORIGIN, registerStudent, type Jar } from './identity-helpers.js';
import { processSubmission, reconcileGrading, retainGradingHistory } from '../../src/modules/assessments/worker.js';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { reserveRun, adjustQuota, readQuota } from '../../src/modules/assessments/quota.js';

let w: LearningWorld; let c: Awaited<ReturnType<typeof createPublishedCourse>>;
let a: string; let v: number;
const material = (title = 'Test') => ({ titleAr: 'اختبار', titleEn: title, instructionsAr: 'اختر', instructionsEn: 'Choose', questions: [{ id: 'q1', type: 'CHOICE', titleAr: 'سؤال', titleEn: 'Question', choices: [{ id: 'a', textAr: 'الأول', textEn: 'First' }, { id: 'b', textAr: 'الثاني', textEn: 'Second' }], correctChoiceId: 'b' }] });
const send = (choiceId: string, idempotencyKey = randomUUID(), version = v) => studentPost(w.app, `/assessments/${a}/submit`, w.studentJar, { version, idempotencyKey, answers: [{ questionId: 'q1', choiceId }] });
const put = (path: string, jar: Jar, body: object) => request(w.app).put(path).set('Origin', TEST_ORIGIN).set('Cookie', jar.header()).set('X-Csrf-Token', jar.csrf()).send(body);
beforeAll(async () => {
  w = await createLearningWorld(); c = await createPublishedCourse(w, 'm9', { extraLessons: 2 });
  await grantSubscription(w, w.studentId, c.courseId, Date.now() + 86400000);
  const created = await adminPost(w.app, `/admin/assessments/lessons/${c.lessonId}`, w.adminJar, { kind: 'QUIZ', required: true, content: material() });
  expect(created.status).toBe(201); a = created.body.data.id;
  const published = await adminPost(w.app, `/admin/assessments/${a}/publish`, w.adminJar); expect(published.status).toBe(200); v = published.body.data.version;
});
afterAll(async () => { await w?.fixture?.stop(); await w?.close(); });

describe('M9 grading, privacy and progression', () => {
  it('strips private answers and author drafts from both student surfaces', async () => {
    const detail = await studentGet(w.app, `/assessments/${a}`, w.studentJar);
    expect(detail.status).toBe(200); expect(JSON.stringify(detail.body)).not.toContain('correctChoiceId');
    await put(`/admin/assessments/${a}`, w.adminJar, { kind: 'QUIZ', required: false, content: material('PRIVATE-DRAFT-TITLE') });
    const list = await studentGet(w.app, `/assessments/lessons/${c.lessonId}`, w.studentJar);
    expect(list.body.data.assessments[0]).toMatchObject({ titleEn: 'Test', required: true });
    expect(JSON.stringify(list.body)).not.toContain('PRIVATE-DRAFT');
  });
  it('gates the outline, next lesson and direct playback server-side', async () => {
    const outline = await studentGet(w.app, `/learning/courses/${c.slug}/outline`, w.studentJar);
    expect(outline.status).toBe(200); expect(outline.body.data.sections[0].lessons[1]).toMatchObject({ locked: true, playable: false });
    expect((await studentGet(w.app, `/assessments/lessons/${c.lessonIds[1]}`, w.studentJar)).status).toBe(403);
    expect((await studentPost(w.app, `/learning/courses/${c.slug}/lessons/${c.lessonIds[1]}/playback`, w.studentJar, { deviceId: randomUUID() })).status).toBe(403);
  });
  it('durably accepts one pending job, deduplicates and rejects changed retries', async () => {
    const key = randomUUID(); const first = await send('a', key); expect(first.status).toBe(202);
    const duplicate = await send('a', key); expect(duplicate.body.data).toMatchObject({ id: first.body.data.id, duplicate: true });
    expect((await send('b', key)).status).toBe(409); expect((await send('b')).status).toBe(429);
    const budget = await w.prisma.assessmentQueueBudget.findUniqueOrThrow({ where: { id: 1 } }); expect(budget.pending).toBe(1);
    await processSubmission(w.prisma, first.body.data.id);
    const result = await studentGet(w.app, `/assessments/submissions/${first.body.data.id}`, w.studentJar);
    expect(result.body.data.state).toBe('INCORRECT'); expect(await w.prisma.assessmentPass.count({ where: { studentId: w.studentId } })).toBe(0);
    expect((await w.prisma.assessmentQueueBudget.findUniqueOrThrow({ where: { id: 1 } })).pending).toBe(0);
  });
  it('allows unlimited new retries and keeps earned passes after publication changes', async () => {
    const key = randomUUID(); const first = await send('b', key); expect(first.status).toBe(202);
    await Promise.all([processSubmission(w.prisma, first.body.data.id), processSubmission(w.prisma, first.body.data.id)]);
    expect((await studentGet(w.app, `/assessments/submissions/${first.body.data.id}`, w.studentJar)).body.data.state).toBe('CORRECT');
    expect(await w.prisma.assessmentPass.count({ where: { studentId: w.studentId, assessmentId: a } })).toBe(1);
    expect((await studentGet(w.app, `/assessments/lessons/${c.lessonIds[1]}`, w.studentJar)).status).toBe(200);
    await adminPost(w.app, `/admin/assessments/${a}/publish`, w.adminJar);
    expect((await send('b', key, 1)).body.data).toMatchObject({ id: first.body.data.id, duplicate: true });
    expect((await send('b', randomUUID(), 1)).status).toBe(409);
    expect((await studentGet(w.app, `/assessments/${a}`, w.studentJar)).body.data.passed).toBe(true);
    v = 2;
  });
  it('optional exercises do not lock the next lesson', async () => {
    const made = await adminPost(w.app, `/admin/assessments/lessons/${c.lessonIds[1]}`, w.adminJar, { kind: 'ASSIGNMENT', required: false, content: material() });
    await adminPost(w.app, `/admin/assessments/${made.body.data.id}/publish`, w.adminJar);
    expect((await studentGet(w.app, `/assessments/lessons/${c.lessonIds[2]}`, w.studentJar)).status).toBe(200);
  });
  it('preserves rollout reach without inventing a pass or bypassing subscription expiry', async () => {
    const made = await adminPost(w.app, `/admin/assessments/lessons/${c.lessonIds[1]}`, w.adminJar, { kind: 'QUIZ', required: true, content: material() });
    await adminPost(w.app, `/admin/assessments/${made.body.data.id}/publish`, w.adminJar);
    expect((await studentGet(w.app, `/assessments/lessons/${c.lessonIds[2]}`, w.studentJar)).status).toBe(403);
    await w.prisma.preservedLessonUnlock.create({ data: { studentId: w.studentId, lessonId: c.lessonIds[2]! } });
    expect((await studentGet(w.app, `/assessments/lessons/${c.lessonIds[2]}`, w.studentJar)).status).toBe(200);
    expect(await w.prisma.assessmentPass.count({ where: { studentId: w.studentId, assessmentId: made.body.data.id } })).toBe(0);
  });
  it('rejects unauthorized roles, missing CSRF, anonymous access and other student submissions', async () => {
    expect((await request(w.app).get('/assessments/practice')).status).toBe(401);
    expect((await studentGet(w.app, '/assessments/practice', w.adminJar)).status).toBe(403);
    expect((await studentPost(w.app, '/admin/assessments/students/x/quota', w.studentJar)).status).toBe(403);
    expect((await studentPost(w.app, '/assessments/practice/run', w.studentJar, { idempotencyKey: randomUUID() }, { withCsrf: false })).status).toBe(403);
    const other = await registerStudent(w.app); const row = await w.prisma.assessmentSubmission.findFirstOrThrow({ where: { studentId: w.studentId } });
    expect((await studentGet(w.app, `/assessments/submissions/${row.id}`, other.jar)).status).toBe(404);
    expect((await studentGet(w.app, '/assessments/practice', other.jar)).status).toBe(403);
  });
  it('keeps server drafts revision-safe and never executes stored code on the API', async () => {
    const body = { revision: 0, content: { html: '<script>throw Error()</script>', css: '', javascript: 'while(true){}' } };
    const saved = await put('/assessments/practice/draft', w.studentJar, body); expect(saved.status).toBe(200);
    expect(saved.body.data.revision).toBe(1); expect((await put('/assessments/practice/draft', w.studentJar, body)).status).toBe(409);
    expect((await studentGet(w.app, '/assessments/practice', w.studentJar)).body.data.draft.content).toEqual(body.content);
  });
});

describe('M9 allowance concurrency and durable administration', () => {
  it('accepts exactly 50 concurrent distinct Runs and charges duplicate keys once', async () => {
    const now = Date.now(); const outcomes = await Promise.allSettled(Array.from({ length: 52 }, () => reserveRun(w.prisma, w.studentId, randomUUID(), now)));
    expect(outcomes.filter((x) => x.status === 'fulfilled')).toHaveLength(50);
    expect(outcomes.filter((x) => x.status === 'rejected').map((x) => (x as PromiseRejectedResult).reason.code)).toEqual(['PRACTICE_LIMIT_REACHED', 'PRACTICE_LIMIT_REACHED']);
    const run = await w.prisma.practiceRun.findFirstOrThrow({ where: { studentId: w.studentId } });
    expect(await reserveRun(w.prisma, w.studentId, run.idempotencyKey, now)).toMatchObject({ duplicate: true, used: 50, remaining: 0 });
  });
  it('persists overrides, lowering leaves zero, reset anchors recurring 24h and retries never reset twice', async () => {
    const now = Date.now(); const key = randomUUID();
    expect(await adjustQuota(w.prisma, w.adminUser.id, w.studentId, 'LIMIT', 10, now, randomUUID())).toMatchObject({ used: 50, limit: 10, remaining: 0 });
    const reset = await adjustQuota(w.prisma, w.adminUser.id, w.studentId, 'RESET', null, now, key);
    expect(reset).toMatchObject({ used: 0, remaining: 10, schedule: 'ANCHORED_24H' });
    expect(reset.nextResetAt.getTime()).toBe(now + 86400000);
    await reserveRun(w.prisma, w.studentId, randomUUID(), now + 1000);
    expect(await adjustQuota(w.prisma, w.adminUser.id, w.studentId, 'RESET', null, now + 2000, key)).toMatchObject({ used: 1 });
    const rolled = await readQuota(w.prisma, w.studentId, now + 3 * 86400000 + 1);
    expect(rolled).toMatchObject({ remaining: 10, used: 0, schedule: 'ANCHORED_24H' }); expect(rolled.nextResetAt.getTime()).toBe(now + 4 * 86400000);
    expect(await adjustQuota(w.prisma, w.adminUser.id, w.studentId, 'LIMIT', null, now + 3 * 86400000 + 2, randomUUID())).toMatchObject({ limit: 50, schedule: 'ANCHORED_24H' });
  });
  it('bounded queue admission is atomic and capacity release survives cascade deletion', async () => {
    await w.prisma.assessmentQueueBudget.update({ where: { id: 1 }, data: { capacity: 1 } });
    const first = await send('a'); expect(first.status).toBe(202);
    const other = await registerStudent(w.app); await grantSubscription(w, other.user.id, c.courseId, Date.now() + 86400000);
    const busy = await studentPost(w.app, `/assessments/${a}/submit`, other.jar, { version: v, idempotencyKey: randomUUID(), answers: [{ questionId: 'q1', choiceId: 'a' }] });
    expect(busy.status).toBe(503); expect(busy.body.error.code).toBe('CHECKING_BUSY');
    await w.prisma.assessmentSubmission.delete({ where: { id: first.body.data.id } });
    expect((await w.prisma.assessmentQueueBudget.findUniqueOrThrow({ where: { id: 1 } })).pending).toBe(0);
    await w.prisma.assessmentQueueBudget.update({ where: { id: 1 }, data: { capacity: 10000 } });
  });
  it('rejects forged runner result shapes and treats sandbox failures as errors without a pass', async () => {
    const create = await adminPost(w.app, `/admin/assessments/lessons/${c.lessonId}`, w.adminJar, { kind: 'ASSIGNMENT', required: false, content: { ...material(), questions: [{ id: 'code', type: 'CODING', titleAr: 'كود', titleEn: 'Code', starter: { html: '', css: '', javascript: '' }, checks: [{ type: 'function', name: 'sum', args: [1, 2], expected: 3 }] }] } });
    const id = create.body.data.id; await adminPost(w.app, `/admin/assessments/${id}/publish`, w.adminJar);
    const submit = await studentPost(w.app, `/assessments/${id}/submit`, w.studentJar, { version: 1, idempotencyKey: randomUUID(), answers: [{ questionId: 'code', source: { html: '', css: '', javascript: '' } }] });
    await processSubmission(w.prisma, submit.body.data.id, async () => ({ correct: true, results: [{ questionId: 'code', correct: true, checksTotal: 1, checksPassed: 0 }] }));
    expect((await w.prisma.assessmentSubmission.findUniqueOrThrow({ where: { id: submit.body.data.id } })).state).toBe('ERROR');
    expect(await w.prisma.assessmentPass.count({ where: { assessmentId: id } })).toBe(0);
  });
});

describe('M9 durable recovery and lifecycle', () => {
  it('recovers lost delivery, retained failed jobs and stale DB leases through real BullMQ', async () => {
    const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
    const queue = new Queue(`m9-recovery-${randomUUID()}`, { connection: connection as never });
    let worker: Worker<unknown, void> | undefined;
    try {
      const accepted = await send('b'); expect(accepted.status).toBe(202);
      const id = accepted.body.data.id as string;
      // Crash after durable acceptance: no queue record exists yet.
      expect(await queue.getJob(id)).toBeUndefined();
      await reconcileGrading(w.prisma, queue);
      expect(await (await queue.getJob(id))!.getState()).toBe('waiting');
      // Stage a real retained terminal failure, then repair its cause.
      worker = new Worker<unknown, void>(queue.name, async () => { throw new Error('synthetic worker outage'); }, { connection: connection as never });
      for (let n = 0; n < 120 && await (await queue.getJob(id))!.getState() !== 'failed'; n++) await new Promise((r) => setTimeout(r, 100));
      expect(await (await queue.getJob(id))!.getState()).toBe('failed');
      await worker!.close(); worker = undefined;
      await w.prisma.assessmentSubmission.update({ where: { id }, data: { state: 'RUNNING', leaseToken: randomUUID(), leasedUntil: new Date(Date.now() - 1000) } });
      await reconcileGrading(w.prisma, queue);
      worker = new Worker<unknown, void>(queue.name, async (job) => { await processSubmission(w.prisma, job.id!); }, { connection: connection as never });
      for (let n = 0; n < 60 && (await w.prisma.assessmentSubmission.findUniqueOrThrow({ where: { id } })).state !== 'CORRECT'; n++) await new Promise((r) => setTimeout(r, 100));
      expect((await w.prisma.assessmentSubmission.findUniqueOrThrow({ where: { id } })).state).toBe('CORRECT');
      expect(await w.prisma.assessmentPass.count({ where: { studentId: w.studentId, assessmentId: a } })).toBe(1);
      expect((await w.prisma.assessmentQueueBudget.findUniqueOrThrow({ where: { id: 1 } })).pending).toBe(0);
    } finally { await worker?.close(); await queue.obliterate({ force: true }); await queue.close(); await connection.quit(); }
  });
  it('retains earned passes while expiring old terminal history, and keeps outstanding work', async () => {
    const old = new Date(Date.now() - 181 * 86400000);
    await w.prisma.assessmentSubmission.updateMany({ where: { studentId: w.studentId, state: { notIn: ['PENDING', 'RUNNING'] } }, data: { createdAt: old } });
    const accepted = await send('a'); expect(accepted.status).toBe(202);
    await w.prisma.assessmentSubmission.update({ where: { id: accepted.body.data.id }, data: { createdAt: old } });
    await retainGradingHistory(w.prisma);
    expect(await w.prisma.assessmentSubmission.count({ where: { studentId: w.studentId } })).toBe(1);
    expect(await w.prisma.assessmentPass.count({ where: { studentId: w.studentId, assessmentId: a } })).toBe(1);
    await processSubmission(w.prisma, accepted.body.data.id);
  });
  it('preserved reach never bypasses an expired subscription', async () => {
    const subscriptions = await w.prisma.subscription.findMany({ where: { studentId: w.studentId, courseId: c.courseId } });
    try {
      await w.prisma.subscription.updateMany({ where: { studentId: w.studentId, courseId: c.courseId }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await studentGet(w.app, `/assessments/lessons/${c.lessonIds[2]}`, w.studentJar)).status).toBe(403);
      expect((await studentGet(w.app, '/assessments/practice', w.studentJar)).status).toBe(403);
    } finally { for (const s of subscriptions) await w.prisma.subscription.update({ where: { id: s.id }, data: { expiresAt: s.expiresAt } }); }
  });
  it('permanent lesson cascade removes private code, drafts, passes and pending capacity', async () => {
    const accepted = await send('a'); expect(accepted.status).toBe(202);
    expect((await put(`/assessments/${a}/draft`, w.studentJar, { version: v, revision: 0, content: [{ questionId: 'q1', choiceId: 'a' }] })).status).toBe(200);
    await w.prisma.lesson.delete({ where: { id: c.lessonId } });
    expect(await w.prisma.assessment.count({ where: { lessonId: c.lessonId } })).toBe(0);
    expect(await w.prisma.assessmentVersion.count({ where: { assessmentId: a } })).toBe(0);
    expect(await w.prisma.assessmentDraft.count({ where: { assessmentId: a } })).toBe(0);
    expect(await w.prisma.assessmentPass.count({ where: { assessmentId: a } })).toBe(0);
    expect(await w.prisma.assessmentSubmission.count({ where: { assessmentId: a } })).toBe(0);
    expect((await w.prisma.assessmentQueueBudget.findUniqueOrThrow({ where: { id: 1 } })).pending).toBe(0);
  });
});
