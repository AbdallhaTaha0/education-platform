/**
 * Learning routes (M5 + course-learning enhancements).
 *
 * Every route resolves a trusted binding before touching data, and every
 * state-changing route carries the same origin + session-CSRF guards used by
 * M2-M4. Reads omit the origin guard because browsers may omit Origin on GET.
 */
import { Router } from 'express';
import { ok } from '../../identity/errors.js';
import {
  rateLimit,
  requireAuth,
  requireOrigin,
  requireSessionCsrf,
} from '../../identity/middleware.js';
import type { RateLimit } from '../../identity/rateLimit.js';
import { LearningError } from '../errors.js';
import { loadOutline, resolveCourse, resolveLesson } from '../access/service.js';
import { loadDashboard } from '../dashboard/service.js';
import { recordProgress } from '../progress/service.js';
import {
  createPlaybackSession,
  endPlaybackSession,
  renewPlaybackToken,
} from '../playback/service.js';
import { detectCrossedSubscriptions } from '../expiry/reconciler.js';
import { asyncRoute, ctxOf, studentOf, type LearningRouteContext } from './shared.js';
import { createMaterialsRouter } from '../materials/routes.js';
import { listOwnSessions } from '../sessions/service.js';
import {
  recordHeartbeat,
  startViewSession,
  toViewPayload,
} from '../tracking/service.js';

const PLAYBACK_LIMIT: RateLimit = { windowSec: 60, max: 30 };
const PROGRESS_LIMIT: RateLimit = { windowSec: 60, max: 600 };
const RENEW_LIMIT: RateLimit = { windowSec: 60, max: 30 };
const VIEW_START_LIMIT: RateLimit = { windowSec: 60, max: 30 };
const VIEW_HEARTBEAT_LIMIT: RateLimit = { windowSec: 60, max: 120 };

/** Student write guards: origin, session, CSRF, role, rate limit. */
const studentWriteGuard = [requireOrigin, requireAuth, requireSessionCsrf];
const studentReadGuard = [requireAuth];

