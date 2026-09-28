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

/** In-flight connection attempts, one per client. Concurrent callers share
 * the same promise, so a cold client connects exactly once and every waiter
 * resolves together — or receives the same genuine connection failure. */
const pendingConnections = new WeakMap<Redis, Promise<void>>();

function isReady(client: Redis): boolean {
  // Fresh read every time; avoids narrowing the status union across closures.
  return (client.status as string) === 'ready';
}

function waitForSettledState(client: Redis): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isReady(client)) {
      resolve();
      return;
    }
    const cleanup = (): void => {
      client.off('ready', onReady);
      client.off('end', onEnd);
      client.off('close', onEnd);
    };
    const onReady = (): void => {
      cleanup();
      resolve();
    };
    const onEnd = (): void => {
      cleanup();
      reject(new Error('redis connection ended before becoming ready'));
    };
    // Settle only on terminal states: intermediate 'error' events belong to
    // the retry loop (an 'error' listener already exists on the client).
    client.once('ready', onReady);
    client.once('end', onEnd);
    client.once('close', onEnd);
    if (isReady(client)) {
      cleanup();
      resolve();
    }
  });
}

async function establish(client: Redis): Promise<void> {
  const status = client.status;
  if (status === 'ready') return;
  if (status === 'wait' || status === 'end' || status === 'close') {
    // 'wait': lazy client, never attempted — initiate. 'end'/'close':
    // terminal state — attempt a fresh connection.
    await client.connect();
    return;
  }
  // 'connect', 'connecting', 'reconnecting': an attempt is already running
  // (possibly started outside this helper) — observe it, never duplicate it.
  await waitForSettledState(client);
}

/** Connect on demand (the client is lazy). Concurrency-safe: any number of
 * simultaneous callers share one underlying attempt. A genuine failure
 * (e.g. refused dependency) rejects every waiter instead of hanging. */
export async function ensureRedis(client: Redis): Promise<void> {
  if (isReady(client)) return;
  let attempt = pendingConnections.get(client);
  if (!attempt) {
    attempt = establish(client).finally(() => {
      if (pendingConnections.get(client) === attempt) {
        pendingConnections.delete(client);
      }
    });
    pendingConnections.set(client, attempt);
  }
  await attempt;
}

/** PING against platform Redis, connecting on demand (lazy). */
export async function checkRedis(client: Redis): Promise<DependencyCheck> {
  const started = Date.now();
  try {
    await ensureRedis(client);
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
