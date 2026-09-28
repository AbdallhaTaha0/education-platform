import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
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

export interface AppDependencies {
  config: ServerConfig;
  postgresPool: Pool;
  redisClient: Redis;
}

export interface AppTunables {
  /** Override dependency checks (used by unit tests to avoid real I/O). */
  checkPostgresFn?: () => ReturnType<typeof checkPostgres>;
  checkRedisFn?: () => ReturnType<typeof checkRedis>;
  /** Override the request logger (used by unit tests to capture log output). */
  logger?: Logger;
}

/**
 * Application factory (no listening sockets here; see index.ts).
 * Future business areas (identity, catalog, wallet, purchases, learning,
 * administration, DRM adapter) will mount as internal modules under
 * src/modules/* in their own milestones — not as separate services.
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
