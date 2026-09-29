import { Router } from 'express';
import { ok } from '../../identity/errors.js';
import { writeGuard } from './guards.js';
import {
  createLesson,
  createSection,
  deleteLesson,
  deleteSection,
  reorderLessons,
  reorderSections,
  updateLesson,
  updateSection,
} from '../hierarchy/service.js';
import { createPlan, deletePlan, updatePlan } from '../plans/service.js';
import type { CatalogRouteContext } from '../types.js';
import { asyncRoute, authOf } from './shared.js';

export function createHierarchyRouter(ctx: CatalogRouteContext): Router {
  const router = Router();

  router.post('/catalog/courses/:id/sections', [...writeGuard], asyncRoute(async (req, res) => {
    const created = await createSection(ctx.prisma, authOf(req).userId, req.params['id'] as string, req.body);
    res.status(201).json(ok({ section: created }));
  }));
  router.patch('/catalog/sections/:id', [...writeGuard], asyncRoute(async (req, res) => {
    const updated = await updateSection(ctx.prisma, authOf(req).userId, req.params['id'] as string, req.body);
    res.status(200).json(ok({ section: updated }));
  }));
  router.delete('/catalog/sections/:id', [...writeGuard], asyncRoute(async (req, res) => {
    res.status(200).json(ok(await deleteSection(ctx.prisma, authOf(req).userId, req.params['id'] as string)));
  }));
  router.post('/catalog/courses/:id/sections/reorder', [...writeGuard], asyncRoute(async (req, res) => {
    res.status(200).json(ok(await reorderSections(ctx.prisma, authOf(req).userId, req.params['id'] as string, req.body)));
  }));

  router.post('/catalog/sections/:id/lessons', [...writeGuard], asyncRoute(async (req, res) => {
    const created = await createLesson(ctx.prisma, authOf(req).userId, req.params['id'] as string, req.body);
    res.status(201).json(ok({ lesson: created }));
  }));
  router.patch('/catalog/lessons/:id', [...writeGuard], asyncRoute(async (req, res) => {
    const updated = await updateLesson(ctx.prisma, authOf(req).userId, req.params['id'] as string, req.body);
    res.status(200).json(ok({ lesson: updated }));
  }));
  router.delete('/catalog/lessons/:id', [...writeGuard], asyncRoute(async (req, res) => {
    res.status(200).json(ok(await deleteLesson(ctx.prisma, authOf(req).userId, req.params['id'] as string)));
  }));
  router.post('/catalog/sections/:id/lessons/reorder', [...writeGuard], asyncRoute(async (req, res) => {
    res.status(200).json(ok(await reorderLessons(ctx.prisma, authOf(req).userId, req.params['id'] as string, req.body)));
  }));

  router.post('/catalog/courses/:id/plans', [...writeGuard], asyncRoute(async (req, res) => {
    const created = await createPlan(ctx.prisma, authOf(req).userId, req.params['id'] as string, req.body);
    res.status(201).json(ok({ plan: created }));
  }));
  router.patch('/catalog/plans/:id', [...writeGuard], asyncRoute(async (req, res) => {
    const updated = await updatePlan(ctx.prisma, authOf(req).userId, req.params['id'] as string, req.body);
    res.status(200).json(ok({ plan: updated }));
  }));
  router.delete('/catalog/plans/:id', [...writeGuard], asyncRoute(async (req, res) => {
    res.status(200).json(ok(await deletePlan(ctx.prisma, authOf(req).userId, req.params['id'] as string)));
  }));

  return router;
}
