import { Router } from 'express';
import { ok } from '../../identity/errors.js';
import { requireAuth, requireOrigin, requireSessionCsrf, requireAdmin, rateLimit } from '../../identity/middleware.js';
import { LearningError } from '../errors.js';
import { asyncRoute, ctxOf, studentOf, type LearningRouteContext } from '../routes/shared.js';
import { parseMaterialForm } from './multipart.js';
import { makeContentDisposition } from './validation.js';
import { uploadResource, deleteResource, getStudentMaterials, getAdminMaterials, getResourceContent, type MaterialsDeps } from './service.js';
import type { Request } from 'express';
const read = [requireAuth];
const adminRead = [requireAuth, requireAdmin];
const write = [requireOrigin, requireAuth, requireAdmin, requireSessionCsrf];
const readLimit = () => rateLimit('materials-read', { windowSec: 60, max: 300 });
const writeLimit = () => rateLimit('materials-write', { windowSec: 60, max: 30 });
function depsOf(req: Request): MaterialsDeps {
  const ctx = ctxOf(req);
  if (!ctx.storage) throw new LearningError('MATERIAL_STORAGE_UNAVAILABLE');
  return { prisma: ctx.prisma, storage: ctx.storage, now: ctx.now };
}
// Metadata is held in PostgreSQL: an empty list must not require object storage.
function readDepsOf(req: Request) {
  const ctx = ctxOf(req);
  return { prisma: ctx.prisma, now: ctx.now };
}
export function createMaterialsRouter(_ctx: LearningRouteContext): Router {
  const router = Router();
  router.get('/lessons/:lessonId/materials', ...read, readLimit(), asyncRoute(async (req, res) => {
    const user = studentOf(req);
    res.json(ok(await getStudentMaterials(readDepsOf(req), user.userId, '', req.params['lessonId'])));
  }));
  router.get('/resources/:id/download', ...read, readLimit(), asyncRoute(async (req, res) => {
    const user = studentOf(req);
    const { content, fileName, mimeType } = await getResourceContent(depsOf(req), user.userId, '', req.params['id']);
    res.set({ 'Content-Type': mimeType, 'Content-Disposition': makeContentDisposition(fileName), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(Buffer.from(content));
  }));
  return router;
}
export function createAdminMaterialsRouter(_ctx: LearningRouteContext): Router {
  const router = Router();
  router.get('/learning/lessons/:lessonId/materials', ...adminRead, readLimit(), asyncRoute(async (req, res) => {
    res.json(ok(await getAdminMaterials(readDepsOf(req), req.params['lessonId'])));
  }));
  router.post('/learning/lessons/:lessonId/resources', ...write, writeLimit(), asyncRoute(async (req, res) => {
    const deps = depsOf(req);
    const form = await parseMaterialForm(req, ['metadata', 'file'], 10_485_760 + 8192);
    const file = form.get('file'), raw = form.get('metadata');
    if (!file || typeof file === 'string' || typeof raw !== 'string' || raw.length > 4096) throw new LearningError('MATERIAL_INVALID');
    let metadata: Record<string, unknown>;
    try { metadata = JSON.parse(raw); } catch { throw new LearningError('MATERIAL_INVALID'); }
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || Object.keys(metadata).some(k => !['labelAr', 'labelEn'].includes(k))) throw new LearningError('MATERIAL_INVALID');
    const resource = await uploadResource(deps, req.params['lessonId'], { labelAr: metadata.labelAr as string, labelEn: metadata.labelEn as string, fileName: file.name, mimeType: file.type, content: new Uint8Array(await file.arrayBuffer()) }, req.auth!.userId);
    res.status(201).json(ok({ resource }));
  }));
  router.delete('/learning/resources/:id', ...write, writeLimit(), asyncRoute(async (req, res) => {
    await deleteResource(depsOf(req), req.params['id'], req.auth!.userId);
    res.json(ok({ removed: true }));
  }));
  return router;
}
