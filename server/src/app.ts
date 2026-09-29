import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import type { PrismaClient } from '@prisma/client';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import { getLogger } from './logger.js';
import type { ServerConfig } from './config.js';
import { checkPostgres } from './infra/postgres.js';
import { checkRedis } from './infra/redis.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { createHealthRouter } from './routes/health.js';
import { createIdentityModule } from './modules/identity/index.js';
import { createCatalogModule } from './modules/catalog/index.js';
import type { DrmClient } from './modules/catalog/drmClient.js';
import { createDrmClient } from './modules/catalog/drmClient.js';
import type { Clock } from './modules/identity/tokens.js';

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
 * Identity (M2) and catalog/administration (M3) are internal modules of this
 * single Express application — never separate services. Wallet, purchases
 * and learning arrive as further internal modules in their own milestones.
 */
export function createApp(deps: AppDependencies, tunables: AppTunables = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger: tunables.logger ?? getLogger(),
      genReqId: (req) => (req as unknown as { requestId?: string }).requestId ?? 'unknown',
      customLogLevel: (_req, res, err) => {
        if (err !== undefined || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: false }));
  app.use(express.json({ limit: '256kb' }));

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

  // Catalog/administration (M3) is an internal module of the same app.
  const catalog = createCatalogModule({
    prisma: deps.prisma,
    redis: deps.redisClient,
    config: deps.config,
    ...(tunables.clock ? { clock: tunables.clock } : {}),
    ...(tunables.drmFactory ? { drmFactory: tunables.drmFactory } : { drmFactory: createDrmClient }),
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
