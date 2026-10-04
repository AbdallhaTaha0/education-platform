/**
 * Learning module factory (M5 + course-learning enhancements) and the periodic expiry reconciler.
 *
 * Learning is an internal module of the same Express application, never a new
 * service. Mounted under /learning; the reconciler is a timer in the existing
 * process, using the platform's existing Redis convention.
 */
import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { ServerConfig } from '../../config.js';
import type { DrmClient } from '../catalog/drmClient.js';
import { getLogger } from '../../logger.js';
import { createLearningRouter } from './routes/index.js';
import { createLearningAdminRouter } from './routes/admin.js';
import { reconcileExpiredSessions } from './expiry/reconciler.js';
import type { LearningRouteContext } from './types.js';

export const EXPIRY_RECONCILE_INTERVAL_MS = 30_000;

export interface LearningModuleDeps {
  prisma: PrismaClient;
  redis: Redis;
  config: ServerConfig;
  drmFactory: (cfg: ServerConfig) => DrmClient | null;
  clock?: () => number;
}

export function createLearningModule(deps: LearningModuleDeps): {
  router: Router;
  adminRouter: Router;
  context: LearningRouteContext;
} {
  const now = deps.clock ?? (() => Date.now());
  const drm = deps.drmFactory(deps.config);
  const context: LearningRouteContext = {
    prisma: deps.prisma,
    drm,
    playback: {
      prisma: deps.prisma,
      drm: drm as NonNullable<typeof drm>,
      assertion: {
        algorithm: deps.config.drmAssertionAlgorithm ?? 'HS256',
        signingKey: deps.config.drmAssertionSigningKey ?? '',
        ...(deps.config.drmAssertionKeyId ? { keyId: deps.config.drmAssertionKeyId } : {}),
        issuer: deps.config.drmAssertionIssuer ?? 'unconfigured',
        audience: deps.config.drmAssertionAudience ?? 'unconfigured',
        maxLifetimeSec: deps.config.drmAssertionMaxLifetimeSec,
        applicationId: deps.config.drmClientId ?? 'unconfigured',
      },
      drmPublicBaseUrl: deps.config.drmPublicBaseUrl,
    },
    now,
  };
  return {
    router: createLearningRouter(context),
    adminRouter: createLearningAdminRouter(context),
    context,
  };
}

/**
 * Periodic expiry reconciliation. Returns a stop function.
 * Runs in the existing process; every pass is replica-safe via the Redis lease.
 */
export function startExpiryReconciler(deps: LearningModuleDeps): () => void {
  const now = deps.clock ?? (() => Date.now());
  const timer = setInterval(() => {
    void (async () => {
      try {
        const result = await reconcileExpiredSessions(
          deps.prisma,
          deps.redis,
          deps.drmFactory(deps.config),
          now(),
        );
        if (result.queued > 0 || result.terminated > 0 || result.failed > 0) {
          getLogger().info(
            {
              module: 'learning-expiry',
              scanned: result.scanned,
              pages: result.pages,
              pageBudgetExhausted: result.pageBudgetExhausted,
              queued: result.queued,
              terminated: result.terminated,
              alreadyEnded: result.alreadyEnded,
              failed: result.failed,
            },
            'expiry reconciliation pass completed',
          );
        }
      } catch (err) {
        getLogger().warn(
          { module: 'learning-expiry', code: (err as { code?: string }).code ?? 'unknown' },
          'expiry reconciliation pass failed',
        );
      }
    })();
  }, EXPIRY_RECONCILE_INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
