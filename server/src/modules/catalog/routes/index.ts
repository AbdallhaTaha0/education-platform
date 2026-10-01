import { Router } from 'express';
import type { CatalogRouteContext } from '../types.js';
import { createCatalogPublicRouter } from './public.js';
import { createCourseAdminRouter } from './courses.js';
import { createHierarchyRouter } from './hierarchy.js';
import { createMediaRouter } from './media.js';
import { createDeletionRouter } from './deletion.js';
import { createPackageAdminRouter } from './packages.js';
import { createSummaryRouter } from './summary.js';

export function createCatalogAdminRouter(ctx: CatalogRouteContext): Router {
  const router = Router();
  router.use(createSummaryRouter(ctx));
  router.use(createPackageAdminRouter(ctx));
  router.use(createCourseAdminRouter(ctx));
  router.use(createHierarchyRouter(ctx));
  router.use(createMediaRouter(ctx));
  router.use(createDeletionRouter(ctx));
  return router;
}

export { createCatalogPublicRouter };
