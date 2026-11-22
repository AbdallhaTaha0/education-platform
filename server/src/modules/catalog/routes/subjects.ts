import { Router } from 'express';
import { ok } from '../../identity/errors.js';
import {
  createSubject,
  deleteSubject,
  listAdminSubjects,
  updateSubject,
} from '../subjects.js';
import type { CatalogRouteContext } from '../types.js';
import { readGuard, writeGuard, limit } from './guards.js';
import { asyncRoute, authOf } from './shared.js';

export function createSubjectAdminRouter(ctx: CatalogRouteContext): Router {
  const router = Router();
  router.get(
    '/subjects',
    [...readGuard],
    asyncRoute(async (_req, res) => {
      res.json(ok({ subjects: await listAdminSubjects(ctx.prisma) }));
    }),
  );
  router.post(
    '/subjects',
    [...writeGuard, limit()],
    asyncRoute(async (req, res) => {
      res
        .status(201)
        .json(ok({ subject: await createSubject(ctx.prisma, authOf(req).userId, req.body) }));
    }),
  );
  router.patch(
    '/subjects/:id',
    [...writeGuard],
    asyncRoute(async (req, res) => {
      res.json(
        ok({
          subject: await updateSubject(
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
    '/subjects/:id',
    [...writeGuard],
    asyncRoute(async (req, res) => {
      res.json(
        ok(await deleteSubject(ctx.prisma, authOf(req).userId, req.params['id'] as string)),
      );
    }),
  );
  return router;
}
