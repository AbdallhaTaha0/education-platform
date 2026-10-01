import type { NextFunction, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { ApiError } from './errors.js';
import { ACCESS_COOKIE, parseCookies } from './cookies.js';
import { CSRF_HEADER, verifyAnonymousCsrf, verifySessionCsrf } from './csrf.js';
import { checkRateLimit, rateLimited, type RateLimit } from './rateLimit.js';
import { getActiveSession, tombstoneKey } from './store.js';
import { ensureRedis } from '../../infra/redis.js';
import { verifyAccessToken, type Clock, type TokenConfig } from './tokens.js';
import type { SafeUser } from './store.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; role: 'STUDENT' | 'ADMIN'; sessionId: string; user: SafeUser };
    }
  }
}

export interface GuardDeps {
  prisma: PrismaClient;
  redis: Redis;
  auth: TokenConfig & { allowedOrigins: string[] };
  clock?: Clock;
}

function nowMs(deps: GuardDeps): number {
  return deps.clock ? deps.clock() : Date.now();
}

/** Fixed-window Redis rate limit shared across replicas. */
export function rateLimit(scope: string, limit: RateLimit) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const deps = req.app.get('identity') as GuardDeps;
    try {
      await ensureRedis(deps.redis);
      const result = await checkRateLimit(deps.redis, scope, req.ip ?? 'unknown', limit);
      if (!result.allowed) {
        const err = rateLimited(result.retryAfterSec);
        (_res as Response).setHeader('Retry-After', String(result.retryAfterSec));
        next(err);
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Exact approved Origin for every state-changing identity request. Browsers
 * always send Origin on these fetches; missing or unlisted origins fail
 * closed with 403. No Referer fallback, no wildcards. */
export function requireOrigin(req: Request, _res: Response, next: NextFunction): void {
  const deps = req.app.get('identity') as GuardDeps;
  const origin = req.get('Origin');
  if (!origin || !deps.auth.allowedOrigins.includes(origin)) {
    next(new ApiError(403, 'ORIGIN_FORBIDDEN', 'Request origin is not allowed.'));
    return;
  }
  next();
}

/** Double-submit CSRF for pre-session requests (register/login). */
export function requireAnonymousCsrf(req: Request, _res: Response, next: NextFunction): void {
  try {
    const cookies = parseCookies(req.headers.cookie);
    verifyAnonymousCsrf(req.get(CSRF_HEADER), cookies['edu_csrf']);
    next();
  } catch (err) {
    next(err);
  }
}

/** Authenticate via the HttpOnly access cookie and the durable server
 * session. Logout/revocation take effect immediately: the Redis tombstone
 * short-circuits, and PostgreSQL is the per-request authority. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const deps = req.app.get('identity') as GuardDeps;
  void (async () => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[ACCESS_COOKIE];
    if (!token) throw new ApiError(401, 'TOKEN_MISSING', 'Authentication is required.');
    const now = nowMs(deps);
    const claims = verifyAccessToken(token, deps.auth, now);
    await ensureRedis(deps.redis);
    if (await deps.redis.exists(tombstoneKey(claims.sid))) {
      throw new ApiError(401, 'SESSION_REVOKED', 'Session is invalid.');
    }
    const check = await getActiveSession(deps.prisma, claims.sid, now);
    if (!check.ok) {
      if (check.reason === 'revoked') {
        await deps.redis.set(tombstoneKey(claims.sid), '1', 'EX', 900);
        throw new ApiError(401, 'SESSION_REVOKED', 'Session is invalid.');
      }
      if (check.reason === 'expired')
        throw new ApiError(401, 'SESSION_EXPIRED', 'Session has expired.');
      throw new ApiError(401, 'TOKEN_INVALID', 'Session is invalid.');
    }
    if (check.user.id !== claims.sub) {
      throw new ApiError(401, 'TOKEN_INVALID', 'Session is invalid.');
    }
    if (check.user.role !== 'STUDENT' && check.user.role !== 'ADMIN') {
      throw new ApiError(401, 'TOKEN_INVALID', 'Session is invalid.');
    }
    req.auth = {
      userId: check.user.id,
      role: check.user.role,
      sessionId: claims.sid,
      user: {
        id: check.user.id,
        email: check.user.email,
        phone: check.user.phone,
        displayName: check.user.displayName,
        role: check.user.role,
        createdAt: check.user.createdAt,
      },
    };
    next();
  })().catch(next);
}

/** Authenticated role denial → 403 (never 401 once identity is proven). */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) {
    next(new ApiError(401, 'TOKEN_MISSING', 'Authentication is required.'));
    return;
  }
  if (req.auth.role !== 'ADMIN') {
    next(new ApiError(403, 'FORBIDDEN', 'Admin access is required.'));
    return;
  }
  next();
}

/** Session-bound CSRF for authenticated state-changing requests. */
export function requireSessionCsrf(req: Request, _res: Response, next: NextFunction): void {
  const deps = req.app.get('identity') as GuardDeps;
  void (async () => {
    if (!req.auth) throw new ApiError(401, 'TOKEN_MISSING', 'Authentication is required.');
    const session = await deps.prisma.authSession.findUnique({
      where: { id: req.auth.sessionId },
      select: { csrfHash: true },
    });
    const cookies = parseCookies(req.headers.cookie);
    verifySessionCsrf(req.get(CSRF_HEADER), cookies['edu_csrf'], session?.csrfHash ?? null);
    next();
  })().catch(next);
}
