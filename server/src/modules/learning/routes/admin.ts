/**
 * ADMIN learning routes (device management).
 *
 * Mounted at `/admin` so paths read `/admin/learning/...`, matching the
 * parallel contract. ADMIN-only; mutations require Origin + session CSRF.
 * The platform student id is resolved server-side; arbitrary external
 * user/application ids are never accepted.
 */
import { Router } from 'express';
import { ok } from '../../identity/errors.js';
import {
  rateLimit,
  requireAdmin,
  requireAuth,
  requireOrigin,
  requireSessionCsrf,
} from '../../identity/middleware.js';
import type { RateLimit } from '../../identity/rateLimit.js';
import { asyncRoute, ctxOf, type LearningRouteContext } from './shared.js';
import { inspectStudentDevices, releaseStudentDevice } from '../devices/service.js';

const DEVICE_READ_LIMIT: RateLimit = { windowSec: 60, max: 60 };
const DEVICE_WRITE_LIMIT: RateLimit = { windowSec: 60, max: 20 };

const adminReadGuard = [requireAuth, requireAdmin];
const adminWriteGuard = [requireOrigin, requireAuth, requireAdmin, requireSessionCsrf];

export function createLearningAdminRouter(_ctx: LearningRouteContext): Router {
  const router = Router();
  const limit = (scope: string, value: RateLimit) => rateLimit(scope, value);

  // GET /admin/learning/students/:studentId/devices
  router.get(
    '/learning/students/:studentId/devices',
    ...adminReadGuard,
    limit('learning-admin-devices-read', DEVICE_READ_LIMIT),
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const inspection = await inspectStudentDevices(
        c.prisma,
        c.drm,
        req.params['studentId'],
      );
      res.status(200).json(ok({ devices: inspection }));
    }),
  );

  // POST /admin/learning/students/:studentId/devices/:deviceReference/release
  router.post(
    '/learning/students/:studentId/devices/:deviceReference/release',
    ...adminWriteGuard,
    limit('learning-admin-devices-release', DEVICE_WRITE_LIMIT),
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const adminId = req.auth!.userId;
      const outcome = await releaseStudentDevice(
        c.prisma,
        c.drm,
        adminId,
        req.params['studentId'],
        req.params['deviceReference'],
        c.now(),
      );
      res.status(200).json(ok({ release: outcome }));
    }),
  );

  return router;
}
