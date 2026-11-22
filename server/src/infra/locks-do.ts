/**
 * Distributed entity mutex & fixed-window rate limiter for Cloudflare Workers
 * (MutexDurableObject) with an in-process LocalAsyncMutex fallback for unit
 * and D1 integration tests.
 *
 * When multiple lock keys are requested, keys are always deduplicated and
 * acquired in sorted lexicographical order so deadlocks cannot occur.
 */

export interface RateLimitSpec {
  windowSec: number;
  max: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSec: number;
}

export interface LockProvider {
  acquire(key: string, ttlMs?: number): Promise<string>;
  release(key: string, token: string): Promise<void>;
  withLocks<T>(keys: readonly string[], fn: () => Promise<T>, ttlMs?: number): Promise<T>;
  checkRateLimit?(scope: string, ip: string, limit: RateLimitSpec): Promise<RateLimitDecision>;
}

const DEFAULT_LOCK_TTL_MS = 30_000;

interface LocalEntry {
  token: string;
  expiresAt: number;
  waiters: Array<() => void>;
}

/** In-process async mutex implementing LockProvider for local/test runs. */
export class LocalAsyncMutex implements LockProvider {
  private readonly locks = new Map<string, LocalEntry>();
  private readonly counters = new Map<string, { count: number; resetAt: number }>();
  private seq = 0;

  async acquire(key: string, ttlMs = DEFAULT_LOCK_TTL_MS): Promise<string> {
    const token = `local-${++this.seq}-${Date.now()}`;
    while (true) {
      const now = Date.now();
      const existing = this.locks.get(key);
      if (!existing || existing.expiresAt <= now) {
        this.locks.set(key, { token, expiresAt: now + ttlMs, waiters: [] });
        return token;
      }
      await new Promise<void>((resolve) => {
        existing.waiters.push(resolve);
      });
    }
  }

  async release(key: string, token: string): Promise<void> {
    const existing = this.locks.get(key);
    if (!existing || existing.token !== token) return;
    this.locks.delete(key);
    for (const wake of existing.waiters) {
      wake();
    }
  }

  async withLocks<T>(
    keys: readonly string[],
    fn: () => Promise<T>,
    ttlMs = DEFAULT_LOCK_TTL_MS,
  ): Promise<T> {
    const sorted = [...new Set(keys.filter(Boolean))].sort();
    const held: Array<{ key: string; token: string }> = [];
    try {
      for (const key of sorted) {
        const token = await this.acquire(key, ttlMs);
        held.push({ key, token });
      }
      return await fn();
    } finally {
      for (let i = held.length - 1; i >= 0; i -= 1) {
        const item = held[i]!;
        await this.release(item.key, item.token);
      }
    }
  }

  async checkRateLimit(
    scope: string,
    ip: string,
    limit: RateLimitSpec,
  ): Promise<RateLimitDecision> {
    const key = `rl:${scope}:${ip}`;
    const now = Date.now();
    const windowMs = limit.windowSec * 1000;
    const current = this.counters.get(key);
    if (!current || current.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }
    current.count += 1;
    if (current.count > limit.max) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      };
    }
    return { allowed: true, retryAfterSec: 0 };
  }
}

/** Minimal Durable Object namespace interface (avoids hard runtime import of cloudflare:workers). */
export interface DurableObjectStubLike {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

/** LockProvider backed by Cloudflare MutexDurableObject instances. */
export class DurableObjectLockProvider implements LockProvider {
  constructor(private readonly namespace: DurableObjectNamespaceLike) {}

  private stub(name: string): DurableObjectStubLike {
    return this.namespace.get(this.namespace.idFromName(name));
  }

