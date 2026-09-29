import { Router } from 'express';
import { ok } from '../../identity/errors.js';
import { getPublishedCourseBySlug, listPublishedCourses } from '../courses/service.js';
import type { CatalogRouteContext } from '../types.js';
import { asyncRoute } from './shared.js';

export function createCatalogPublicRouter(ctx: CatalogRouteContext): Router {
  const router = Router();
  router.get(
    '/courses',
    asyncRoute(async (_req, res) => {
      res.status(200).json(ok({ courses: await listPublishedCourses(ctx.prisma) }));
    }),
  );
  router.get(
    '/courses/:slug',
    asyncRoute(async (req, res) => {
      const course = await getPublishedCourseBySlug(ctx.prisma, req.params['slug'] as string);
      res.status(200).json(ok({ course }));
    }),
  );
  return router;
}
