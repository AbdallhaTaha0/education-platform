import type Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { ensureRedis } from '../../../infra/redis.js';

const LEASE_TTL_MS = 30_000;
const LEASE_PREFIX = 'catalog:deletion:lease:';

function leaseKey(operationId: string): string {
  return `${LEASE_PREFIX}${operationId}`;
}

const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
const RENEW_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end`;
const OWNER_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return 1 else return 0 end`;

export interface DeletionLease {
  operationId: string;
  token: string;
  ttlMs: number;
}

/** Acquire the per-operation lease. Null when another replica (or a stale local) owns it, or Redis is down. */
export async function acquireDeletionLease(redis: Redis, operationId: string, ttlMs = LEASE_TTL_MS): Promise<DeletionLease | null> {
  try {
    await ensureRedis(redis);
    const token = randomUUID();
    const result = await redis.set(leaseKey(operationId), token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? { operationId, token, ttlMs } : null;
  } catch {
    return null;
  }
}

/** Token-checked renewal. False when a newer owner holds the lease (or Redis failed) — the caller must stop work. */
export async function renewDeletionLease(redis: Redis, lease: DeletionLease): Promise<boolean> {
  try {
    await ensureRedis(redis);
    const result = (await redis.eval(RENEW_SCRIPT, 1, leaseKey(lease.operationId), lease.token, String(lease.ttlMs))) as number;
    return result === 1;
  } catch {
    return false;
  }
}

/** Fresh ownership probe. False on loss or Redis failure (fail closed). */
export async function isDeletionLeaseOwner(redis: Redis, lease: DeletionLease): Promise<boolean> {
  try {
    await ensureRedis(redis);
    const result = (await redis.eval(OWNER_SCRIPT, 1, leaseKey(lease.operationId), lease.token)) as number;
    return result === 1;
  } catch {
    return false;
  }
}

/** Token-checked release. A stale token can never release a newer owner's lease. */
export async function releaseDeletionLease(redis: Redis, lease: DeletionLease): Promise<void> {
  try {
    await ensureRedis(redis);
    await redis.eval(RELEASE_SCRIPT, 1, leaseKey(lease.operationId), lease.token);
  } catch {
    // Lease expires on its own; release failure never fails the operation.
  }
}

export interface RenewingScope {
  lease: DeletionLease;
  /** Set when renewal fails or ownership is lost — work must stop at the next checkpoint. */
  readonly lost: boolean;
}

/**
 * Run `work` as the lease owner with a heartbeat that renews every third of
 * the TTL. If renewal ever fails (newer owner, expiry race, Redis failure),
 * `scope.lost` flips and the heartbeat stops; work observes it at its next
 * checkpoint and aborts, leaving durable state retryable.
 */
export async function withRenewingLease<T>(
  redis: Redis,
  operationId: string,
  ttlMs: number,
  work: (scope: RenewingScope) => Promise<T>,
): Promise<{ owned: true; value: T } | { owned: false }> {
  const lease = await acquireDeletionLease(redis, operationId, ttlMs);
  if (lease === null) return { owned: false };
  let lost = false;
  const scope: RenewingScope = {
    lease,
    get lost() {
      return lost;
    },
  };
  const intervalMs = Math.max(50, Math.floor(ttlMs / 3));
  const timer = setInterval(() => {
    void renewDeletionLease(redis, lease)
      .then((ok) => {
        if (!ok) {
          lost = true;
          clearInterval(timer);
        }
      })
      .catch(() => {
        lost = true;
        clearInterval(timer);
      });
  }, intervalMs);
  try {
    const value = await work(scope);
    return { owned: true, value };
  } finally {
    clearInterval(timer);
    await releaseDeletionLease(redis, lease);
  }
}

/** Token-checked Redis lease. Only the owner performs external I/O. */
export async function acquireLease(redis: Redis, operationId: string, ttlMs = LEASE_TTL_MS): Promise<string | null> {
  const lease = await acquireDeletionLease(redis, operationId, ttlMs);
  return lease === null ? null : lease.token;
}

export async function releaseLease(redis: Redis, operationId: string, token: string): Promise<void> {
  await releaseDeletionLease(redis, { operationId, token, ttlMs: LEASE_TTL_MS });
}

/** Run `fn` only as the lease owner; returns null when another replica owns it. */
export async function withDeletionLease<T>(
  redis: Redis,
  operationId: string,
  fn: () => Promise<T>,
  ttlMs = LEASE_TTL_MS,
): Promise<T | null> {
  const outcome = await withRenewingLease(redis, operationId, ttlMs, async () => fn());
  return outcome.owned ? outcome.value : null;
}
