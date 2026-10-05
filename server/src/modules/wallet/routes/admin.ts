import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { ok } from '../../identity/errors.js';
import {
  rateLimit,
  requireAdmin,
  requireAuth,
  requireOrigin,
  requireSessionCsrf,
} from '../../identity/middleware.js';
import { cleanupExpiredProofs } from '../cleanup/service.js';
import { getProofBytes, listRequestsForReview, reviewRequestPage } from '../recharge/queries.js';
import { parseListPage } from '../../../list-pagination.js';
import { reviewRecharge } from '../recharge/service.js';
import type { RechargeReviewInput } from '../types.js';
import { authOf } from './auth.js';
import type { ServerConfig } from '../../../config.js';
import { getInstaPay, saveInstaPay, getVodafoneCash, saveVodafoneCash } from '../payment-settings.js';
import { readQr, saveQr, removeQr } from '../payment-qr.js';

export interface WalletAdminDeps {
  prisma: PrismaClient;
  config: ServerConfig;
}

const readGuard = [requireAuth, requireAdmin];
const writeGuard = [requireOrigin, requireAuth, requireAdmin, requireSessionCsrf];

/** Admin recharge-review router. Proof bytes never leave this router except to an ADMIN. */
export function createWalletAdminRouter(deps: WalletAdminDeps) {
  const router = Router();
  router.get('/payment-settings/instapay/qr', ...readGuard, async (_req, res, next) => {
    try { const image = await readQr(deps.prisma, true); res.set({ 'Content-Type': image.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" }).send(image.bytes); } catch (error) { next(error); }
  });
  for (const method of ['post', 'delete'] as const) router[method]('/payment-settings/instapay/qr', ...writeGuard, rateLimit('payment-qr-write', { windowSec: 60, max: 20 }), async (req, res, next) => {
    try {
      if (method === 'post') await saveQr(deps.prisma, req.body); else await removeQr(deps.prisma, req.body);
      res.set('Cache-Control', 'no-store').json(ok(await getInstaPay(deps.prisma, deps.config.paymentChannels)));
    } catch (error) { next(error); }
  });
  router.get('/payment-settings/instapay', ...readGuard, async (_req, res, next) => {
    try { res.set('Cache-Control', 'no-store').json(ok(await getInstaPay(deps.prisma, deps.config.paymentChannels))); } catch (error) { next(error); }
  });
  router.put('/payment-settings/instapay', ...writeGuard, async (req, res, next) => {
    try {
      await saveInstaPay(deps.prisma, req.body);
      res.set('Cache-Control', 'no-store').json(ok(await getInstaPay(deps.prisma, deps.config.paymentChannels)));
    } catch (error) { next(error); }
  });

  router.get('/payment-settings/vodafone-cash', ...readGuard, async (_req, res, next) => {
    try { res.set('Cache-Control', 'no-store').json(ok(await getVodafoneCash(deps.prisma, deps.config.paymentChannels))); } catch (error) { next(error); }
  });
  router.put('/payment-settings/vodafone-cash', ...writeGuard, async (req, res, next) => {
    try {
      const saved = await saveVodafoneCash(deps.prisma, req.body);
      res.set('Cache-Control', 'no-store').json(ok({ enabled: saved.enabled, accountLabel: saved.accountLabel, instructionsAr: saved.instructionsAr, instructionsEn: saved.instructionsEn, version: saved.version }));
    } catch (error) { next(error); }
  });

  router.get('/recharge-requests', ...readGuard, async (req, res, next) => {
    try {
      const status = req.query['status'];
      const channel = req.query['channel'];
      const paging = parseListPage(req.query);
      if (paging) {
        res.set('Cache-Control', 'no-store').json(ok(await reviewRequestPage(deps.prisma, {
          ...(status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED' ? { status } : {}),
          ...(typeof channel === 'string' ? { channel } : {}),
        }, paging))); return;
      }
      res.json(
        ok({
          requests: await listRequestsForReview(deps.prisma, {
            ...(status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED'
              ? { status }
              : {}),
            ...(typeof channel === 'string' ? { channel } : {}),
          }),
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/recharge-requests/:id/review',
    ...writeGuard,
    rateLimit('wallet-recharge-review', { windowSec: 60, max: 30 }),
    async (req, res, next) => {
      try {
        const { userId: reviewerId } = authOf(req);
        const view = await reviewRecharge(
          deps.prisma,
          reviewerId,
          req.params['id'] as string,
          req.body as RechargeReviewInput,
        );
        res.json(ok(view));
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/recharge-requests/:id/proof', ...readGuard, async (req, res, next) => {
    try {
      const proof = await getProofBytes(deps.prisma, req.params['id'] as string);
      const safe = (req.params['id'] as string).replace(/[^a-zA-Z0-9-]/g, '');
      res.setHeader('Content-Type', proof.mime);
      res.setHeader('Content-Length', String(proof.size));
      res.setHeader('Content-Disposition', `inline; filename="proof-${safe}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(proof.bytes);
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/maintenance/proof-cleanup',
    ...writeGuard,
    rateLimit('wallet-proof-cleanup', { windowSec: 300, max: 5 }),
    async (req, res, next) => {
      try {
        const { userId: reviewerId } = authOf(req);
        res.json(ok(await cleanupExpiredProofs(deps.prisma, 100, reviewerId)));
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
