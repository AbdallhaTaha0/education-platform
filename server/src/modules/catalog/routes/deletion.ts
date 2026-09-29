import { Router } from 'express';
import { ok } from '../../identity/errors.js';
import { readGuard, writeGuard } from './guards.js';
import { requestPermanentDeletion } from '../deletion/requestService.js';
import { getDeletionOperation } from '../deletion/readService.js';
import { retryDeletionOperation } from '../deletion/reconciler.js';
import type { CatalogRouteContext, DeletionTargetType } from '../types.js';
import { asyncRoute, authOf, ctxOf } from './shared.js';

function targetOf(kind: DeletionTargetType, id: string, body: unknown, c: CatalogRouteContext, userId: string) {
  return requestPermanentDeletion(c.prisma, c.config, c.drmFactory, userId, kind, id, body, c.redis);
}

export function createDeletionRouter(ctx: CatalogRouteContext): Router {
  const router = Router();

  router.post('/catalog/courses/:id/delete', [...writeGuard], asyncRoute(async (req, res) => {
    const c = ctxOf(req);
    const op = await targetOf('COURSE', req.params['id'] as string, req.body, c, authOf(req).userId);
    res.status(202).json(ok({ operation: op }));
  }));
  router.post('/catalog/sections/:id/delete', [...writeGuard], asyncRoute(async (req, res) => {
    const c = ctxOf(req);
    const op = await targetOf('SECTION', req.params['id'] as string, req.body, c, authOf(req).userId);
    res.status(202).json(ok({ operation: op }));
  }));
  router.post('/catalog/lessons/:id/delete', [...writeGuard], asyncRoute(async (req, res) => {
    const c = ctxOf(req);
    const op = await targetOf('LESSON', req.params['id'] as string, req.body, c, authOf(req).userId);
    res.status(202).json(ok({ operation: op }));
  }));

  router.get('/catalog/deletions/:id', [...readGuard], asyncRoute(async (req, res) => {
    const op = await getDeletionOperation(ctx.prisma, req.params['id'] as string);
    res.status(200).json(ok({ operation: op }));
  }));

  router.post('/catalog/deletions/:id/retry', [...writeGuard], asyncRoute(async (req, res) => {
    const c = ctxOf(req);
    const op = await retryDeletionOperation(c.prisma, c.config, c.drmFactory, c.redis, authOf(req).userId, req.params['id'] as string);
    res.status(200).json(ok({ operation: op }));
  }));

  void ctx;
  return router;
}