export function createLearningRouter(ctx: LearningRouteContext): Router {
  const router = Router();
  const limit = (scope: string, value: RateLimit) => rateLimit(scope, value);

  // GET /learning/dashboard — active and expired subscriptions.
  router.get(
    '/dashboard',
    ...studentReadGuard,
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const student = studentOf(req);
      const nowMs = c.now();
      await detectCrossedSubscriptions(c.prisma, nowMs);
      res.status(200).json(ok(await loadDashboard(c.prisma, student.userId, nowMs)));
    }),
  );

  // GET /learning/courses/:courseRef/outline — protected ordered content.
  router.get(
    '/courses/:courseRef/outline',
    ...studentReadGuard,
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const student = studentOf(req);
      const nowMs = c.now();
      const course = await resolveCourse({
        prisma: c.prisma,
        studentId: student.userId,
        courseRef: req.params['courseRef'] as string,
        nowMs,
      });
      const sections = await loadOutline(c.prisma, course.courseId, student.userId);
      res.status(200).json(ok({ course, sections }));
    }),
  );

  // GET /learning/courses/:courseRef/lessons/:lessonId/progress
  router.get(
    '/courses/:courseRef/lessons/:lessonId/progress',
    ...studentReadGuard,
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const student = studentOf(req);
      const nowMs = c.now();
      const course = await resolveCourse({
        prisma: c.prisma,
        studentId: student.userId,
        courseRef: req.params['courseRef'] as string,
        nowMs,
      });
      const lesson = await resolveLesson(
        c.prisma,
        course,
        req.params['lessonId'] as string,
        student.userId,
      );
      const row = await c.prisma.lessonProgress.findUnique({
        where: { studentId_lessonId: { studentId: student.userId, lessonId: lesson.lessonId } },
        select: { positionSeconds: true, durationSeconds: true, completedAt: true },
      });
      res.status(200).json(
        ok({
          lessonId: lesson.lessonId,
          positionSeconds: row?.positionSeconds ?? 0,
          durationSeconds: row?.durationSeconds ?? null,
          completed: row?.completedAt != null,
        }),
      );
    }),
  );

  // POST /learning/courses/:courseRef/lessons/:lessonId/playback
  router.post(
    '/courses/:courseRef/lessons/:lessonId/playback',
    ...studentWriteGuard,
    limit('learning-playback', PLAYBACK_LIMIT),
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const student = studentOf(req);
      const nowMs = c.now();
      const course = await resolveCourse({
        prisma: c.prisma,
        studentId: student.userId,
        courseRef: req.params['courseRef'] as string,
        nowMs,
      });
      const lesson = await resolveLesson(
        c.prisma,
        course,
        req.params['lessonId'] as string,
        student.userId,
      );
      const body = (req.body ?? {}) as { deviceId?: unknown };
      if (
        typeof body.deviceId !== 'string' ||
        body.deviceId.trim().length === 0 ||
        body.deviceId.length > 128
      ) {
        throw new LearningError('VALIDATION_ERROR', 'deviceId is required.');
      }
      const prior = await c.prisma.lessonProgress.findUnique({
        where: { studentId_lessonId: { studentId: student.userId, lessonId: lesson.lessonId } },
        select: { positionSeconds: true, completedAt: true },
      });
      const grant = await createPlaybackSession(c.playback, {
        binding: lesson,
        deviceId: body.deviceId.trim(),
        nowMs,
        resumePositionSeconds: prior?.completedAt ? 0 : (prior?.positionSeconds ?? 0),
      });
      res.status(201).json(ok({ playback: grant }));
    }),
  );

  // POST /learning/playback/:referenceId/renew — platform-mediated token renewal.
  // Entitlement is re-checked on backend time inside the service, so a lapsed
  // subscription can never be renewed.
  router.post(
    '/playback/:referenceId/renew',
    ...studentWriteGuard,
    limit('learning-renew', RENEW_LIMIT),
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const student = studentOf(req);
      const outcome = await renewPlaybackToken(c.playback, {
        referenceId: req.params['referenceId'] as string,
        studentId: student.userId,
        nowMs: c.now(),
      });
      if (!outcome.renewed) {
        // The standard error envelope tells the client the session is gone, so
        // it stops playback and ends the session; the durable reference already
        // guarantees the external termination either way.
        throw new LearningError('PLAYBACK_SESSION_EXPIRED');
      }
      res.status(200).json(ok({ renewal: outcome }));
    }),
  );

  // POST /learning/progress — throttled resume/completion writes.
  router.post(
    '/progress',
    ...studentWriteGuard,
    limit('learning-progress', PROGRESS_LIMIT),
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const student = studentOf(req);
      const nowMs = c.now();
      const body = (req.body ?? {}) as {
        courseRef?: unknown;
        lessonId?: unknown;
        positionSeconds?: unknown;
        durationSeconds?: unknown;
        completed?: unknown;
      };
      if (typeof body.courseRef !== 'string' || body.courseRef.length === 0) {
        throw new LearningError('VALIDATION_ERROR', 'courseRef is required.');
      }
      if (typeof body.lessonId !== 'string' || body.lessonId.length === 0) {
        throw new LearningError('VALIDATION_ERROR', 'lessonId is required.');
      }
      const course = await resolveCourse({
        prisma: c.prisma,
        studentId: student.userId,
        courseRef: body.courseRef,
        nowMs,
      });
      const lesson = await resolveLesson(c.prisma, course, body.lessonId, student.userId);
      const result = await recordProgress(c.prisma, {
        binding: lesson,
        positionSeconds: body.positionSeconds as number,
        durationSeconds: (body.durationSeconds ?? null) as number | null,
        completed: body.completed === true,
        nowMs,
      });
      res.status(200).json(ok({ progress: result }));
    }),
  );

  // POST /learning/playback/:referenceId/end — player finished normally.
  // Always answers 200 for the viewer's own end: the durable reference is
  // already closed, and a failed DRM confirmation is retried in the background.
  router.post(
    '/playback/:referenceId/end',
    ...studentWriteGuard,
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const student = studentOf(req);
      const outcome = await endPlaybackSession(
        c.prisma,
        c.drm,
        req.params['referenceId'] as string,
        student.userId,
        c.now(),
      );
      res.status(200).json(ok({ ended: true, closure: outcome }));
    }),
  );

  // GET /learning/sessions — student's own bounded playback references.
  // Safe labels only; never external ids, tokens or URLs. Used by the
  // explicit own-session recovery flow after a concurrent-stream denial.
  router.get(
    '/sessions',
    ...studentReadGuard,
    limit('learning-sessions', PLAYBACK_LIMIT),
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const student = studentOf(req);
      res.status(200).json(ok({ sessions: await listOwnSessions(c.prisma, student.userId) }));
    }),
  );

  // POST /learning/courses/:courseRef/lessons/:lessonId/views/start (M10).
  // Starts (or idempotently re-attaches to) the view session for one playback
  // grant. Refresh and successful reconnect mint a new grant and therefore a
  // new row; failed reconnects mint no grant and therefore no row. Pause,
  // resume and token renewal reuse the same grant and the same row.
  router.post(
    '/courses/:courseRef/lessons/:lessonId/views/start',
    ...studentWriteGuard,
    limit('learning-view-start', VIEW_START_LIMIT),
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const student = studentOf(req);
      const nowMs = c.now();
      const course = await resolveCourse({
        prisma: c.prisma,
        studentId: student.userId,
        courseRef: req.params['courseRef'] as string,
        nowMs,
      });
      const lesson = await resolveLesson(
        c.prisma,
        course,
        req.params['lessonId'] as string,
        student.userId,
      );
      const body = (req.body ?? {}) as { playbackReferenceId?: unknown };
      if (typeof body.playbackReferenceId !== 'string' || body.playbackReferenceId.length === 0) {
        throw new LearningError('VALIDATION_ERROR', 'playbackReferenceId is required.');
      }
      if (body.playbackReferenceId.length > 128) {
        throw new LearningError('VALIDATION_ERROR');
      }
      const outcome = await startViewSession(c.prisma, {
        binding: lesson,
        playbackReferenceId: body.playbackReferenceId,
        nowMs,
      });
      res
        .status(outcome.created ? 201 : 200)
        .json(ok({ view: toViewPayload(outcome.view, outcome.trackingStartedAt) }));
    }),
  );

  // POST /learning/views/:viewSessionId/heartbeat (M10).
  // Records accumulated actual playing time for one session. The total only
  // moves forward and the 30-second transition happens at most once per row
  // in the same row-locked transaction, so duplicates, retries and concurrent
  // writes count once and 60/90s of continuous playback add nothing.
  router.post(
    '/views/:viewSessionId/heartbeat',
    ...studentWriteGuard,
    limit('learning-view-heartbeat', VIEW_HEARTBEAT_LIMIT),
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const student = studentOf(req);
      const body = (req.body ?? {}) as { playedMilliseconds?: unknown };
      const outcome = await recordHeartbeat(c.prisma, {
        viewSessionId: req.params['viewSessionId'] as string,
        studentId: student.userId,
        playedMilliseconds: body.playedMilliseconds as number,
        nowMs: c.now(),
      });
      res.status(200).json(
        ok({
          view: toViewPayload(outcome.view, outcome.trackingStartedAt),
          newlyCounted: outcome.newlyCounted,
        }),
      );
    }),
  );

  // Mount materials sub-router (lesson resources)
  router.use('/', createMaterialsRouter(ctx));

  return router;
}
