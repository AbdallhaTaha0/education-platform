import { Router, type NextFunction, type Request, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAdmin, requireAuth, requireOrigin, requireSessionCsrf } from '../identity/middleware.js';
import { ApiError } from '../identity/errors.js';
import { normalizeEmail, normalizePhone } from '../identity/validation.js';
import { ok } from '../identity/service.js';

const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => { handler(req, res).catch(next); };

/** Public contact reads and guarded administration in the same Express backend. */
export function createSupportRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.get('/contact', asyncRoute(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const contact = await prisma.supportContact.findUnique({where: {id: 1}, select: {email: true, phone: true, version: true}});
    res.json(ok({contact}));
  }));
  router.put('/contact', requireOrigin, requireAuth, requireAdmin, requireSessionCsrf, asyncRoute(async (req, res) => {
    const body = req.body as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid contact details.');
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some(key => !['email', 'phone', 'version'].includes(key))) throw new ApiError(400, 'INVALID_FIELD', 'Unknown contact field.');
    const email = normalizeEmail(input.email); const phone = normalizePhone(input.phone);
    if (!Number.isSafeInteger(input.version) || Number(input.version) < 1 || Number(input.version) >= 2147483647) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid contact version.');
    const contact = await prisma.$transaction(async tx => {
      const updated = await tx.supportContact.updateMany({where: {id: 1, version: Number(input.version)}, data: {email, phone, version: {increment: 1}}});
      if (updated.count !== 1) throw new ApiError(409, 'OFFER_CHANGED', 'Contact details changed. Reload before saving.');
      return tx.supportContact.findUniqueOrThrow({where: {id: 1}, select: {email: true, phone: true, version: true}});
    });
    res.set('Cache-Control', 'no-store').json(ok({contact}));
  }));
  return router;
}
