import { Router } from 'express';
import { ok } from '../../identity/errors.js';
import { limit, readGuard, writeGuard } from './guards.js';
import {
  createCourse,
  getCourseAdmin,
  listCoursesAdmin,
  updateCourse,
} from '../courses/service.js';
import { archiveCourse, requestTransition, unarchiveCourse } from '../lifecycle/service.js';
import { availableLifecycleActions } from '../lifecycle/policy.js';
import type { CatalogRouteContext } from '../types.js';
import { asyncRoute, authOf } from './shared.js';

export function createCourseAdminRouter(ctx: CatalogRouteContext): Router {
  const router = Router();

  router.get(
    '/catalog/courses',
    [...readGuard],
    asyncRoute(async (_req, res) => {
      res.status(200).json(ok({ courses: await listCoursesAdmin(ctx.prisma) }));
    }),
  );

  router.post(
    '/catalog/courses',
    [...writeGuard, limit()],
    asyncRoute(async (req, res) => {
      const created = await createCourse(ctx.prisma, authOf(req).userId, req.body);
      res.status(201).json(ok({ course: created }));
    }),
  );

  router.get(
    '/catalog/courses/:id',
    [...readGuard],
    asyncRoute(async (req, res) => {
      const course = await getCourseAdmin(ctx.prisma, req.params['id'] as string);
      res.status(200).json(ok({ course }));
    }),
  );

  router.patch(
    '/catalog/courses/:id',
    [...writeGuard],
    asyncRoute(async (req, res) => {
      const updated = await updateCourse(
        ctx.prisma,
        authOf(req).userId,
        req.params['id'] as string,
        req.body,
      );
      res.status(200).json(ok({ course: updated }));
    }),
  );

  router.get(
    '/catalog/courses/:id/lifecycle-actions',
    [...readGuard],
    asyncRoute(async (req, res) => {
      const course = await getCourseAdmin(ctx.prisma, req.params['id'] as string);
      res.status(200).json(ok({ actions: availableLifecycleActions(course.status) }));
    }),
  );

  router.post(
    '/catalog/courses/:id/transitions',
    [...writeGuard],
    asyncRoute(async (req, res) => {
      const body = req.body as { to?: unknown };
      const updated = await requestTransition(
        ctx.prisma,
        authOf(req).userId,
        req.params['id'] as string,
        String(body.to ?? ''),
      );
      res.status(200).json(ok({ course: updated }));
    }),
  );

  router.post(
    '/catalog/courses/:id/archive',
    [...writeGuard],
    asyncRoute(async (req, res) => {
      const updated = await archiveCourse(
        ctx.prisma,
        authOf(req).userId,
        req.params['id'] as string,
      );
      res.status(200).json(ok({ course: updated }));
    }),
  );

  router.post(
    '/catalog/courses/:id/unarchive',
    [...writeGuard],
    asyncRoute(async (req, res) => {
      const updated = await unarchiveCourse(
        ctx.prisma,
        authOf(req).userId,
        req.params['id'] as string,
      );
      res.status(200).json(ok({ course: updated }));
    }),
  );

  return router;
}
