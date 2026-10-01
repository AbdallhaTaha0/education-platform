import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createLearningWorld, createPublishedCourse, grantSubscription, studentGet, type LearningWorld } from './learning-helpers.js';
import { adminPost } from './catalog-helpers.js';

let w: LearningWorld; let id: string; let privateId: string;
beforeAll(async () => {
  w = await createLearningWorld();
  const course = await createPublishedCourse(w, 'review-fixes');
  await grantSubscription(w, w.studentId, course.courseId, Date.now() + 86400000);
  const content = { titleAr: 'اختبار', titleEn: 'Console exercise', instructionsAr: 'اطبع اثنين', instructionsEn: 'Print two', questions: [{ id: 'q', type: 'CODING', titleAr: 'سؤال', titleEn: 'Question', starter: { html: '<p>private-admin-html</p>', css: '/* private-admin-css */', javascript: 'console.log(2); // private-admin-js' }, checks: [{ type: 'console', expected: 2 }] }] };
  const created = await adminPost(w.app, `/admin/assessments/lessons/${course.lessonId}`, w.adminJar, { kind: 'QUIZ', required: false, content });
  expect(created.status).toBe(201); id = created.body.data.id;
  const published = await adminPost(w.app, `/admin/assessments/${id}/publish`, w.adminJar);
  expect(published.status).toBe(200);
  const version = await w.prisma.assessmentVersion.findFirstOrThrow({ where: { assessmentId: id } });
  // Equal timestamps stress the id tie-breaker, not an accidental date ordering.
  await w.prisma.assessmentSubmission.createMany({ data: Array.from({ length: 23 }, () => ({ id: randomUUID(), studentId: w.studentId, assessmentId: id, versionId: version.id, idempotencyKey: randomUUID(), inputHash: 'fixture', state: 'CORRECT', createdAt: new Date('2026-01-01T00:00:00Z'), answers: [{ questionId: 'q', source: { html: '', css: '', javascript: 'console.log(2)' } }], result: { questions: [] } })) });
  const other = await adminPost(w.app, `/admin/assessments/lessons/${course.lessonId}`, w.adminJar, { kind: 'QUIZ', required: false, content });
  privateId = other.body.data.id;
});
afterAll(async () => { await w?.fixture?.stop(); await w?.close(); });

it('a fresh student editor receives no administrator source or private checks', async () => {
  const detail = await studentGet(w.app, `/assessments/${id}`, w.studentJar);
  expect(detail.status).toBe(200); expect(detail.body.data.draft).toBeNull();
  expect(detail.body.data.content.questions[0].starter).toEqual({ html: '', css: '', javascript: '' });
  expect(JSON.stringify(detail.body)).not.toContain('private-admin');
  expect(JSON.stringify(detail.body)).not.toContain('checks');
});
it('pages summaries deterministically without loading every source/result', async () => {
  const ids: string[] = []; let cursor: string | null = null; const sizes: number[] = [];
  do {
    const page = await studentGet(w.app, `/admin/assessments/${id}/submissions?limit=10${cursor ? `&cursor=${cursor}` : ''}`, w.adminJar);
    expect(page.status).toBe(200); const rows = page.body.data.submissions;
    sizes.push(rows.length);
    for (const row of rows) { expect(row).toHaveProperty('student.displayName'); expect(row).toHaveProperty('version.version'); expect(row).not.toHaveProperty('answers'); expect(row).not.toHaveProperty('result'); ids.push(row.id); }
    cursor = page.body.data.nextCursor;
  } while (cursor);
  expect(sizes).toEqual([10, 10, 3]); expect(new Set(ids).size).toBe(23);
});
it('loads one selected submission and refuses cross-assessment and STUDENT detail access', async () => {
  const row = await w.prisma.assessmentSubmission.findFirstOrThrow({ where: { assessmentId: id } });
  const detail = await studentGet(w.app, `/admin/assessments/${id}/submissions/${row.id}`, w.adminJar);
  expect(detail.status).toBe(200); expect(detail.body.data.answers[0].source.javascript).toBe('console.log(2)');
  expect((await studentGet(w.app, `/admin/assessments/${privateId}/submissions/${row.id}`, w.adminJar)).status).toBe(404);
  expect((await studentGet(w.app, `/admin/assessments/${id}/submissions/${row.id}`, w.studentJar)).status).toBe(403);
});
it('rejects invalid or foreign cursors and unbounded page sizes', async () => {
  for (const query of ['limit=10000', 'limit=0', 'limit=abc', 'cursor=bad', `cursor=${randomUUID()}`]) {
    expect((await studentGet(w.app, `/admin/assessments/${id}/submissions?${query}`, w.adminJar)).status).toBe(400);
  }
});
