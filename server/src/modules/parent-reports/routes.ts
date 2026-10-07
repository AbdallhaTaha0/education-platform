/**
 * ADMIN routes for course rosters, per-student views, report course
 * selection, transient parent-report generation and contact recheck.
 * Mounted at /admin; guards: read = requireAuth+requireAdmin; write =
 * requireOrigin+requireAuth+requireAdmin+requireSessionCsrf. All responses
 * no-store (also enforced globally in app.ts). Nothing is persisted: report
 * rows never touch the database; no report body, guardian number or
 * recipient-bearing URL is logged.
 */
import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { ApiError, ok } from '../identity/errors.js';
import {
  rateLimit,
  requireAdmin,
  requireAuth,
  requireOrigin,
  requireSessionCsrf,
} from '../identity/middleware.js';
import type { ServerConfig } from '../../config.js';
import { postgresViewFactsReader, type ViewFactsReader } from './viewFacts.js';
import { courseRoster, reportCourses, studentCourseViews } from './reportService.js';
import { generateParentReport } from './reportServer.js';

export interface ParentReportsDeps {
  prisma: PrismaClient;
  config: ServerConfig;
  clock?: () => number;
  /** Test seam: override the view-facts reader. */
  viewFactsReader?: ViewFactsReader;
}

const readGuard = [requireAuth, requireAdmin];
const writeGuard = [requireOrigin, requireAuth, requireAdmin, requireSessionCsrf];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cursorQuery(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  return value;
}

function parseUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} is invalid.`);
  }
  return value;
}

function boundedLimit(value: unknown): number {
  if (value === undefined) return 20;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid limit.');
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid limit.');
  }
  return n;
}

export function createParentReportsRouter(deps: ParentReportsDeps): Router {
  const router = Router();
  const reader = deps.viewFactsReader ?? postgresViewFactsReader(deps.prisma);
  const nowMs = () => (deps.clock ? deps.clock() : Date.now());

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/courses/:courseId/students', ...readGuard, async (req, res, next) => {
    try {
      const courseId = parseUuid(req.params['courseId'], 'courseId');
      const limit = boundedLimit(req.query['limit']);
      if (req.query['q'] !== undefined && typeof req.query['q'] !== 'string') throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid search.');
      const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
      if (q.length > 100) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid search.');
      const cursor = cursorQuery(req.query['cursor']);
      res.json(
        ok(
          await courseRoster(deps.prisma, reader, {
            courseId,
            limit,
            ...(q !== '' ? { q } : {}),
            ...(cursor !== undefined ? { cursor } : {}),
          }),
        ),
      );
    } catch (err) {
      next(err);
    }
  });

  router.get(
    '/courses/:courseId/students/:studentId/views',
    ...readGuard,
    async (req, res, next) => {
      try {
        const courseId = parseUuid(req.params['courseId'], 'courseId');
        const studentId = parseUuid(req.params['studentId'], 'studentId');
        const limit = boundedLimit(req.query['limit']);
        const cursor = cursorQuery(req.query['cursor']);
        res.json(
          ok(
            await studentCourseViews(deps.prisma, reader, {
              courseId,
              studentId,
              limit,
              ...(cursor !== undefined ? { cursor } : {}),
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/students/:studentId/report-courses', ...readGuard, async (req, res, next) => {
    try {
      const studentId = parseUuid(req.params['studentId'], 'studentId');
      const limit = boundedLimit(req.query['limit']);
      const cursor = cursorQuery(req.query['cursor']);
      res.json(
        ok(
          await reportCourses(deps.prisma, studentId, {
            limit,
            ...(cursor !== undefined ? { cursor } : {}),
            nowMs: nowMs(),
          }),
        ),
      );
    } catch (err) {
      next(err);
    }
  });

  router.get('/students/:studentId/report-contact', ...readGuard, async (req, res, next) => {
    try {
      const studentId = parseUuid(req.params['studentId'], 'studentId');
      const user = await deps.prisma.user.findUnique({
        where: { id: studentId },
        select: { role: true },
      });
      if (!user || user.role !== 'STUDENT') {
        throw new ApiError(404, 'NOT_FOUND', 'Student is not available.');
      }
      const profile = await deps.prisma.studentProfile.findUnique({
        where: { userId: studentId },
        select: { parentPhone: true },
      });
      res.json(ok({ phone: profile?.parentPhone?.trim() || null }));
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/parent-reports/generate',
    ...writeGuard,
    rateLimit('parent-reports-generate', { windowSec: 60, max: 30 }),
    async (req, res, next) => {
      try {
        const rawBody = req.body as unknown;
        if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
        }
        const body = rawBody as {
          studentId?: unknown;
          courseIds?: unknown;
          reportType?: unknown;
          language?: unknown;
          format?: unknown;
        };
        const studentId = typeof body.studentId === 'string' ? body.studentId : '';
        if (!UUID_RE.test(studentId))
          throw new ApiError(400, 'VALIDATION_ERROR', 'studentId is invalid.');
        const courseIds =
          Array.isArray(body.courseIds) &&
          body.courseIds.length > 0 &&
          body.courseIds.length <= 50 &&
          body.courseIds.every((c) => typeof c === 'string' && UUID_RE.test(c))
            ? (body.courseIds as string[])
            : null;
        if (!courseIds) throw new ApiError(400, 'VALIDATION_ERROR', 'courseIds is invalid.');
        const reportType =
          body.reportType === 'WEEK' ||
          body.reportType === 'TWO_WEEKS' ||
          body.reportType === 'FOUR_WEEKS'
            ? body.reportType
            : null;
        const language = body.language === 'ar' || body.language === 'en' ? body.language : null;
        if (body.format !== undefined && body.format !== 'SHORT' && body.format !== 'DETAILED') {
          throw new ApiError(400, 'VALIDATION_ERROR', 'format is invalid.');
        }
        if (!reportType || !language) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'reportType/language is invalid.');
        }
        res.json(
          ok(
            await generateParentReport(deps.prisma, deps.viewFactsReader, {
              studentId,
              courseIds,
              reportType,
              language,
              format: body.format as 'SHORT' | 'DETAILED' | undefined,
              nowMs: nowMs(),
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
