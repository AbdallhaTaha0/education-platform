import { Router } from 'express';
import { ok } from '../../identity/errors.js';
import { listPackages, savePackage } from '../packages.js';
import type { CatalogRouteContext } from '../types.js';
import { readGuard, writeGuard, limit } from './guards.js';
import { asyncRoute, authOf } from './shared.js';

export function createPackageAdminRouter(ctx: CatalogRouteContext) {
  const router = Router();
  router.get('/catalog/packages', [...readGuard], asyncRoute(async (_req, res) => { res.json(ok({ packages: await listPackages(ctx.prisma, true) })); }));
  router.post('/catalog/packages', [...writeGuard, limit()], asyncRoute(async (req, res) => { res.status(201).json(ok({ package: await savePackage(ctx.prisma, authOf(req).userId, null, req.body) })); }));
  router.patch('/catalog/packages/:id', [...writeGuard], asyncRoute(async (req, res) => { res.json(ok({ package: await savePackage(ctx.prisma, authOf(req).userId, req.params.id as string, req.body) })); }));
  return router;
}
