import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createLearningWorld, createPublishedCourse, grantSubscription, studentGet, studentPost, type LearningWorld } from './learning-helpers.js';
import { adminPost } from './catalog-helpers.js';
import { TEST_ORIGIN } from './identity-helpers.js';
import { requestPreparation, processPreparation, preparationStatus } from '../../src/modules/assessments/preparation.js';
import { processSubmission, reconcilePreparations } from '../../src/modules/assessments/worker.js';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
let w: LearningWorld; let course: Awaited<ReturnType<typeof createPublishedCourse>>; let id: string;
const source = { html: '', css: '', javascript: '' };
const material = (reference = 'console.log(Number(readline()) ** 2)') => ({ titleAr: 'اختبار', titleEn: 'Test', instructionsAr: 'حل', instructionsEn: 'Solve', questions: [{ id: 'p', type: 'PROGRAM', titleAr: 'مربع', titleEn: 'Square', starter: source, program: { inputAr: 'رقم', inputEn: 'Number', outputAr: 'مربع', outputEn: 'Square', comparison: 'tokens', samples: [{ input: '3', output: '9' }], reference, generator: { mode: 'integer', min: -10, max: 10, count: 2 } } }] });
const prepared = { correct: true, results: [{ questionId: 'p', tests: [{ input: '3', output: '9' }, { input: '-4', output: '16' }] }] };
beforeAll(async () => {
  w = await createLearningWorld(); course = await createPublishedCourse(w, 'program');
  await grantSubscription(w, w.studentId, course.courseId, Date.now() + 86400000);
  const made = await adminPost(w.app, `/admin/assessments/lessons/${course.lessonId}`, w.adminJar, { kind: 'QUIZ', required: false, content: material() });
  expect(made.status).toBe(201); id = made.body.data.id;
});
afterAll(async () => { await w?.fixture?.stop(); await w?.close(); });
describe('durable private program preparation', () => {
  it('requires a prepared snapshot before publication and rejects student preparation access', async () => {
    const denied = await adminPost(w.app, `/admin/assessments/${id}/publish`, w.adminJar); expect(denied.status).toBe(409); expect(denied.body.error.code).toBe('TESTS_NOT_READY');
    expect((await studentPost(w.app, `/admin/assessments/${id}/prepare`, w.studentJar)).status).toBe(403);
    expect((await studentGet(w.app, `/admin/assessments/${id}/preparation`, w.studentJar)).status).toBe(403);
  });
  it('deduplicates concurrent requests, claims once, and publishes frozen cases without source', async () => {
    const jobs = await Promise.all(Array.from({ length: 5 }, () => requestPreparation(w.prisma, w.adminUser.id, id)));
    expect(new Set(jobs.map((j) => j.id)).size).toBe(1); let calls = 0;
    await Promise.all(Array.from({ length: 3 }, () => processPreparation(w.prisma, jobs[0]!.id, async (input) => { calls++; expect((input as { mode: string }).mode).toBe('prepare'); return prepared; })));
    expect(calls).toBe(1); expect((await preparationStatus(w.prisma, id)).state).toBe('READY');
    expect((await adminPost(w.app, `/admin/assessments/${id}/publish`, w.adminJar)).status).toBe(200);
    const version = await w.prisma.assessmentVersion.findFirstOrThrow({ where: { assessmentId: id } });
    const stored = JSON.stringify(version.content); expect(stored).toContain('tests'); expect(stored).not.toContain('reference'); expect(stored).not.toContain('generator');
    const publicView = await studentGet(w.app, `/assessments/${id}`, w.studentJar); expect(publicView.status).toBe(200);
    const safe = JSON.stringify(publicView.body.data.content); for (const hidden of ['tests', 'reference', 'generator', '-4']) expect(safe).not.toContain(hidden);
  });
  it('rejects forged grading counts and only records a pass for the frozen total', async () => {
    const submit = () => studentPost(w.app, `/assessments/${id}/submit`, w.studentJar, { version: 1, idempotencyKey: randomUUID(), answers: [{ questionId: 'p', source }] });
    const bad = await submit(); expect(bad.status).toBe(202);
    await processSubmission(w.prisma, bad.body.data.id, async () => ({ correct: true, results: [{ questionId: 'p', correct: true, checksPassed: 1, checksTotal: 1 }] }));
    expect((await w.prisma.assessmentSubmission.findUniqueOrThrow({ where: { id: bad.body.data.id } })).state).toBe('ERROR');
    expect(await w.prisma.assessmentPass.count({ where: { assessmentId: id } })).toBe(0);
    const good = await submit(); expect(good.status).toBe(202);
    await processSubmission(w.prisma, good.body.data.id, async () => ({ correct: true, results: [{ questionId: 'p', correct: true, checksPassed: 2, checksTotal: 2 }] }));
    expect((await w.prisma.assessmentSubmission.findUniqueOrThrow({ where: { id: good.body.data.id } })).state).toBe('CORRECT');
  });
  it('invalidates changed drafts, safely reports errors, retries and recovers stale leases', async () => {
    const updated = await request(w.app).put(`/admin/assessments/${id}`).set('Origin', TEST_ORIGIN).set('Cookie', w.adminJar.header()).set('X-Csrf-Token', w.adminJar.csrf()).send({ kind: 'QUIZ', required: false, content: material('console.log(1)') }); expect(updated.status).toBe(200);
    expect((await preparationStatus(w.prisma, id)).state).toBe('UNPREPARED');
    expect((await adminPost(w.app, `/admin/assessments/${id}/publish`, w.adminJar)).status).toBe(409);
    const job = await requestPreparation(w.prisma, w.adminUser.id, id);
    await processPreparation(w.prisma, job.id, async () => ({ correct: false, results: [{ error: 'SAMPLE_MISMATCH' }] }));
    expect((await preparationStatus(w.prisma, id))).toMatchObject({ state: 'FAILED', error: 'SAMPLE_MISMATCH' });
    const retry = await requestPreparation(w.prisma, w.adminUser.id, id); expect(retry.id).toBe(job.id);
    await w.prisma.assessmentPreparation.update({ where: { id: job.id }, data: { state: 'RUNNING', leaseToken: randomUUID(), leasedUntil: new Date(Date.now() - 1000) } });
    await processPreparation(w.prisma, job.id, async () => { throw new Error('private-secret-and-source'); });
    expect(await preparationStatus(w.prisma, id)).toMatchObject({ state: 'FAILED', error: 'CHECKING_UNAVAILABLE' });
    expect(JSON.stringify(await preparationStatus(w.prisma, id))).not.toContain('private-secret');
    // Existing public version and earned pass remain usable despite failed draft.
    expect((await studentGet(w.app, `/assessments/${id}`, w.studentJar)).body.data).toMatchObject({ version: 1, passed: true });
  });
  it('recovers lost preparation delivery and retained failed jobs through real BullMQ', async () => {
    const job = await requestPreparation(w.prisma, w.adminUser.id, id);
    const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
    const queue = new Queue(`program-recovery-${randomUUID()}`, { connection: connection as never });
    let worker: Worker<unknown, void> | undefined;
    try {
      expect(await queue.getJob(job.id)).toBeUndefined(); await reconcilePreparations(w.prisma, queue);
      expect(await (await queue.getJob(job.id))!.getState()).toBe('waiting');
      worker = new Worker<unknown, void>(queue.name, async () => { throw new Error('synthetic queue outage'); }, { connection: connection as never });
      for (let n = 0; n < 100 && await (await queue.getJob(job.id))!.getState() !== 'failed'; n++) await new Promise((r) => setTimeout(r, 50));
      expect(await (await queue.getJob(job.id))!.getState()).toBe('failed'); await worker.close(); worker = undefined;
      await reconcilePreparations(w.prisma, queue);
      worker = new Worker<unknown, void>(queue.name, async (item) => { await processPreparation(w.prisma, item.id!, async () => ({ correct: false, results: [{ error: 'SAMPLE_MISMATCH' }] })); }, { connection: connection as never });
      for (let n = 0; n < 100 && (await preparationStatus(w.prisma, id)).state !== 'FAILED'; n++) await new Promise((r) => setTimeout(r, 50));
      expect(await preparationStatus(w.prisma, id)).toMatchObject({ state: 'FAILED', error: 'SAMPLE_MISMATCH' });
    } finally { await worker?.close(); await queue.obliterate({ force: true }); await queue.close(); await connection.quit(); }
  });
  it('caps outstanding preparations without losing existing work', async () => {
    const markers = Array.from({ length: 32 }, (_, n) => `capacity-${n}`);
    await w.prisma.assessmentPreparation.createMany({ data: markers.map((hash) => ({ assessmentId: id, contentHash: hash, content: material() })) });
    try {
      await expect(requestPreparation(w.prisma, w.adminUser.id, id)).rejects.toMatchObject({ code: 'PREPARATION_BUSY', status: 429 });
      expect(await w.prisma.assessmentPreparation.count({ where: { assessmentId: id, contentHash: { in: markers }, state: 'PENDING' } })).toBe(32);
    } finally { await w.prisma.assessmentPreparation.deleteMany({ where: { assessmentId: id, contentHash: { in: markers } } }); }
  });
  it('cascades private preparation snapshots when the assessment is deleted', async () => {
    await w.prisma.assessment.delete({ where: { id } }); expect(await w.prisma.assessmentPreparation.count({ where: { assessmentId: id } })).toBe(0);
  });
});
