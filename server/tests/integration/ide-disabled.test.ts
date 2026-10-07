import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { createLearningWorld, createPublishedCourse, grantSubscription, studentGet, studentPost, type LearningWorld } from './learning-helpers.js';
import { adminPost } from './catalog-helpers.js';
import { TEST_ORIGIN } from './identity-helpers.js';
import { processSubmission, reconcileGrading, startGradingWorker } from '../../src/modules/assessments/worker.js';

let w: LearningWorld, course: Awaited<ReturnType<typeof createPublishedCourse>>;
let quiz: string, coding: string, mixed: string, pending: string;
const previous = process.env.CODING_IDE_ENABLED;
const choice = { id: 'choice', type: 'CHOICE', titleAr: 'سؤال', titleEn: 'Question', choices: [{ id: 'a', textAr: 'أ', textEn: 'A' }, { id: 'b', textAr: 'ب', textEn: 'B' }], correctChoiceId: 'b' };
const code = { id: 'code', type: 'CODING', titleAr: 'برمجة', titleEn: 'Code', starter: { html: '', css: '', javascript: 'console.log(2)' }, checks: [{ type: 'console', expected: '2' }] };
const content = (questions: unknown[], ide = 'javascript') => ({ ide, titleAr: 'اختبار', titleEn: 'Quiz', instructionsAr: 'اختر', instructionsEn: 'Choose', questions });
const submit = (choiceId: string, key = randomUUID()) => studentPost(w.app, `/assessments/${quiz}/submit`, w.studentJar, { version: 1, idempotencyKey: key, answers: [{ questionId: 'choice', choiceId }] });
beforeAll(async () => {
  process.env.CODING_IDE_ENABLED = 'true';
  w = await createLearningWorld(); course = await createPublishedCourse(w, 'ide-disabled', { extraLessons: 1 });
  await grantSubscription(w, w.studentId, course.courseId, Date.now() + 86400000);
  const make = async (questions: unknown[], ide?: string) => {
    const a = await adminPost(w.app, `/admin/assessments/lessons/${course.lessonId}`, w.adminJar, { kind: 'QUIZ', required: true, content: content(questions, ide) });
    expect(a.status).toBe(201);
    expect((await adminPost(w.app, `/admin/assessments/${a.body.data.id}/publish`, w.adminJar)).status).toBe(200);
    return a.body.data.id as string;
  };
  coding = await make([code]); mixed = await make([choice, code]); quiz = await make([choice], 'python');
  const s = await studentPost(w.app, `/assessments/${coding}/submit`, w.studentJar, { version: 1, idempotencyKey: randomUUID(), answers: [{ questionId: 'code', source: code.starter }] });
  expect(s.status).toBe(202); pending = s.body.data.id;
  await w.prisma.assessmentDraft.create({ data: { studentId: w.studentId, context: 'practice', content: code.starter } });
  // Mutable draft content must never classify a published revision.
  await w.prisma.assessment.update({ where: { id: coding }, data: { content: content([choice]) as Prisma.InputJsonValue } });
  process.env.CODING_IDE_ENABLED = 'false';
});
afterAll(async () => {
  if (previous === undefined) delete process.env.CODING_IDE_ENABLED; else process.env.CODING_IDE_ENABLED = previous;
  await w?.fixture?.stop(); await w?.close();
});

