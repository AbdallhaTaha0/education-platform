import { randomUUID } from 'node:crypto';
import type { PlatformCache } from '../../../infra/cache.js';

const LEASE_TTL_MS = 30_000;
const LEASE_PREFIX = 'catalog:deletion:lease:';

function leaseKey(operationId: string): string {
  return `${LEASE_PREFIX}${operationId}`;
}

export interface DeletionLease {
  operationId: string;
  token: string;
  ttlMs: number;
}

export async function acquireDeletionLease(
  cache: PlatformCache,
  operationId: string,
  ttlMs = LEASE_TTL_MS,
): Promise<DeletionLease | null> {
  try {
    const token = randomUUID();
    const ok = await cache.acquireLease(leaseKey(operationId), token, ttlMs);
    return ok ? { operationId, token, ttlMs } : null;
  } catch {
    return null;
  }
}

export async function renewDeletionLease(
  cache: PlatformCache,
  lease: DeletionLease,
): Promise<boolean> {
  try {
    return await cache.renewLease(leaseKey(lease.operationId), lease.token, lease.ttlMs);
  } catch {
    return false;
  }
}

export async function isDeletionLeaseOwner(
  cache: PlatformCache,
  lease: DeletionLease,
): Promise<boolean> {
  try {
    return await cache.isLeaseOwner(leaseKey(lease.operationId), lease.token);
  } catch {
    return false;
  }
}

export async function releaseDeletionLease(
  cache: PlatformCache,
  lease: DeletionLease,
): Promise<void> {
  try {
    await cache.releaseLease(leaseKey(lease.operationId), lease.token);
  } catch {
    // Lease expires on its own.
  }
}

export interface RenewingScope {
  lease: DeletionLease;
  readonly lost: boolean;
}

export async function withRenewingLease<T>(
  cache: PlatformCache,
  operationId: string,
  ttlMs: number,
  work: (scope: RenewingScope) => Promise<T>,
): Promise<{ owned: true; value: T } | { owned: false }> {
  const lease = await acquireDeletionLease(cache, operationId, ttlMs);
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
    void renewDeletionLease(cache, lease)
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
    await releaseDeletionLease(cache, lease);
  }
}

export async function acquireLease(
  cache: PlatformCache,
  operationId: string,
  ttlMs = LEASE_TTL_MS,
): Promise<string | null> {
  const lease = await acquireDeletionLease(cache, operationId, ttlMs);
  return lease === null ? null : lease.token;
}

export async function releaseLease(
  cache: PlatformCache,
  operationId: string,
  token: string,
): Promise<void> {
  await releaseDeletionLease(cache, { operationId, token, ttlMs: LEASE_TTL_MS });
}

export async function withDeletionLease<T>(
  cache: PlatformCache,
  operationId: string,
  fn: () => Promise<T>,
  ttlMs = LEASE_TTL_MS,
): Promise<T | null> {
  const outcome = await withRenewingLease(cache, operationId, ttlMs, async () => fn());
  return outcome.owned ? outcome.value : null;
}
