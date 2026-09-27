import Redis from 'ioredis';
import { getLogger } from '../logger.js';
import type { DependencyCheck } from './checks.js';

export function createRedisClient(redisUrl: string): Redis {
  const client = new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1_000)),
  });
  client.on('error', (err) => {
    getLogger().warn({ err }, 'redis client error');
  });
  return client;
}

/** PING against platform Redis, connecting on demand (lazy). */
export async function checkRedis(client: Redis): Promise<DependencyCheck> {
  const started = Date.now();
  try {
    if (client.status !== 'ready') {
      await client.connect();
    }
    const pong = await client.ping();
    if (pong !== 'PONG') throw new Error(`unexpected PING reply: ${pong}`);
    return { status: 'up', latencyMs: Date.now() - started };
  } catch (err) {
    getLogger().warn({ err }, 'redis readiness check failed');
    return { status: 'down', latencyMs: Date.now() - started };
  }
}

export async function closeRedis(client: Redis): Promise<void> {
  try {
    client.disconnect();
  } catch (err) {
    getLogger().warn({ err }, 'redis disconnect failed');
  }
}
