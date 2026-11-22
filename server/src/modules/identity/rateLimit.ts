import type { PlatformCache } from '../../infra/cache.js';
import { ApiError } from './errors.js';

/** Fixed-window rate limits backed by MutexDurableObject / InMemoryCache. */
export interface RateLimit {
  windowSec: number;
  max: number;
}

export const LOGIN_LIMIT: RateLimit = { windowSec: 60, max: 10 };
export const REGISTER_LIMIT: RateLimit = { windowSec: 300, max: 20 };
export const REFRESH_LIMIT: RateLimit = { windowSec: 60, max: 30 };
export const ADMIN_CREATE_LIMIT: RateLimit = { windowSec: 300, max: 20 };

export function rateLimitKey(scope: string, ip: string): string {
  return `rl:${scope}:${ip}`;
}

export async function checkRateLimit(
  cache: PlatformCache,
  scope: string,
  ip: string,
  limit: RateLimit,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  return cache.checkRateLimit(scope, ip, limit);
}

export function rateLimited(retryAfterSec: number): ApiError {
  const err = new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.');
  (err as { retryAfterSec?: number }).retryAfterSec = retryAfterSec;
  return err;
}
