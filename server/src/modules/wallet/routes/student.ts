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
import { getOwnRequest, listOwnRequests } from '../recharge/queries.js';
import { submitRecharge } from '../recharge/service.js';
import type { PurchaseInput, RechargeSubmitInput } from '../types.js';
import { listPackagePurchases, packageReview, purchasePackage } from '../purchase/packages.js';

export interface WalletStudentDeps {
  prisma: PrismaClient;
  config: ServerConfig;
}

const authed = [requireAuth];
const authedWrite = [requireOrigin, requireAuth, requireSessionCsrf];

/** Student wallet/recharge/purchase router. Balances/prices are never trusted from the client. */
export function createWalletStudentRouter(deps: WalletStudentDeps) {
  const router = Router();
  router.get('/packages/:id/review', ...authed, async (req, res, next) => {
    try {
      res.json(ok(await packageReview(deps.prisma, authOf(req).userId, req.params.id as string)));
    } catch (err) {
      next(err);
    }
  });
  router.get('/package-purchases', ...authed, async (req, res, next) => {
    try {
      res.json(ok({ purchases: await listPackagePurchases(deps.prisma, authOf(req).userId) }));
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

  router.get('/instructions', ...authed, (req, res, next) => {
    try {
      if (deps.config.paymentChannels.length === 0) {
        throw new ApiError(503, 'PAYMENT_UNCONFIGURED', 'Manual funding is not configured.');
      }
      res.json(ok({ channels: deps.config.paymentChannels }));
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
          deps.config.paymentChannels,
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
      res.json(ok({ requests: await listOwnRequests(deps.prisma, userId) }));
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
      res.json(ok({ purchases: await listMyPurchases(deps.prisma, userId) }));
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
