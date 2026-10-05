import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import type { PrismaClient } from '@prisma/client';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import { getLogger, serializeSafeError, serializeSafeRequest } from './logger.js';
import type { ServerConfig } from './config.js';
import { checkPostgres } from './infra/postgres.js';
import { checkRedis } from './infra/redis.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { createHealthRouter } from './routes/health.js';
import { createIdentityModule } from './modules/identity/index.js';
import { createCatalogModule } from './modules/catalog/index.js';
import { createWalletModule } from './modules/wallet/index.js';
import { createLearningModule } from './modules/learning/index.js';
import type { DrmClient } from './modules/catalog/drmClient.js';
import { createDrmClient } from './modules/catalog/drmClient.js';
import type { Clock } from './modules/identity/tokens.js';
import { createAssertionJwks } from './modules/learning/playback/assertion.js';
import { createNotificationRouter } from './modules/notifications/index.js';
import { assessmentRouters } from './modules/assessments/routes.js';
import { createSupportRouter } from './modules/support/routes.js';

export interface AppDependencies {
  config: ServerConfig;
  postgresPool: Pool;
  redisClient: Redis;
  prisma: PrismaClient;
}

export interface AppTunables {
  /** Override dependency checks (used by unit tests to avoid real I/O). */
  checkPostgresFn?: () => ReturnType<typeof checkPostgres>;
  checkRedisFn?: () => ReturnType<typeof checkRedis>;
  /** Override the request logger (used by unit tests to capture log output). */
  logger?: Logger;
  /** Override the clock (used by tests to simulate token/session expiry). */
  clock?: Clock;
  /** Override the DRM client factory (contract tests inject a fixture). */
  drmFactory?: (cfg: ServerConfig) => DrmClient | null;
}

/**
 * Application factory (no listening sockets here; see index.ts).
 * Identity (M2), catalog/administration (M3), wallet/purchases (M4) and
 * protected learning/playback (M5) are internal modules of this single Express
 * application — never separate services.
 */
export function createApp(deps: AppDependencies, tunables: AppTunables = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger: tunables.logger ?? getLogger(),
      serializers: { req: serializeSafeRequest, err: serializeSafeError },
      genReqId: (req) => (req as unknown as { requestId?: string }).requestId ?? 'unknown',
      customLogLevel: (_req, res, err) => {
        if (err !== undefined || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );
  app.use(helmet());
  // Cookie-authenticated and credential-bearing API responses must not persist
  // in browser/shared caches. Public-only discovery can explicitly override.
  app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use(cors({ origin: false }));
  // Proof submission is the only JSON route allowed above the global 256 KiB
  // ceiling. Select the parser before any body has been consumed; mounting a
  // second parser inside the wallet router would be too late.
  const standardJson = express.json({ limit: '256kb' });
  const proofJson = express.json({ limit: '8mb' });
  app.use((req, res, next) => {
    const parser =
      req.method === 'POST' && req.path === '/wallet/recharge-requests' ? proofJson : standardJson;
    parser(req, res, next);
  });

  const startedAt = Date.now();

  // Identity guards read shared context (prisma/redis/auth) from app settings.
  const identity = createIdentityModule({
    prisma: deps.prisma,
    redis: deps.redisClient,
    auth: {
      secret: deps.config.jwtSecret,
      issuer: deps.config.authIssuer,
      audience: deps.config.authAudience,
      allowedOrigins: deps.config.allowedOrigins,
      cookieSecure: deps.config.cookieSecure,
      argon2: deps.config.argon2,
      studentDataKeys: deps.config.studentDataKeys,
    },
    ...(tunables.clock ? { clock: tunables.clock } : {}),
  });
  app.set('identity', {
    prisma: deps.prisma,
    redis: deps.redisClient,
    auth: {
      secret: deps.config.jwtSecret,
      issuer: deps.config.authIssuer,
      audience: deps.config.authAudience,
      allowedOrigins: deps.config.allowedOrigins,
    },
    ...(tunables.clock ? { clock: tunables.clock } : {}),
  });
  app.use('/auth', identity.authRouter);
  app.use('/admin', identity.adminRouter);
  app.use('/support', createSupportRouter(deps.prisma));

  // Catalog/administration (M3) is an internal module of the same app.
  const catalog = createCatalogModule({
    prisma: deps.prisma,
    redis: deps.redisClient,
    config: deps.config,
    ...(tunables.clock ? { clock: tunables.clock } : {}),
    ...(tunables.drmFactory
      ? { drmFactory: tunables.drmFactory }
      : { drmFactory: createDrmClient }),
  });
  app.set('catalog', {
    prisma: deps.prisma,
    redis: deps.redisClient,
    config: deps.config,
    drmFactory: tunables.drmFactory ?? createDrmClient,
  });
  // Public discovery (no auth) — only published offers.
  app.use('/catalog', catalog.publicRouter);
  // Admin hierarchy mounts under /admin (guards inside the router).
  app.use('/admin', catalog.adminRouter);

  // Wallet, manual recharge, and purchase (M4) — same app, own module.
  const wallet = createWalletModule({ prisma: deps.prisma, config: deps.config });
  app.set('wallet', { prisma: deps.prisma, config: deps.config });
  // Authenticated student endpoints (guards inside the router).
  app.use('/wallet', wallet.studentRouter);
  // Admin review endpoints (guards inside the router).
  app.use('/admin', wallet.adminRouter);

  // Protected learning, playback, progress and expiry (M5) — same app.
  const learningDeps = {
    prisma: deps.prisma,
    redis: deps.redisClient,
    config: deps.config,
    drmFactory: tunables.drmFactory ?? createDrmClient,
    ...(tunables.clock ? { clock: tunables.clock } : {}),
  };
  const learning = createLearningModule(learningDeps);
  app.set('learning', learning.context);
  app.use('/learning', learning.router);
  app.use('/admin', learning.adminRouter);

  const assessments = assessmentRouters(deps.prisma, tunables.clock ?? Date.now);
  app.use('/assessments', assessments.studentRouter);
  app.use('/admin/assessments', assessments.adminRouter);

  // M6 recipient-only inbox APIs, inside the same modular backend.
  app.use(
    '/notifications',
    createNotificationRouter({
      prisma: deps.prisma,
      ...(tunables.clock ? { clock: tunables.clock } : {}),
    }),
  );

  // Public signing metadata for the independently deployed DRM verifier.
  // Only the RSA public key is exposed; HS256 exists solely for labeled test fixtures.
  app.get('/.well-known/jwks.json', (_req, res) => {
    const jwks = createAssertionJwks(learning.context.playback.assertion);
    if (jwks === null) {
      res.status(404).json({ error: { code: 'not_found', message: 'JWKS is not configured.' } });
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json(jwks);
  });

  app.use(
    '/health',
    createHealthRouter({
      serviceName: deps.config.serviceName,
      serviceVersion: deps.config.serviceVersion,
      readyTimeoutMs: deps.config.readyTimeoutMs,
      checkPostgres: tunables.checkPostgresFn ?? (() => checkPostgres(deps.postgresPool)),
      checkRedis: tunables.checkRedisFn ?? (() => checkRedis(deps.redisClient)),
      startedAt,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
