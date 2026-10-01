import { Router, type ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ApiError, ok } from '../identity/errors.js';
import { requireAuth, requireOrigin, requireSessionCsrf } from '../identity/middleware.js';
import { assertUuid } from '../catalog/validation.js';
import {
  listInbox,
  readAll,
  setReadState,
  unreadCount,
  type NotificationContext,
} from './service.js';
import { parseInboxQuery, parseReadAll, parseReadState } from './validation.js';

export function createNotificationRouter(ctx: NotificationContext) {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      res.json(ok(await listInbox(ctx, req.auth!.userId, parseInboxQuery(req.query))));
    } catch (err) {
      next(err);
    }
  });
  router.get('/unread-count', requireAuth, async (req, res, next) => {
    try {
      if (Object.keys(req.query).length)
        throw new ApiError(400, 'INVALID_FIELD', 'Notification count accepts no query fields.');
      res.json(ok(await unreadCount(ctx, req.auth!.userId)));
    } catch (err) {
      next(err);
    }
  });
  const writes = [requireOrigin, requireAuth, requireSessionCsrf];
  router.put('/:id/read-state', ...writes, async (req, res, next) => {
    try {
      if (Object.keys(req.query).length)
        throw new ApiError(400, 'INVALID_FIELD', 'Unexpected notification query.');
      const id = req.params['id'] as string;
      assertUuid(id, 'id');
      res.json(ok(await setReadState(ctx, req.auth!.userId, id, parseReadState(req.body))));
    } catch (err) {
      next(err);
    }
  });
  router.post('/read-all', ...writes, async (req, res, next) => {
    try {
      if (Object.keys(req.query).length)
        throw new ApiError(400, 'INVALID_FIELD', 'Unexpected notification query.');
      res.json(ok(await readAll(ctx, req.auth!.userId, parseReadAll(req.body))));
    } catch (err) {
      next(err);
    }
  });
  // Dependency failures in authentication or inbox storage cannot expose raw errors or bypass access checks.
  const failure: ErrorRequestHandler = (err: unknown, _req, _res, next) => {
    const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
    const dependency =
      err instanceof Prisma.PrismaClientInitializationError ||
      [
        'P1000',
        'P1001',
        'P1002',
        'P1008',
        'P1017',
        'P2024',
        'P2028',
        'P2034',
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EPIPE',
      ].includes(code) ||
      (err instanceof Error &&
        /^(redis connection ended before becoming ready|Connection is closed\.|Stream isn't writeable and enableOfflineQueue options is false)$/.test(
          err.message,
        ));
    next(
      dependency
        ? new ApiError(
            503,
            'NOTIFICATIONS_UNAVAILABLE',
            'Notifications are temporarily unavailable.',
          )
        : err,
    );
  };
  router.use(failure);
  return router;
}
