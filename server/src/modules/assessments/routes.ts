import { Router, type Request, type Response, type NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { ApiError, ok } from '../identity/errors.js';
import { requireAuth, requireAdmin, requireOrigin, requireSessionCsrf } from '../identity/middleware.js';
import { resolveCourse } from '../learning/access/service.js';
import { assertLessonUnlocked } from './progression.js';
import { key, object, files, invalid, answers, ideMode, type Content } from './contracts.js';
import { requestPythonRun } from './python-runs.js';
import { adminLesson, assessmentAccess, publishAssessment, saveAssessment, saveDraft, studentAssessment, submitAssessment, completePendingChoice } from './service.js';
import { practiceEligible, readQuota, reserveRun, adjustQuota } from './quota.js';
import { LearningError } from '../learning/errors.js';
import { getLogger } from '../../logger.js';
import { parseListPage, pageInfo } from '../../list-pagination.js';
import { requestPreparation, preparationStatus } from './preparation.js';
import { codingIdeEnabled, choiceOnly, requireCodingIde, requireAvailableAssessment } from './availability.js';

const uuid = (v: unknown): string => { if (typeof v !== 'string' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v)) return invalid(); return v; };
const asyncRoute = (f: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction): void => {
  void f(req, res).catch((error: unknown) => {
    if (error instanceof ApiError || error instanceof LearningError) return next(error);
    // Prisma diagnostics can contain source/private test parameters. Never log them.
    getLogger().error({ requestId: req.requestId }, 'assessment persistence unavailable');
    next(new ApiError(500, 'CHECKING_UNAVAILABLE', 'Assessment service is unavailable.'));
  });
};
const student = (req: Request): string => { if (req.auth?.role !== 'STUDENT') throw new ApiError(403, 'FORBIDDEN', 'Student access required.'); return req.auth.userId; };
export function assessmentRouters(db: PrismaClient, now: () => number = Date.now) {
  const r = Router(); const admin = Router();
  r.use(requireAuth); admin.use(requireAuth, requireAdmin);
  const codingOnly = (_req: Request, _res: Response, next: NextFunction): void => { try { requireCodingIde(); next(); } catch (e) { next(e); } };
  r.use(['/practice', '/python'], codingOnly);
  admin.use(['/students', '/:id/prepare', '/:id/preparation'], codingOnly);
  const writes = [requireOrigin, requireSessionCsrf];
  r.get('/practice', asyncRoute(async (req, res) => {
    const id = student(req); await practiceEligible(db, id, now());
    const mode = ideMode(req.query.mode); const context = mode === 'javascript' ? 'practice' : `practice:${mode}`;
    const [quota, draft] = await Promise.all([readQuota(db, id, now()), db.assessmentDraft.findUnique({ where: { studentId_context: { studentId: id, context } } })]);
    res.json(ok({ quota, draft }));
  }));
  r.post('/practice/run', ...writes, asyncRoute(async (req, res) => {
    res.json(ok(await reserveRun(db, student(req), key(object(req.body).idempotencyKey), now())));
  }));
  r.put('/practice/draft', ...writes, asyncRoute(async (req, res) => {
    const id = student(req); await practiceEligible(db, id, now()); const b = object(req.body);
    const mode = ideMode(req.query.mode); const context = mode === 'javascript' ? 'practice' : `practice:${mode}`;
    res.json(ok(await saveDraft(db, id, context, files(b.content), b.revision)));
  }));
  r.post('/python/run', ...writes, asyncRoute(async (req, res) => {
    res.status(202).json(ok(await requestPythonRun(db, req.auth!.userId, req.auth!.role, req.body, now())));
  }));
  r.get('/python/runs/:id', asyncRoute(async (req, res) => {
    const job = await db.pythonRun.findFirst({ where: { id: uuid(req.params.id), userId: req.auth!.userId }, select: { id: true, state: true, output: true, error: true } });
    if (!job) throw new ApiError(404, 'NOT_FOUND', 'Run not found.');
    res.json(ok(job));
  }));
  r.get('/lessons/:lessonId', asyncRoute(async (req, res) => {
    const studentId = student(req); const lessonId = uuid(req.params.lessonId);
    const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: { section: true } });
    if (!lesson) throw new ApiError(404, 'LESSON_NOT_FOUND', 'Lesson not found.');
    await resolveCourse({ prisma: db, studentId, courseRef: lesson.section.courseId, nowMs: now() });
    await assertLessonUnlocked(db, studentId, lesson.section.courseId, lessonId);
    const list = await db.assessment.findMany({ where: { lessonId, status: 'PUBLISHED' }, orderBy: { createdAt: 'asc' } });
    const passes = new Set((await db.assessmentPass.findMany({ where: { studentId, assessmentId: { in: list.map((a) => a.id) } } })).map((p) => p.assessmentId));
    const versions = await db.assessmentVersion.findMany({ where: { OR: list.map((a) => ({ assessmentId: a.id, version: a.version })) }, select: { assessmentId: true, content: true } });
    const published = new Map(versions.map((v) => [v.assessmentId, v.content as unknown as Content]));
    res.json(ok({ assessments: list.filter((a) => published.has(a.id) && (codingIdeEnabled() || choiceOnly(published.get(a.id)))).map((a) => { const c = published.get(a.id)!; return { id: a.id, ide: c.ide ?? 'javascript', kind: a.kind, required: a.required, titleAr: c.titleAr, titleEn: c.titleEn, passed: passes.has(a.id) }; }) }));
  }));
  r.get('/submissions/:id', asyncRoute(async (req, res) => {
    const found = await db.assessmentSubmission.findFirst({ where: { id: uuid(req.params.id), studentId: student(req) }, select: { id: true, assessmentId: true, state: true, result: true, createdAt: true, answers: true } });
    if (!found) throw new ApiError(404, 'NOT_FOUND', 'Submission not found.');
    if (!codingIdeEnabled()) {
      const submission = await db.assessmentSubmission.findUniqueOrThrow({ where: { id: found.id }, include: { version: true } });
      requireAvailableAssessment(submission.version.content);
    }
    if (!codingIdeEnabled() && ['PENDING', 'RUNNING'].includes(found.state)) {
      await completePendingChoice(db, found.id);
      res.json(ok(await db.assessmentSubmission.findUniqueOrThrow({ where: { id: found.id }, select: { id: true, assessmentId: true, state: true, result: true, createdAt: true, answers: true } })));
    } else res.json(ok(found));
  }));
  r.get('/:id/history', asyncRoute(async (req, res) => {
    const where = { studentId: student(req), assessmentId: uuid(req.params.id) }, input = parseListPage(req.query);
    if (!codingIdeEnabled()) await assessmentAccess(db, where.studentId, where.assessmentId, now());
    const pagination = input ? pageInfo(input, await db.assessmentSubmission.count({ where })) : undefined;
    const list = await db.assessmentSubmission.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: pagination?.pageSize ?? 30, skip: pagination ? (pagination.page - 1) * pagination.pageSize : 0, select: { id: true, state: true, result: true, createdAt: true } });
    res.set('Cache-Control', 'no-store').json(ok({ submissions: list, ...(pagination ? { pagination } : {}) }));
  }));
  r.get('/:id', asyncRoute(async (req, res) => { res.json(ok(await studentAssessment(db, student(req), uuid(req.params.id), now()))); }));
  r.put('/:id/draft', ...writes, asyncRoute(async (req, res) => {
    const id = uuid(req.params.id); const user = student(req); const a = await assessmentAccess(db, user, id, now()); const b = object(req.body);
    if (b.version !== a.version) throw new ApiError(409, 'ASSESSMENT_CHANGED', 'Reload the current assessment.');
    // Incomplete choice selection is valid in a draft, but stored source and
    // question bindings still need validation before the editor receives them.
    const version = await db.assessmentVersion.findUniqueOrThrow({ where: { assessmentId_version: { assessmentId: id, version: a.version } } });
    res.json(ok(await saveDraft(db, user, id, answers(b.content, version.content as unknown as Content, true), b.revision)));
  }));
  r.post('/:id/submit', ...writes, asyncRoute(async (req, res) => { res.status(202).json(ok(await submitAssessment(db, student(req), uuid(req.params.id), object(req.body), now()))); }));

  admin.get('/students', asyncRoute(async (req, res) => {
    const search = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
    const where = { role: 'STUDENT' as const, ...(search ? { OR: [{ email: { contains: search, mode: 'insensitive' as const } }, { displayName: { contains: search, mode: 'insensitive' as const } }, { phone: { contains: search } }] } : {}) }, input = parseListPage(req.query);
    const pagination = input ? pageInfo(input, await db.user.count({ where })) : undefined;
    const users = await db.user.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: pagination?.pageSize ?? 30, skip: pagination ? (pagination.page - 1) * pagination.pageSize : 0, select: { id: true, displayName: true, email: true } });
    res.set('Cache-Control', 'no-store').json(ok({ students: users, ...(pagination ? { pagination } : {}) }));
  }));
  admin.get('/students/:studentId/quota', asyncRoute(async (req, res) => {
    const id = uuid(req.params.studentId); if (!await db.user.findFirst({ where: { id, role: 'STUDENT' } })) throw new ApiError(404, 'NOT_FOUND', 'Student not found.');
    res.json(ok(await readQuota(db, id, now())));
  }));
  admin.post('/students/:studentId/quota', ...writes, asyncRoute(async (req, res) => {
    const b = object(req.body); if (b.action !== 'LIMIT' && b.action !== 'RESET') return invalid();
    if (b.action === 'LIMIT' && b.limit !== null && typeof b.limit !== 'number') return invalid();
    res.json(ok(await adjustQuota(db, req.auth!.userId, uuid(req.params.studentId), b.action, b.action === 'LIMIT' ? b.limit as number | null : null, now(), key(b.idempotencyKey))));
  }));
  admin.get('/lessons/:lessonId', asyncRoute(async (req, res) => {
    const id = uuid(req.params.lessonId); await adminLesson(db, id);
    res.json(ok({ assessments: await db.assessment.findMany({ where: { lessonId: id }, orderBy: { createdAt: 'asc' } }) }));
  }));
  admin.post('/lessons/:lessonId', ...writes, asyncRoute(async (req, res) => {
    res.status(201).json(ok(await saveAssessment(db, req.auth!.userId, uuid(req.params.lessonId), null, object(req.body))));
  }));
  admin.put('/:id', ...writes, asyncRoute(async (req, res) => {
    const id = uuid(req.params.id); const a = await db.assessment.findUnique({ where: { id } }); if (!a) throw new ApiError(404, 'NOT_FOUND', 'Assessment not found.');
    res.json(ok(await saveAssessment(db, req.auth!.userId, a.lessonId, id, object(req.body))));
  }));
  admin.post('/:id/publish', ...writes, asyncRoute(async (req, res) => { res.json(ok(await publishAssessment(db, req.auth!.userId, uuid(req.params.id), 'PUBLISH'))); }));
  admin.post('/:id/prepare', ...writes, asyncRoute(async (req, res) => {
    const id = uuid(req.params.id); const a = await db.assessment.findUnique({ where: { id } }); if (!a) throw new ApiError(404, 'NOT_FOUND', 'Assessment not found.');
    await adminLesson(db, a.lessonId);
    res.status(202).json(ok(await requestPreparation(db, req.auth!.userId, id)));
  }));
  admin.get('/:id/preparation', asyncRoute(async (req, res) => { res.json(ok(await preparationStatus(db, uuid(req.params.id)))); }));
  admin.post('/:id/archive', ...writes, asyncRoute(async (req, res) => { res.json(ok(await publishAssessment(db, req.auth!.userId, uuid(req.params.id), 'ARCHIVE'))); }));
  admin.get('/:id/submissions', asyncRoute(async (req, res) => {
    const assessmentId = uuid(req.params.id);
    if (!await db.assessment.findUnique({ where: { id: assessmentId }, select: { id: true } })) throw new ApiError(404, 'NOT_FOUND', 'Assessment not found.');
    const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 25) return invalid();
    const cursor = req.query.cursor === undefined ? null : await db.assessmentSubmission.findFirst({ where: { id: uuid(req.query.cursor), assessmentId }, select: { id: true, createdAt: true } });
    if (req.query.cursor !== undefined && !cursor) return invalid();
    const rows = await db.assessmentSubmission.findMany({
      where: { assessmentId, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1,
      select: { id: true, studentId: true, state: true, createdAt: true, student: { select: { displayName: true, email: true } }, version: { select: { version: true } } },
    });
    const submissions = rows.slice(0, limit);
    res.json(ok({ submissions, nextCursor: rows.length > limit ? submissions.at(-1)!.id : null }));
  }));
  admin.get('/:id/submissions/:submissionId', asyncRoute(async (req, res) => {
    const found = await db.assessmentSubmission.findFirst({ where: { id: uuid(req.params.submissionId), assessmentId: uuid(req.params.id) }, select: { id: true, studentId: true, state: true, answers: true, result: true, createdAt: true, student: { select: { displayName: true, email: true } }, version: { select: { version: true } } } });
    if (!found) throw new ApiError(404, 'NOT_FOUND', 'Submission not found.');
    res.json(ok(found));
  }));
  return { studentRouter: r, adminRouter: admin };
}
