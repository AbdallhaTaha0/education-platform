import type { Server as HttpServer } from 'node:http';
import type { PrismaClient } from '@prisma/client';
import type { PlatformCache } from '../../infra/cache.js';
import type { Clock } from '../identity/tokens.js';
import type { SignalPublisher } from './delivery.js';

export interface RealtimeIdentityContext {
  prisma: PrismaClient;
  redis: PlatformCache;
  auth: {
    secret: string;
    issuer: string;
    audience: string;
    allowedOrigins: string[];
  };
  clock?: Clock;
}

export interface NotificationRealtimeHandle {
  publish: SignalPublisher;
  stop: () => Promise<void>;
}

/**
 * Local Node compatibility handle. Production Cloudflare Workers use
 * `UserRealtimeDurableObject` (`realtime-do.ts`) with native WebSockets.
 */
export async function attachNotificationRealtime(
  _server: HttpServer,
  _identity: RealtimeIdentityContext,
): Promise<NotificationRealtimeHandle> {
  return {
    publish: async (_userId: string, _revision: string) => {
      // Delivered via UserRealtimeDurableObject on Cloudflare Workers; HTTP polling fallback locally.
    },
    stop: async () => undefined,
  };
}
