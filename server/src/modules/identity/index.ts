import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { Clock } from './tokens.js';
import type { AuthConfig } from './service.js';
import { createAdminRouter, createAuthRouter } from './routes.js';

export interface IdentityModuleOptions {
  prisma: PrismaClient;
  redis: Redis;
  auth: AuthConfig;
  clock?: Clock;
}

export interface IdentityModule {
  authRouter: ReturnType<typeof createAuthRouter>;
  adminRouter: ReturnType<typeof createAdminRouter>;
  context: { prisma: PrismaClient; redis: Redis; auth: AuthConfig; clock?: Clock };
}

/**
 * Identity stays an internal module of the single Express application —
 * never a separate service. Mount `authRouter` at `/auth` and
 * `adminRouter` at `/admin`; the Nginx `/api` prefix is stripped before
 * traffic reaches the backend, so it is not repeated here.
 */
export function createIdentityModule(options: IdentityModuleOptions): IdentityModule {
  const context = {
    prisma: options.prisma,
    redis: options.redis,
    auth: options.auth,
    ...(options.clock ? { clock: options.clock } : {}),
  };
  return {
    authRouter: createAuthRouter(context),
    adminRouter: createAdminRouter(context),
    context,
  };
}
