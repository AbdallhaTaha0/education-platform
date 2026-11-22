import { Router } from 'express';
import { ok } from '../../identity/errors.js';
import {
  createTeacher,
  deleteTeacher,
  listAdminTeachers,
  updateTeacher,
} from '../teachers.js';
import type { CatalogRouteContext } from '../types.js';
import { readGuard, writeGuard, limit } from './guards.js';
import { asyncRoute, authOf } from './shared.js';

export function createTeacherAdminRouter(ctx: CatalogRouteContext): Router {
  const router = Router();
  router.get(
    '/teachers',
    [...readGuard],
    asyncRoute(async (_req, res) => {
      res.json(ok({ teachers: await listAdminTeachers(ctx.prisma) }));
    }),
  );
  router.post(
    '/teachers',
    [...writeGuard, limit()],
    asyncRoute(async (req, res) => {
      res
        .status(201)
        .json(ok({ teacher: await createTeacher(ctx.prisma, authOf(req).userId, req.body) }));
    }),
  );
  router.patch(
    '/teachers/:id',
    [...writeGuard],
    asyncRoute(async (req, res) => {
      res.json(
        ok({
          teacher: await updateTeacher(
            ctx.prisma,
            authOf(req).userId,
            req.params['id'] as string,
            req.body,
          ),
        }),
      );
    }),
  );
  router.delete(
    '/teachers/:id',
    [...writeGuard],
    asyncRoute(async (req, res) => {
      res.json(
        ok(await deleteTeacher(ctx.prisma, authOf(req).userId, req.params['id'] as string)),
      );
    }),
  );
  return router;
}
