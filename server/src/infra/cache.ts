import type { LockProvider, RateLimitDecision, RateLimitSpec } from './locks-do.js';
import type { Clock } from '../modules/identity/tokens.js';
import { tombstoneKey } from '../modules/identity/store.js';

export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Unified cache/rate-limit/tombstone/lease abstraction replacing ioredis.
 * - Production/Cloudflare Workers: CloudflareCache (KV + MutexDurableObject)
 * - Local/Tests: InMemoryCache (Map + Clock)
 */
export interface PlatformCache {
  setTombstone(sessionId: string, ttlSec: number): Promise<void>;
  hasTombstone(sessionId: string): Promise<boolean>;
  checkRateLimit(scope: string, ip: string, limit: RateLimitSpec): Promise<RateLimitDecision>;
  acquireLease(key: string, token: string, ttlMs: number): Promise<boolean>;
  renewLease(key: string, token: string, ttlMs: number): Promise<boolean>;
  isLeaseOwner(key: string, token: string): Promise<boolean>;
  releaseLease(key: string, token: string): Promise<void>;
  ping(): Promise<string>;
  disconnect(): void;
  /** Compatibility helpers for callers/tests inspecting raw keys. */
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: Array<string | number>): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  ttl(key: string): Promise<number>;
}

interface MemEntry {
  value: string;
  expiresAt: number;
}

