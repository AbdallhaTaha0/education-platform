import { getLogger } from '../logger.js';
import type { DependencyCheck } from './checks.js';
import { InMemoryCache, type PlatformCache } from './cache.js';

export type { PlatformCache };
export { InMemoryCache, CloudflareCache } from './cache.js';

export function createRedisClient(_redisUrl?: string): PlatformCache {
  return new InMemoryCache();
}

export async function ensureRedis(_client: PlatformCache): Promise<void> {
  // No persistent TCP connection required for Cloudflare KV / InMemoryCache.
}

export async function checkRedis(client: PlatformCache): Promise<DependencyCheck> {
  const started = Date.now();
  try {
    const pong = await client.ping();
    if (pong !== 'PONG') throw new Error(`unexpected PING reply: ${pong}`);
    return { status: 'up', latencyMs: Date.now() - started };
  } catch (err) {
    getLogger().warn({ err }, 'cache readiness check failed');
    return { status: 'down', latencyMs: Date.now() - started };
  }
}

export async function closeRedis(client: PlatformCache): Promise<void> {
  try {
    client.disconnect();
  } catch (err) {
    getLogger().warn({ err }, 'cache disconnect failed');
  }
}
