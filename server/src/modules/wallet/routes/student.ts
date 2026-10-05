import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { ServerConfig } from '../../../config.js';
import { ApiError, ok } from '../../identity/errors.js';
import {
  rateLimit,
  requireAuth,
  requireOrigin,
  requireSessionCsrf,
} from '../../identity/middleware.js';
import { getOrCreateWallet, reconciledBalance } from '../ledger.js';
import { authOf } from './auth.js';
import { listMyPurchases, listMySubscriptions, purchaseCourse } from '../purchase/service.js';
import { getOwnRequest, listOwnRequests, ownRequestPage } from '../recharge/queries.js';
import { parseListPage, pageInfo } from '../../../list-pagination.js';
import { submitRecharge } from '../recharge/service.js';
import type { PurchaseInput, RechargeSubmitInput } from '../types.js';
import { listPackagePurchases, packageReview, purchasePackage } from '../purchase/packages.js';
import { paymentChannels } from '../payment-settings.js';
import { readQr } from '../payment-qr.js';

export interface WalletStudentDeps {
  prisma: PrismaClient;
  config: ServerConfig;
}

const authed = [requireAuth];
const authedWrite = [requireOrigin, requireAuth, requireSessionCsrf];

/** Student wallet/recharge/purchase router. Balances/prices are never trusted from the client. */
export function createWalletStudentRouter(deps: WalletStudentDeps) {
  const router = Router();
  router.get('/payment-settings/instapay/qr', ...authed, async (_req, res, next) => {
    try { const image = await readQr(deps.prisma, false); res.set({ 'Content-Type': image.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" }).send(image.bytes); } catch (error) { next(error); }
  });
  router.get('/packages/:id/review', ...authed, async (req, res, next) => {
    try {
      res.json(ok(await packageReview(deps.prisma, authOf(req).userId, req.params.id as string)));
    } catch (err) {
      next(err);
    }
  });
  router.get('/package-purchases', ...authed, async (req, res, next) => {
    try {
      const userId = authOf(req).userId, paging = parseListPage(req.query);
      const pagination = paging ? pageInfo(paging, await deps.prisma.packagePurchase.count({ where: { studentId: userId } })) : undefined;
      res.set('Cache-Control', 'no-store').json(ok({ purchases: await listPackagePurchases(deps.prisma, userId, pagination?.pageSize, pagination ? (pagination.page - 1) * pagination.pageSize : 0), ...(pagination ? { pagination } : {}) }));
    } catch (err) {
      next(err);
    }
  });
  router.post(
    '/package-purchases',
    ...authedWrite,
    rateLimit('wallet-package-purchase', { windowSec: 60, max: 20 }),
    async (req, res, next) => {
      try {
        res.status(201).json(ok(await purchasePackage(deps.prisma, authOf(req).userId, req.body)));
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/', ...authed, async (req, res, next) => {
    try {
      const { userId } = authOf(req);
      const wallet = await deps.prisma.$transaction(async (tx) => getOrCreateWallet(tx, userId));
      res.json(
        ok({ balancePiastres: wallet.balancePiastres, updatedAt: wallet.updatedAt.toISOString() }),
      );
    } catch (err) {
      next(err);
    }
  });

  router.get('/reconcile', ...authed, async (req, res, next) => {
    try {
      const { userId } = authOf(req);
      const result = await deps.prisma.$transaction(async (tx) => {
        const wallet = await getOrCreateWallet(tx, userId);
        return { cached: wallet.balancePiastres, ledger: await reconciledBalance(tx, wallet.id) };
      });
      res.json(ok({ ...result, matches: result.cached === result.ledger }));
    } catch (err) {
      next(err);
    }
  });

  router.get('/instructions', ...authed, async (req, res, next) => {
    try {
      const channels = await paymentChannels(deps.prisma, deps.config.paymentChannels);
      if (channels.length === 0) {
        throw new ApiError(503, 'PAYMENT_UNCONFIGURED', 'Manual funding is not configured.');
      }
      res.set('Cache-Control', 'no-store').json(ok({ channels }));
    } catch (err) {
      next(err);
    }
  });

  // Proof uploads ride as base64 inside JSON (bounded per-route body limit;
  // the global 256kb limit stays intact for every other route).
  router.post(
    '/recharge-requests',
    ...authedWrite,
    rateLimit('wallet-recharge-submit', { windowSec: 60, max: 10 }),
    async (req, res, next) => {
      try {
        const { userId } = authOf(req);
        const view = await submitRecharge(
          deps.prisma,
          await paymentChannels(deps.prisma, deps.config.paymentChannels),
          userId,
          req.body as RechargeSubmitInput,
        );
        res.status(201).json(ok(view));
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/recharge-requests', ...authed, async (req, res, next) => {
    try {
      const { userId } = authOf(req);
      const paging = parseListPage(req.query);
      res.set('Cache-Control', 'no-store').json(ok(paging ? await ownRequestPage(deps.prisma, userId, paging) : { requests: await listOwnRequests(deps.prisma, userId) }));
    } catch (err) {
      next(err);
    }
  });

  router.get('/recharge-requests/:id', ...authed, async (req, res, next) => {
    try {
      const { userId } = authOf(req);
      res.json(ok(await getOwnRequest(deps.prisma, userId, req.params['id'] as string)));
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/purchases',
    ...authedWrite,
    rateLimit('wallet-purchase', { windowSec: 60, max: 20 }),
    async (req, res, next) => {
      try {
        const { userId } = authOf(req);
        const view = await purchaseCourse(deps.prisma, userId, req.body as PurchaseInput);
        res.status(201).json(ok(view));
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/purchases', ...authed, async (req, res, next) => {
    try {
      const { userId } = authOf(req);
      const paging = parseListPage(req.query);
      const pagination = paging ? pageInfo(paging, await deps.prisma.purchase.count({ where: { studentId: userId } })) : undefined;
      res.set('Cache-Control', 'no-store').json(ok({ purchases: await listMyPurchases(deps.prisma, userId, pagination?.pageSize, pagination ? (pagination.page - 1) * pagination.pageSize : 0), ...(pagination ? { pagination } : {}) }));
    } catch (err) {
      next(err);
    }
  });

  router.get('/subscriptions', ...authed, async (req, res, next) => {
    try {
      const { userId } = authOf(req);
      res.json(ok({ subscriptions: await listMySubscriptions(deps.prisma, userId) }));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
