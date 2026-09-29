import type { Server } from 'node:http';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { loadConfig, redactUrlForLog } from './config.js';
import { getLogger, createLogger } from './logger.js';
import { createPostgresPool, closePostgres } from './infra/postgres.js';
import { createRedisClient, closeRedis } from './infra/redis.js';
import { getPrisma, closePrisma } from './infra/prisma.js';
import { describeDrmConnection } from './infra/drm.js';
import { createDrmClient } from './modules/catalog/drmClient.js';
import { startDeletionReconciler } from './modules/catalog/deletion/reconciler.js';
import { startProofCleanupScheduler } from './modules/wallet/cleanup/scheduler.js';

dotenv.config();

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  createLogger(config.logLevel);
  const logger = getLogger();

  // Pool/Redis clients connect lazily; readiness probes report real state.
  // Compose startup ordering (healthchecks + depends_on) still applies.
  const postgresPool = createPostgresPool(config.databaseUrl);
  const redisClient = createRedisClient(config.redisUrl);
  const prisma = getPrisma();

  const app = createApp({ config, postgresPool, redisClient, prisma });
  // Durable deletion resume: pending operations survive restarts via PostgreSQL.
  // Cross-replica ownership uses a token-checked Redis lease per operation.
  const reconciler = startDeletionReconciler(prisma, config, createDrmClient, redisClient, 15000);
  const proofCleanup = startProofCleanupScheduler(prisma);
  const server: Server = await new Promise((resolve, reject) => {
    const listener = app.listen(config.port, () => resolve(listener));
    listener.on('error', reject);
  });

  logger.info(
    {
      port: config.port,
      nodeEnv: config.nodeEnv,
      version: config.serviceVersion,
      postgres: redactUrlForLog(config.databaseUrl),
      redis: redactUrlForLog(config.redisUrl),
      drm: describeDrmConnection(process.env),
    },
    'server listening',
  );

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutdown signal received');
    const force = setTimeout(() => {
      logger.error('graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, 10_000);
    force.unref?.();

    server.close((err) => {
      if (err) logger.error({ err }, 'http server close error');
      void (async () => {
        try {
          reconciler.stop();
          proofCleanup.stop();
          await Promise.all([closePostgres(postgresPool), closeRedis(redisClient), closePrisma()]);
          logger.info('connections closed; exiting');
          clearTimeout(force);
          process.exit(0);
        } catch (shutdownErr) {
          logger.error({ err: shutdownErr }, 'shutdown cleanup failed');
          clearTimeout(force);
          process.exit(1);
        }
      })();
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal startup error', err);
  process.exit(1);
});
