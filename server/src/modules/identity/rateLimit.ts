import type Redis from 'ioredis';
import { ApiError } from './errors.js';

/** Redis-backed fixed-window limits shared across backend replicas.
 * Keys are bounded (`rl:<scope>:<ip>`) and always expire. */
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

/** Atomic increment-and-expire: the counter and its TTL are established in
 * one Lua step, so a crash between them can never leave a permanent key. */
const INCR_WITH_TTL = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('TTL', KEYS[1])}
`;

export async function checkRateLimit(
  redis: Redis,
  scope: string,
  ip: string,
  limit: RateLimit,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const key = rateLimitKey(scope, ip);
  const raw = (await redis.eval(INCR_WITH_TTL, 1, key, String(limit.windowSec))) as [
    number,
    number,
  ];
  const count = Number(raw[0]);
  const ttl = Number(raw[1]);
  if (count > limit.max) {
    return { allowed: false, retryAfterSec: ttl > 0 ? ttl : limit.windowSec };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function rateLimited(retryAfterSec: number): ApiError {
  const err = new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.');
  (err as { retryAfterSec?: number }).retryAfterSec = retryAfterSec;
  return err;
}
