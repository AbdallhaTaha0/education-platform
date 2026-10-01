import { Router } from 'express';
import { ok } from '../../identity/errors.js';
import { getPublishedCourseBySlug, listPublishedCourses } from '../courses/service.js';
import type { CatalogRouteContext } from '../types.js';
import { asyncRoute } from './shared.js';
import { listPackages, memberInclude, publicPackage } from '../packages.js';
import { assertUuid } from '../validation.js';
import { ApiError } from '../../identity/errors.js';

export function createCatalogPublicRouter(ctx: CatalogRouteContext): Router {
  const router = Router();
  router.get(
    '/packages',
    asyncRoute(async (_req, res) => {
      res.json(ok({ packages: await listPackages(ctx.prisma) }));
    }),
  );
  router.get(
    '/packages/:id',
    asyncRoute(async (req, res) => {
      const id = assertUuid(req.params.id);
      const row = await ctx.prisma.coursePackage.findUnique({
        where: { id },
        include: memberInclude,
      });
      if (!row || row.status !== 'PUBLISHED')
        throw new ApiError(404, 'NOT_FOUND', 'Package not found.');
      res.json(ok({ package: publicPackage(row) }));
    }),
  );
  router.get(
    '/courses',
    asyncRoute(async (req, res) => {
      res.status(200).json(ok({ courses: await listPublishedCourses(ctx.prisma, req.query) }));
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
