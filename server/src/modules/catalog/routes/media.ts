import { Router } from 'express';
import { ok } from '../../identity/errors.js';
import { writeGuard } from './guards.js';
import { registerLessonMedia } from '../media/intentService.js';
import { completeLessonUpload } from '../media/completionService.js';
import { syncCourseMedia, syncLessonMedia } from '../media/syncService.js';
import type { CatalogRouteContext } from '../types.js';
import { asyncRoute, authOf, ctxOf } from './shared.js';
import { removeDraftVideo } from '../media/retirement.js';

export function createMediaRouter(ctx: CatalogRouteContext): Router {
  const router = Router();
  router.delete('/catalog/lessons/:id/media', [...writeGuard], asyncRoute(async (req, res) => {
    const c = ctxOf(req);
    res.json(ok(await removeDraftVideo(c.prisma, authOf(req).userId, req.params['id'] as string)));
  }));

  router.post(
    '/catalog/lessons/:id/media',
    [...writeGuard],
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const result = await registerLessonMedia(
        c.prisma,
        c.config,
        c.drmFactory,
        authOf(req).userId,
        req.params['id'] as string,
        req.body,
      );
      res.status(201).json(ok({ mapping: result.mapping, uploadUrl: result.uploadUrl }));
    }),
  );

  router.post(
    '/catalog/lessons/:id/media/complete',
    [...writeGuard],
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const updated = await completeLessonUpload(
        c.prisma,
        c.config,
        c.drmFactory,
        authOf(req).userId,
        req.params['id'] as string,
      );
      res.status(200).json(ok({ mapping: updated }));
    }),
  );

  router.post(
    '/catalog/lessons/:id/media/sync',
    [...writeGuard],
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      const updated = await syncLessonMedia(
        c.prisma,
        c.config,
        c.drmFactory,
        authOf(req).userId,
        req.params['id'] as string,
      );
      res.status(200).json(ok({ mapping: updated }));
    }),
  );

  router.post(
    '/catalog/courses/:id/media/sync',
    [...writeGuard],
    asyncRoute(async (req, res) => {
      const c = ctxOf(req);
      res
        .status(200)
        .json(
          ok(
            await syncCourseMedia(
              c.prisma,
              c.config,
              c.drmFactory,
              authOf(req).userId,
              req.params['id'] as string,
            ),
          ),
        );
    }),
  );

  void ctx;
  return router;
}