describe('current release without coding execution', () => {
  it('publishes the backend capability without credentials', async () => {
    const r = await request(w.app).get('/features'); expect(r.body).toEqual({ data: { codingIdeEnabled: false } });
    expect(r.headers['cache-control']).toBe('no-store');
  });
  it('denies every practice/Python/quota/preparation entry and retains authentication', async () => {
    expect((await request(w.app).get('/assessments/practice')).status).toBe(401);
    for (const path of ['/assessments/practice', `/assessments/python/runs/${randomUUID()}`]) {
      const r = await studentGet(w.app, path, w.studentJar); expect(r.status).toBe(503); expect(r.body.error.code).toBe('IDE_DISABLED');
    }
    for (const path of ['/assessments/practice/run', '/assessments/python/run']) expect((await studentPost(w.app, path, w.studentJar, {})).status).toBe(503);
    const draft = await request(w.app).put('/assessments/practice/draft').set('Cookie', w.studentJar.header()).set('Origin', TEST_ORIGIN).set('X-Csrf-Token', w.studentJar.csrf()).send({}); expect(draft.status).toBe(503);
    expect((await studentGet(w.app, `/admin/assessments/students/${w.studentId}/quota`, w.adminJar)).status).toBe(503);
    expect((await adminPost(w.app, `/admin/assessments/${coding}/prepare`, w.adminJar)).status).toBe(503);
  });
  it('hides coding and mixed assessments, denies direct access and exempts only coding locks', async () => {
    const list = await studentGet(w.app, `/assessments/lessons/${course.lessonId}`, w.studentJar);
    expect(list.body.data.assessments.map((a: { id: string }) => a.id)).toEqual([quiz]);
    for (const id of [coding, mixed]) {
      expect((await studentGet(w.app, `/assessments/${id}`, w.studentJar)).status).toBe(503);
      expect((await studentGet(w.app, `/assessments/${id}/history`, w.studentJar)).status).toBe(503);
      expect((await studentPost(w.app, `/assessments/${id}/submit`, w.studentJar, {})).status).toBe(503);
    }
    const outline = await studentGet(w.app, `/learning/courses/${course.slug}/outline`, w.studentJar);
    expect(outline.body.data.sections[0].lessons[1].blockingAssessmentIds).toEqual([quiz]);
    expect(outline.body.data.sections[0].lessons[1].locked).toBe(true);
    expect(await w.prisma.assessmentPass.count({ where: { studentId: w.studentId } })).toBe(0);
    expect((await studentGet(w.app, `/assessments/submissions/${pending}`, w.studentJar)).status).toBe(503);
  });
  it('rejects coding authoring and publishing; permits choice-only authoring', async () => {
    const path = `/admin/assessments/lessons/${course.lessonId}`;
    expect((await adminPost(w.app, path, w.adminJar, { kind: 'QUIZ', required: false, content: content([code]) })).status).toBe(503);
    expect((await adminPost(w.app, `/admin/assessments/${mixed}/publish`, w.adminJar)).status).toBe(503);
    expect((await adminPost(w.app, path, w.adminJar, { kind: 'QUIZ', required: false, content: content([choice]) })).status).toBe(201);
  });
  it('marks wrong answers synchronously despite preserved pending coding work', async () => {
    const r = await submit('a'); expect(r.status).toBe(202); expect(r.body.data.state).toBe('INCORRECT');
    const result = await studentGet(w.app, `/assessments/submissions/${r.body.data.id}`, w.studentJar);
    expect(result.body.data.result.correct).toBe(false); expect(JSON.stringify(result.body)).not.toContain('correctChoiceId');
    expect((await w.prisma.assessmentQueueBudget.findUniqueOrThrow({ where: { id: 1 } })).pending).toBe(1);
  });
  it('finishes legacy pending choice results during authorized polling without losing suspended coding work', async () => {
    const version = await w.prisma.assessmentVersion.findUniqueOrThrow({ where: { assessmentId_version: { assessmentId: quiz, version: 1 } } });
    const legacy = await w.prisma.assessmentSubmission.create({ data: { studentId: w.studentId, assessmentId: quiz, versionId: version.id, state: 'RUNNING', leaseToken: randomUUID(), leasedUntil: new Date(Date.now() + 60000), idempotencyKey: randomUUID(), inputHash: 'legacy-choice-hash', answers: [{ questionId: 'choice', choiceId: 'a' }] } });
    const replies = await Promise.all([studentGet(w.app, `/assessments/submissions/${legacy.id}`, w.studentJar), studentGet(w.app, `/assessments/submissions/${legacy.id}`, w.studentJar)]);
    expect(replies.every(r => r.status === 200 && r.body.data.state === 'INCORRECT')).toBe(true);
    expect((await w.prisma.assessmentSubmission.findUniqueOrThrow({ where: { id: legacy.id } })).leaseToken).toBeNull();
    expect((await w.prisma.assessmentQueueBudget.findUniqueOrThrow({ where: { id: 1 } })).pending).toBe(1);
    expect((await w.prisma.assessmentSubmission.findUniqueOrThrow({ where: { id: pending } })).state).toBe('PENDING');
  });
  it('atomically deduplicates correct retries, earns one pass and unlocks the next lesson without a worker', async () => {
    const key = randomUUID(); const results = await Promise.all([submit('b', key), submit('b', key)]);
    expect(results.map((r) => r.status)).toEqual([202, 202]);
    expect(results[0].body.data.state).toBe('CORRECT'); expect(results[1].body.data.id).toBe(results[0].body.data.id);
    expect(results.some((r) => r.body.data.duplicate)).toBe(true);
    expect((await submit('a', key)).status).toBe(409);
    expect(await w.prisma.assessmentPass.count({ where: { studentId: w.studentId, assessmentId: quiz } })).toBe(1);
    expect((await studentGet(w.app, `/assessments/lessons/${course.lessonIds[1]}`, w.studentJar)).status).toBe(200);
    const outline = await studentGet(w.app, `/learning/courses/${course.slug}/outline`, w.studentJar);
    expect(outline.body.data.sections[0].lessons[1]).toMatchObject({ locked: false, blockingAssessmentIds: [] });
  });
  it('does not start workers, deliver jobs, execute code or modify preserved drafts/submissions', async () => {
    const never = async (): Promise<never> => { throw new Error('execution must not happen'); };
    await processSubmission(w.prisma, pending, never);
    await reconcileGrading(w.prisma, { getJob: never } as never);
    await (await startGradingWorker()).stop();
    expect((await w.prisma.assessmentSubmission.findUniqueOrThrow({ where: { id: pending } })).state).toBe('PENDING');
    expect((await w.prisma.assessmentDraft.findUniqueOrThrow({ where: { studentId_context: { studentId: w.studentId, context: 'practice' } } })).content).toEqual(code.starter);
    expect(await w.prisma.practiceRun.count({ where: { studentId: w.studentId } })).toBe(0);
  });
  it('continues enforcing subscription expiry for available quizzes', async () => {
    await w.prisma.subscription.updateMany({ where: { studentId: w.studentId }, data: { startsAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() - 1000) } });
    expect((await studentGet(w.app, `/assessments/${quiz}`, w.studentJar)).status).toBe(403);
    expect((await submit('b')).status).toBe(403);
  });
});