/** Map-backed PlatformCache with TTL expiration using injected Clock. */
export class InMemoryCache implements PlatformCache {
  private readonly store = new Map<string, MemEntry>();
  private readonly counters = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly clock: Clock = Date.now) {}

  private readEntry(key: string): MemEntry | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.clock()) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  async setTombstone(sessionId: string, ttlSec: number): Promise<void> {
    this.store.set(tombstoneKey(sessionId), {
      value: '1',
      expiresAt: this.clock() + ttlSec * 1000,
    });
  }

  async hasTombstone(sessionId: string): Promise<boolean> {
    return this.readEntry(tombstoneKey(sessionId)) !== null;
  }

  async checkRateLimit(
    scope: string,
    ip: string,
    limit: RateLimitSpec,
  ): Promise<RateLimitDecision> {
    const key = `rl:${scope}:${ip}`;
    const now = this.clock();
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

  async acquireLease(key: string, token: string, ttlMs: number): Promise<boolean> {
    if (this.readEntry(key) !== null) return false;
    this.store.set(key, { value: token, expiresAt: this.clock() + ttlMs });
    return true;
  }

  async renewLease(key: string, token: string, ttlMs: number): Promise<boolean> {
    const entry = this.readEntry(key);
    if (!entry || entry.value !== token) return false;
    entry.expiresAt = this.clock() + ttlMs;
    return true;
  }

  async isLeaseOwner(key: string, token: string): Promise<boolean> {
    const entry = this.readEntry(key);
    return entry !== null && entry.value === token;
  }

  async releaseLease(key: string, token: string): Promise<void> {
    const entry = this.readEntry(key);
    if (entry && entry.value === token) {
      this.store.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.readEntry(key)?.value ?? null;
  }

  async set(key: string, value: string, ...args: Array<string | number>): Promise<'OK' | null> {
    let ttlMs = 3_600_000;
    let nx = false;
    for (let i = 0; i < args.length; i += 1) {
      const arg = String(args[i]).toUpperCase();
      if (arg === 'EX' && i + 1 < args.length) {
        ttlMs = Number(args[i + 1]) * 1000;
        i += 1;
      } else if (arg === 'PX' && i + 1 < args.length) {
        ttlMs = Number(args[i + 1]);
        i += 1;
      } else if (arg === 'NX') {
        nx = true;
      }
    }
    if (nx && this.readEntry(key) !== null) return null;
    this.store.set(key, { value, expiresAt: this.clock() + ttlMs });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return this.readEntry(key) !== null ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    const matched: string[] = [];
    const now = this.clock();
    for (const [k, v] of this.store.entries()) {
      if (v.expiresAt > now && k.startsWith(prefix)) matched.push(k);
    }
    for (const [k, v] of this.counters.entries()) {
      if (v.resetAt > now && k.startsWith(prefix)) matched.push(k);
    }
    return matched;
  }

  async ttl(key: string): Promise<number> {
    const now = this.clock();
    const entry = this.readEntry(key);
    if (entry) return Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
    const counter = this.counters.get(key);
    if (counter && counter.resetAt > now) {
      return Math.max(1, Math.ceil((counter.resetAt - now) / 1000));
    }
    return -2;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  disconnect(): void {
    this.store.clear();
    this.counters.clear();
  }
}

/**
 * Cloudflare Workers PlatformCache.
 * - Cost-guard optimization ($5 Workers Paid Plan): D1 includes 25B row reads/month
 *   and `getActiveSession()` already queries `AuthSession.revokedAt` in D1 on every
 *   authenticated request. `hasTombstone` therefore checks a fast isolate-local
 *   memory map rather than issuing a KV read on every request (saving the 10M/month
 *   KV read quota), while `setTombstone` records both locally and in KV.
 */
export class CloudflareCache implements PlatformCache {
  private readonly leases = new Map<string, { token: string; expiresAt: number }>();
  private readonly localTombstones = new Map<string, number>();

  constructor(
    private readonly kv: KVNamespaceLike,
    private readonly lockProvider: LockProvider,
  ) {}

  async setTombstone(sessionId: string, ttlSec: number): Promise<void> {
    this.localTombstones.set(tombstoneKey(sessionId), Date.now() + ttlSec * 1000);
    await this.kv.put(tombstoneKey(sessionId), '1', { expirationTtl: Math.max(60, ttlSec) });
  }

  async hasTombstone(sessionId: string): Promise<boolean> {
    const key = tombstoneKey(sessionId);
    const exp = this.localTombstones.get(key);
    if (exp === undefined) return false;
    if (exp <= Date.now()) {
      this.localTombstones.delete(key);
      return false;
    }
    return true;
  }

  async checkRateLimit(
    scope: string,
    ip: string,
    limit: RateLimitSpec,
  ): Promise<RateLimitDecision> {
    if (this.lockProvider.checkRateLimit) {
      return this.lockProvider.checkRateLimit(scope, ip, limit);
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  async acquireLease(key: string, token: string, ttlMs: number): Promise<boolean> {
    try {
      const acquiredToken = await this.lockProvider.acquire(`lease:${key}`, ttlMs);
      this.leases.set(`${key}:${token}`, { token: acquiredToken, expiresAt: Date.now() + ttlMs });
      return true;
    } catch {
      return false;
    }
  }

  async renewLease(key: string, token: string, ttlMs: number): Promise<boolean> {
    const entry = this.leases.get(`${key}:${token}`);
    if (!entry) return false;
    entry.expiresAt = Date.now() + ttlMs;
    return true;
  }

  async isLeaseOwner(key: string, token: string): Promise<boolean> {
    const entry = this.leases.get(`${key}:${token}`);
    return entry !== undefined && entry.expiresAt > Date.now();
  }

  async releaseLease(key: string, token: string): Promise<void> {
    const mapKey = `${key}:${token}`;
    const entry = this.leases.get(mapKey);
    if (!entry) return;
    this.leases.delete(mapKey);
    await this.lockProvider.release(`lease:${key}`, entry.token).catch(() => undefined);
  }

  async get(key: string): Promise<string | null> {
    return this.kv.get(key);
  }

  async set(key: string, value: string, ...args: Array<string | number>): Promise<'OK' | null> {
    let ttlSec = 900;
    for (let i = 0; i < args.length; i += 1) {
      const arg = String(args[i]).toUpperCase();
      if (arg === 'EX' && i + 1 < args.length) {
        ttlSec = Number(args[i + 1]);
        i += 1;
      } else if (arg === 'PX' && i + 1 < args.length) {
        ttlSec = Math.ceil(Number(args[i + 1]) / 1000);
        i += 1;
      }
    }
    await this.kv.put(key, value, { expirationTtl: Math.max(60, ttlSec) });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    await this.kv.delete(key);
    return 1;
  }

  async exists(key: string): Promise<number> {
    return (await this.kv.get(key)) !== null ? 1 : 0;
  }

  async keys(_pattern: string): Promise<string[]> {
    return [];
  }

  async ttl(_key: string): Promise<number> {
    return -1;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  disconnect(): void {
    this.leases.clear();
  }
}
