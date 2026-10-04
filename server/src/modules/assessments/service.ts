import { createHash } from 'node:crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import { ApiError } from '../identity/errors.js';
import { resolveCourse } from '../learning/access/service.js';
import { assertLessonUnlocked } from './progression.js';
import { answers, content, publicContent, type Content } from './contracts.js';
import { preparationHash, freezePrograms } from './program-contracts.js';

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;
export async function adminLesson(db: PrismaClient, lessonId: string) {
  const l = await db.lesson.findUnique({ where: { id: lessonId }, include: { section: { include: { course: true } } } });
  if (!l || l.section.course.deletionRequestedAt) throw new ApiError(404, 'NOT_FOUND', 'Lesson not found.');
  return l;
}
export async function assessmentAccess(db: PrismaClient, studentId: string, id: string, now: number) {
  const a = await db.assessment.findUnique({ where: { id }, include: { lesson: { include: { section: true } } } });
  if (!a || a.status !== 'PUBLISHED') throw new ApiError(404, 'NOT_FOUND', 'Assessment not found.');
  await resolveCourse({ prisma: db, studentId, courseRef: a.lesson.section.courseId, nowMs: now });
  await assertLessonUnlocked(db, studentId, a.lesson.section.courseId, a.lessonId);
  return a;
}
export async function saveAssessment(db: PrismaClient, actor: string, lessonId: string, id: string | null, body: Record<string, unknown>) {
  await adminLesson(db, lessonId);
  if (typeof body.required !== 'boolean' || !['ASSIGNMENT', 'QUIZ'].includes(body.kind as string)) throw new ApiError(400, 'VALIDATION_ERROR', 'Select kind and required/optional status.');
  const c = content(body.content);
  return db.$transaction(async (tx) => {
    // Serialize with permanent course deletion's existing course lock.
    const lesson = await tx.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { section: true } });
    await tx.$queryRaw`SELECT id FROM "Course" WHERE id=${lesson.section.courseId} FOR UPDATE`;
    const course = await tx.course.findUniqueOrThrow({ where: { id: lesson.section.courseId } });
    if (course.deletionRequestedAt) throw new ApiError(409, 'DELETION_PENDING', 'Content deletion is pending.');
    if (id) {
      await tx.$queryRaw`SELECT id FROM "Assessment" WHERE id=${id} FOR UPDATE`;
      const old = await tx.assessment.findUnique({ where: { id } });
      if (!old || old.lessonId !== lessonId) throw new ApiError(404, 'NOT_FOUND', 'Assessment not found.');
    }
    const a = id ? await tx.assessment.update({ where: { id }, data: { content: json(c), kind: body.kind as string, draftRequired: body.required as boolean } }) : await tx.assessment.create({ data: { lessonId, content: json(c), kind: body.kind as string, required: body.required as boolean, draftRequired: body.required as boolean } });
    await tx.auditEvent.create({ data: { actorUserId: actor, action: 'ASSESSMENT_SAVE', entityType: 'Assessment', entityId: a.id } });
    return a;
  });
}
export async function publishAssessment(db: PrismaClient, actor: string, id: string, action: 'PUBLISH' | 'ARCHIVE') {
  const a = await db.assessment.findUnique({ where: { id } }); if (!a) throw new ApiError(404, 'NOT_FOUND', 'Assessment not found.');
  await adminLesson(db, a.lessonId);
  return db.$transaction(async (tx) => {
    const lesson = await tx.lesson.findUniqueOrThrow({ where: { id: a.lessonId }, include: { section: true } });
    await tx.$queryRaw`SELECT id FROM "Course" WHERE id=${lesson.section.courseId} FOR UPDATE`;
    const course = await tx.course.findUniqueOrThrow({ where: { id: lesson.section.courseId } });
    if (course.deletionRequestedAt) throw new ApiError(409, 'DELETION_PENDING', 'Content deletion is pending.');
    await tx.$queryRaw`SELECT id FROM "Assessment" WHERE id=${id} FOR UPDATE`;
    const current = await tx.assessment.findUniqueOrThrow({ where: { id } });
    if (action === 'ARCHIVE') {
      await tx.auditEvent.create({ data: { actorUserId: actor, action: 'ASSESSMENT_ARCHIVE', entityType: 'Assessment', entityId: id } });
      return tx.assessment.update({ where: { id }, data: { status: 'ARCHIVED' } });
    }
    let c = content(current.content); const version = current.version + 1;
    if (c.questions.some((q) => q.type === 'PROGRAM')) {
      const prepared = await tx.assessmentPreparation.findUnique({ where: { assessmentId_contentHash: { assessmentId: id, contentHash: preparationHash(c) } } });
      if (!prepared || prepared.state !== 'READY') throw new ApiError(409, 'TESTS_NOT_READY', 'Prepare and review tests for the current draft before publishing.');
      c = freezePrograms(c, prepared.result);
    }
    await tx.assessmentVersion.create({ data: { assessmentId: id, version, content: json(c) } });
    await tx.auditEvent.create({ data: { actorUserId: actor, action: 'ASSESSMENT_PUBLISH', entityType: 'Assessment', entityId: id, metadata: { version } } });
    return tx.assessment.update({ where: { id }, data: { status: 'PUBLISHED', version, required: current.draftRequired ?? current.required } });
  });
}
export async function studentAssessment(db: PrismaClient, studentId: string, id: string, now: number) {
  const a = await assessmentAccess(db, studentId, id, now);
  const [v, pass, draft] = await Promise.all([
    db.assessmentVersion.findUniqueOrThrow({ where: { assessmentId_version: { assessmentId: id, version: a.version } } }),
    db.assessmentPass.findUnique({ where: { studentId_assessmentId: { studentId, assessmentId: id } } }),
    db.assessmentDraft.findUnique({ where: { studentId_context: { studentId, context: id } } }),
  ]);
  return { id, lessonId: a.lessonId, courseId: a.lesson.section.courseId, kind: a.kind, required: a.required, version: v.version, content: publicContent(v.content as unknown as Content), passed: !!pass, draft };
}
export async function submitAssessment(db: PrismaClient, studentId: string, id: string, body: Record<string, unknown>, now: number) {
  const a = await assessmentAccess(db, studentId, id, now);
  if (typeof body.idempotencyKey !== 'string' || !/^[\w-]{8,100}$/.test(body.idempotencyKey)) throw new ApiError(400, 'VALIDATION_ERROR', 'Submission key is invalid.');
  if (!Number.isInteger(body.version) || (body.version as number) < 1) throw new ApiError(400, 'VALIDATION_ERROR', 'Assessment version is invalid.');
  const version = await db.assessmentVersion.findUnique({ where: { assessmentId_version: { assessmentId: id, version: body.version as number } } });
  if (!version) throw new ApiError(409, 'ASSESSMENT_CHANGED', 'Reload the current assessment before submitting.');
  const input = answers(body.answers, version.content as unknown as Content);
  const hash = createHash('sha256').update(JSON.stringify({ id, version: version.id, input })).digest('hex');
  return db.$transaction(async (tx) => {
    // One outstanding job/student prevents one retrying student dominating the queue.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${studentId} FOR UPDATE`;
    const prior = await tx.assessmentSubmission.findUnique({ where: { studentId_idempotencyKey: { studentId, idempotencyKey: body.idempotencyKey as string } } });
    if (prior) { if (prior.inputHash !== hash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Submission key belongs to another answer.'); return { id: prior.id, state: prior.state, duplicate: true }; }
    await tx.$queryRaw`SELECT id FROM "Assessment" WHERE id=${id} FOR UPDATE`;
    const current = await tx.assessment.findUnique({ where: { id } });
    if (!current || current.status !== 'PUBLISHED' || current.version !== version.version) throw new ApiError(409, 'ASSESSMENT_CHANGED', 'Reload the current assessment before submitting.');
    const pending = await tx.assessmentSubmission.findFirst({ where: { studentId, state: { in: ['PENDING', 'RUNNING'] } }, select: { id: true } });
    if (pending) throw new ApiError(429, 'CHECKING_IN_PROGRESS', 'Wait for the current check before submitting again.');
    // Global bounded durable admission is maintained by database triggers.
    const submission = await tx.assessmentSubmission.create({ data: { studentId, assessmentId: id, versionId: version.id, idempotencyKey: body.idempotencyKey as string, inputHash: hash, answers: json(input) } });
    return { id: submission.id, state: submission.state, duplicate: false };
  }).catch((error: unknown) => {
    if (String((error as Error)?.message).includes('M9_QUEUE_BUSY')) throw new ApiError(503, 'CHECKING_BUSY', 'Checking is busy. Your answer has not been accepted; please retry.');
    throw error;
  });
}
export async function saveDraft(db: PrismaClient, studentId: string, context: string, data: unknown, revision: unknown) {
  if (!Number.isInteger(revision) || (revision as number) < 0 || Buffer.byteLength(JSON.stringify(data)) > 200_000) throw new ApiError(400, 'VALIDATION_ERROR', 'Draft is invalid.');
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${studentId} FOR UPDATE`;
    const old = await tx.assessmentDraft.findUnique({ where: { studentId_context: { studentId, context } } });
    if ((old?.revision ?? 0) !== revision) throw new ApiError(409, 'DRAFT_CONFLICT', 'A newer draft exists. Reload before saving.');
    return old ? tx.assessmentDraft.update({ where: { id: old.id }, data: { content: json(data), revision: { increment: 1 } } }) : tx.assessmentDraft.create({ data: { studentId, context, assessmentId: ['practice', 'practice:web', 'practice:python'].includes(context) ? null : context, content: json(data) } });
  });
}
