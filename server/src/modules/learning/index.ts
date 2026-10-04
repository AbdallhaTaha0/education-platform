/**
 * Learning module factory (M5 + course-learning enhancements) and the periodic expiry reconciler.
 *
 * Learning is an internal module of the same Express application, never a new
 * service. Mounted under /learning; the reconciler is a timer in the existing
 * process, using the platform's existing Redis convention.
 */
import { createAdminMaterialsRouter } from './materials/routes.js';
import { reconcileMaterialObjects } from './materials/service.js';
import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { ServerConfig } from '../../config.js';
import type { DrmClient } from '../catalog/drmClient.js';
import type { StorageClient } from '../../infra/storage.js';
import { getLogger } from '../../logger.js';
import { createLearningRouter } from './routes/index.js';
import { createLearningAdminRouter } from './routes/admin.js';
import { reconcileExpiredSessions } from './expiry/reconciler.js';
import { createStorageClient } from '../../infra/storage.js';
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
  const storage = createStorageClient(deps.config);
  const context: LearningRouteContext = {
    prisma: deps.prisma,
    drm,
    storage,
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
    adminRouter: Router().use(createLearningAdminRouter(context)).use(createAdminMaterialsRouter(context)),
    context,
  };
}

/**
 * Periodic expiry reconciliation. Returns a stop function.
 * Runs in the existing process; every pass is replica-safe via the Redis lease.
 */
export function startExpiryReconciler(deps: LearningModuleDeps): () => void {
  const now = deps.clock ?? (() => Date.now());
  const storage = createStorageClient(deps.config);
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
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
      } finally { running = false; }
    })();
  }, EXPIRY_RECONCILE_INTERVAL_MS);
  let cleaning = false;
  const materialTimer = storage ? setInterval(() => {
    if (cleaning) return;
    cleaning = true;
    void reconcileMaterialObjects({ prisma: deps.prisma, storage, now }).catch(() => {
      getLogger().warn({ module: 'material-cleanup' }, 'owned-object cleanup remains pending');
    }).finally(() => { cleaning = false; });
  }, EXPIRY_RECONCILE_INTERVAL_MS) : null;
  materialTimer?.unref?.();
  timer.unref?.();
  return () => { clearInterval(timer); if (materialTimer) clearInterval(materialTimer); };
}
