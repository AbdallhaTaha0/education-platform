import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createLearningWorld, createPublishedCourse, grantSubscription, studentGet, studentPost, type LearningWorld } from './learning-helpers.js';
import { adminPost } from './catalog-helpers.js';
import { TEST_ORIGIN, registerStudent } from './identity-helpers.js';
import { processPythonRun } from '../../src/modules/assessments/python-runs.js';
import { reserveRun, readQuota } from '../../src/modules/assessments/quota.js';
import { processPreparation, requestPreparation } from '../../src/modules/assessments/preparation.js';
import { processSubmission } from '../../src/modules/assessments/worker.js';
import { executeIsolated } from '../../src/modules/assessments/launcher.js';
import { runPython } from '../../src/modules/assessments/python.js';

let w: LearningWorld; let course: Awaited<ReturnType<typeof createPublishedCourse>>; let assessment: string;
const source = { html: '', css: '', javascript: '', python: 'n = int(input())\nprint(n ** 2)' };
const material = { ide: 'python', titleAr: 'مربع', titleEn: 'Python square', instructionsAr: 'حل', instructionsEn: 'Solve', questions: [{ id: 'p', type: 'PROGRAM', titleAr: 'رقم', titleEn: 'Number', starter: source, program: { inputAr: 'رقم', inputEn: 'Number', outputAr: 'مربع', outputEn: 'Square', comparison: 'tokens', samples: [{ input: '3', output: '9' }], reference: source.python, generator: { mode: 'integer', min: -2, max: 2, count: 2 } } }] };
const put = (path: string, body: object) => request(w.app).put(path).set('Origin', TEST_ORIGIN).set('Cookie', w.studentJar.header()).set('X-Csrf-Token', w.studentJar.csrf()).send(body);
const real = process.env.PYTHON_TEST_REAL === '1';
const python = real ? runPython : async (_code: string, input: string) => ({ output: String(Number(input) ** 2) + '\n', error: null });
beforeAll(async () => {
  w = await createLearningWorld(); course = await createPublishedCourse(w, 'ide-modes');
  await grantSubscription(w, w.studentId, course.courseId, Date.now() + 86400000);
});
afterAll(async () => { await w?.fixture?.stop(); await w?.close(); });
describe('IDE mode drafts, shared allowance and durable Python jobs', () => {
  it('initializes one shared quota during simultaneous first loads of all modes', async () => {
    const rows = await Promise.all(Array.from({ length: 12 }, () => readQuota(w.prisma, w.studentId, Date.now())));
    expect(rows.every((q) => q.used === 0 && q.remaining === 50)).toBe(true);
    expect(await w.prisma.practiceQuota.count({ where: { studentId: w.studentId } })).toBe(1);
  });
  it('keeps all three practice drafts independent and legacy JavaScript context intact', async () => {
    for (const mode of ['javascript', 'web', 'python']) {
      const s = { html: mode === 'web' ? '<p>Web only</p>' : '', css: '', javascript: mode === 'javascript' ? 'console.log("JS only")' : '', ...(mode === 'python' ? { python: 'print("Python only")' } : {}) };
      expect((await put(`/assessments/practice/draft?mode=${mode}`, { revision: 0, content: s })).status).toBe(200);
      expect((await studentGet(w.app, `/assessments/practice?mode=${mode}`, w.studentJar)).body.data.draft.content).toEqual(s);
    }
    expect((await studentGet(w.app, '/assessments/practice', w.studentJar)).body.data.draft.content.javascript).toContain('JS only');
    expect((await studentGet(w.app, '/assessments/practice?mode=ruby', w.studentJar)).status).toBe(400);
    expect((await put('/assessments/practice/draft?mode=python', { revision: 0, content: source })).status).toBe(409);
  });
  it('accepts one Python Run atomically, replays it once and shares the JavaScript allowance', async () => {
    const idempotencyKey = randomUUID(); const body = { source: source.python, input: '3', idempotencyKey };
    const first = await studentPost(w.app, '/assessments/python/run', w.studentJar, body); expect(first.status).toBe(202);
    expect(first.body.data.quota.used).toBe(1);
    const replay = await studentPost(w.app, '/assessments/python/run', w.studentJar, body); expect(replay.body.data.id).toBe(first.body.data.id); expect(replay.body.data.quota.used).toBe(1);
    expect((await studentPost(w.app, '/assessments/python/run', w.studentJar, { ...body, source: 'print(0)' })).status).toBe(409);
    await processPythonRun(w.prisma, first.body.data.id, python);
    expect((await studentGet(w.app, `/assessments/python/runs/${first.body.data.id}`, w.studentJar)).body.data).toMatchObject({ state: 'COMPLETED', output: '9\n' });
    const stored = await w.prisma.pythonRun.findUniqueOrThrow({ where: { id: first.body.data.id } }); expect(stored.source).toBeNull(); expect(stored.input).toBeNull();
    expect(await reserveRun(w.prisma, w.studentId, randomUUID(), Date.now())).toMatchObject({ used: 2 });
  });
  it('rejects anonymous, inactive, CSRF-less and cross-user preview access', async () => {
    const other = await registerStudent(w.app); const body = { source: 'print(1)', input: '', idempotencyKey: randomUUID() };
    expect((await request(w.app).post('/assessments/python/run').send(body)).status).toBe(401);
    expect((await studentPost(w.app, '/assessments/python/run', other.jar, body)).status).toBe(403);
    expect((await studentPost(w.app, '/assessments/python/run', w.studentJar, body, { withCsrf: false })).status).toBe(403);
    const row = await w.prisma.pythonRun.findFirstOrThrow(); expect((await studentGet(w.app, `/assessments/python/runs/${row.id}`, other.jar)).status).toBe(404);
  });
  it('allows private admin previews without spending a student allowance or earning passes', async () => {
    const job = await studentPost(w.app, '/assessments/python/run', w.adminJar, { source: 'print(7)', input: '', idempotencyKey: randomUUID() }); expect(job.status).toBe(202); expect(job.body.data.quota).toBeUndefined();
    await processPythonRun(w.prisma, job.body.data.id, async () => ({ output: '7\n', error: null }));
    expect(await w.prisma.practiceQuota.count({ where: { studentId: w.adminUser.id } })).toBe(0);
    expect(await w.prisma.assessmentPass.count()).toBe(0);
  });
  it('bounds simultaneous Runs per student and records code errors without a pass', async () => {
    const calls = await Promise.all(Array.from({ length: 8 }, () => studentPost(w.app, '/assessments/python/run', w.studentJar, { source: 'broken', input: '', idempotencyKey: randomUUID() })));
    expect(calls.filter((r) => r.status === 202)).toHaveLength(1); expect(calls.filter((r) => r.status === 429)).toHaveLength(7);
    const id = calls.find((r) => r.status === 202)!.body.data.id;
    let executions = 0;
    const failCode = async () => { executions++; return { output: '', error: 'CODE_ERROR' }; };
    await Promise.all([processPythonRun(w.prisma, id, failCode), processPythonRun(w.prisma, id, failCode)]);
    expect(executions).toBe(1);
    expect((await w.prisma.pythonRun.findUniqueOrThrow({ where: { id } })).state).toBe('ERROR'); expect(await w.prisma.assessmentPass.count()).toBe(0);
  });
  it('rolls back allowance charges when the shared durable queue is full', async () => {
    const before = await readQuota(w.prisma, w.studentId, Date.now());
    await w.prisma.assessmentQueueBudget.update({ where: { id: 1 }, data: { capacity: 1 } });
    const admin = await studentPost(w.app, '/assessments/python/run', w.adminJar, { source: 'print(1)', input: '', idempotencyKey: randomUUID() }); expect(admin.status).toBe(202);
    const denied = await studentPost(w.app, '/assessments/python/run', w.studentJar, { source: 'print(1)', input: '', idempotencyKey: randomUUID() }); expect(denied.status).toBe(503);
    expect((await readQuota(w.prisma, w.studentId, Date.now())).used).toBe(before.used);
    await processPythonRun(w.prisma, admin.body.data.id, async () => ({ output: '1', error: null }));
    expect((await w.prisma.assessmentQueueBudget.findUniqueOrThrow({ where: { id: 1 } })).pending).toBe(0);
    await w.prisma.assessmentQueueBudget.update({ where: { id: 1 }, data: { capacity: 10000 } });
  });
  it('prepares and publishes private Python problems with independently typed lesson listings', async () => {
    const created = await adminPost(w.app, `/admin/assessments/lessons/${course.lessonId}`, w.adminJar, { kind: 'QUIZ', required: false, content: material }); expect(created.status).toBe(201); assessment = created.body.data.id;
    const preparation = await requestPreparation(w.prisma, w.adminUser.id, assessment);
    await processPreparation(w.prisma, preparation.id, real ? executeIsolated : async () => ({ correct: true, results: [{ questionId: 'p', tests: [{ input: '3', output: '9' }, { input: '-2', output: '4' }] }] }));
    expect((await w.prisma.assessmentPreparation.findUniqueOrThrow({ where: { id: preparation.id } })).state).toBe('READY');
    expect((await adminPost(w.app, `/admin/assessments/${assessment}/publish`, w.adminJar)).status).toBe(200);
    const detail = await studentGet(w.app, `/assessments/${assessment}`, w.studentJar); expect(detail.body.data.content.ide).toBe('python'); expect(detail.body.data.content.questions[0].starter.python).toBe('');
    for (const forbidden of ['reference', 'generator', 'tests']) expect(JSON.stringify(detail.body.data.content)).not.toContain(forbidden);
    const listed = await studentGet(w.app, `/assessments/lessons/${course.lessonId}`, w.studentJar); expect(listed.body.data.assessments[0].ide).toBe('python');
  });
  it('exempts Python exercise Runs and only official successful grading creates a pass', async () => {
    const before = await readQuota(w.prisma, w.studentId, Date.now());
    const job = await studentPost(w.app, '/assessments/python/run', w.studentJar, { assessmentId: assessment, source: source.python, input: '3', idempotencyKey: randomUUID() }); expect(job.status).toBe(202); expect(job.body.data.quota).toBeUndefined();
    await processPythonRun(w.prisma, job.body.data.id, python);
    expect((await readQuota(w.prisma, w.studentId, Date.now())).used).toBe(before.used); expect(await w.prisma.assessmentPass.count()).toBe(0);
    const submitted = await studentPost(w.app, `/assessments/${assessment}/submit`, w.studentJar, { version: 1, idempotencyKey: randomUUID(), answers: [{ questionId: 'p', source }] }); expect(submitted.status).toBe(202);
    await processSubmission(w.prisma, submitted.body.data.id, real ? executeIsolated : async () => ({ correct: true, results: [{ questionId: 'p', correct: true, checksPassed: 2, checksTotal: 2 }] }));
    expect((await w.prisma.assessmentSubmission.findUniqueOrThrow({ where: { id: submitted.body.data.id } })).state).toBe('CORRECT'); expect(await w.prisma.assessmentPass.count()).toBe(1);
  });
  it('permanent assessment removal cascades its private preview and grading data', async () => {
    await w.prisma.assessment.delete({ where: { id: assessment } }); expect(await w.prisma.pythonRun.count({ where: { assessmentId: assessment } })).toBe(0);
    expect(await w.prisma.assessmentSubmission.count({ where: { assessmentId: assessment } })).toBe(0); expect((await w.prisma.assessmentQueueBudget.findUniqueOrThrow({ where: { id: 1 } })).pending).toBe(0);
  });
});