  async acquire(key: string, ttlMs = DEFAULT_LOCK_TTL_MS): Promise<string> {
    const deadline = Date.now() + ttlMs;
    while (true) {
      const res = await this.stub(key).fetch('https://mutex.internal/acquire', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ttlMs }),
      });
      if (res.ok) {
        const body = (await res.json()) as { token: string };
        return body.token;
      }
      if (res.status !== 423 || Date.now() >= deadline) {
        throw new Error(`Failed to acquire lock ${key} (status ${res.status})`);
      }
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  async release(key: string, token: string): Promise<void> {
    await this.stub(key).fetch('https://mutex.internal/release', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  }

  async withLocks<T>(
    keys: readonly string[],
    fn: () => Promise<T>,
    ttlMs = DEFAULT_LOCK_TTL_MS,
  ): Promise<T> {
    const sorted = [...new Set(keys.filter(Boolean))].sort();
    const held: Array<{ key: string; token: string }> = [];
    try {
      for (const key of sorted) {
        const token = await this.acquire(key, ttlMs);
        held.push({ key, token });
      }
      return await fn();
    } finally {
      for (let i = held.length - 1; i >= 0; i -= 1) {
        const item = held[i]!;
        await this.release(item.key, item.token).catch(() => undefined);
      }
    }
  }

  async checkRateLimit(
    scope: string,
    ip: string,
    limit: RateLimitSpec,
  ): Promise<RateLimitDecision> {
    const res = await this.stub(`rl:${scope}:${ip}`).fetch('https://mutex.internal/ratelimit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(limit),
    });
    if (!res.ok) {
      return { allowed: false, retryAfterSec: 1 };
    }
    return (await res.json()) as RateLimitDecision;
  }
}

/**
 * Cloudflare Durable Object class providing single-threaded entity locks
 * (30s lease TTL) and fixed-window rate limiting.
 */
export class MutexDurableObject {
  private holderToken: string | null = null;
  private leaseExpiresAt = 0;
  private rlCount = 0;
  private rlResetAt = 0;

  constructor(private readonly _state: unknown, private readonly _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const now = Date.now();

    if (url.pathname === '/acquire' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { ttlMs?: number };
      const ttlMs = Math.min(Math.max(Number(body.ttlMs ?? DEFAULT_LOCK_TTL_MS), 1000), 60_000);
      if (this.holderToken !== null && this.leaseExpiresAt > now) {
        return new Response(JSON.stringify({ locked: true }), {
          status: 423,
          headers: { 'content-type': 'application/json' },
        });
      }
      const token = `${now}-${Math.random().toString(36).slice(2, 12)}`;
      this.holderToken = token;
      this.leaseExpiresAt = now + ttlMs;
      return new Response(JSON.stringify({ token }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.pathname === '/release' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { token?: string };
      if (this.holderToken !== null && body.token === this.holderToken) {
        this.holderToken = null;
        this.leaseExpiresAt = 0;
      }
      return new Response(JSON.stringify({ released: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.pathname === '/ratelimit' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Partial<RateLimitSpec>;
      const windowSec = Math.max(1, Number(body.windowSec ?? 60));
      const max = Math.max(1, Number(body.max ?? 60));
      if (this.rlResetAt <= now) {
        this.rlCount = 1;
        this.rlResetAt = now + windowSec * 1000;
        return new Response(JSON.stringify({ allowed: true, retryAfterSec: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      this.rlCount += 1;
      const allowed = this.rlCount <= max;
      const retryAfterSec = allowed ? 0 : Math.max(1, Math.ceil((this.rlResetAt - now) / 1000));
      return new Response(JSON.stringify({ allowed, retryAfterSec }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }
}

let activeLockProvider: LockProvider = new LocalAsyncMutex();

export function getLockProvider(): LockProvider {
  return activeLockProvider;
}

export function setLockProvider(provider: LockProvider): void {
  activeLockProvider = provider;
}

export function withEntityLocks<T>(
  keys: readonly string[],
  fn: () => Promise<T>,
  ttlMs?: number,
): Promise<T> {
  return activeLockProvider.withLocks(keys, fn, ttlMs);
}
