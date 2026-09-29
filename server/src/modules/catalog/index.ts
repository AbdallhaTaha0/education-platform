import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { ServerConfig } from '../../config.js';
import type { Clock } from '../identity/tokens.js';
import type { DrmClient } from './drmClient.js';
import { createDrmClient } from './drmClient.js';
import { createCatalogAdminRouter, createCatalogPublicRouter } from './routes/index.js';

export interface CatalogModuleOptions {
  prisma: PrismaClient;
  redis: Redis;
  config: ServerConfig;
  clock?: Clock;
  drmFactory?: (cfg: ServerConfig) => DrmClient | null;
}

export function createCatalogModule(options: CatalogModuleOptions) {
  const drmFactory = options.drmFactory ?? createDrmClient;
  const context = {
    prisma: options.prisma,
    redis: options.redis,
    config: options.config,
    drmFactory,
    ...(options.clock ? { clock: options.clock } : {}),
  };
  return {
    publicRouter: createCatalogPublicRouter(context),
    adminRouter: createCatalogAdminRouter(context),
    context,
  };
}

export type CatalogContext = ReturnType<typeof createCatalogModule>['context'];
