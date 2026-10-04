import { Router, type Request, type Response, type NextFunction } from 'express';
import type { IdentityContext } from './service.js';
import {
  createAdmin,
  login,
  logout,
  logoutAll,
  ok,
  readCsrfCookie,
  readRefreshSecret,
  refresh,
  register,
} from './service.js';
import {
  ACCESS_COOKIE,
  csrfCookie,
  CSRF_COOKIE,
  CSRF_MAX_AGE_SEC,
  parseCookies,
  type CookieFlags,
} from './cookies.js';
import { csrfDigest, CSRF_HEADER, issueCsrfToken, verifyAnonymousCsrf } from './csrf.js';
import { ApiError } from './errors.js';
import { bindSessionCsrf, getActiveSession } from './store.js';
import { verifyAccessToken } from './tokens.js';
import { updateProfile, studentDirectory } from './profile.js';
import { readStudentProfile, editStudentProfile } from './student-profile.js';
import { ADMIN_CREATE_LIMIT, LOGIN_LIMIT, REFRESH_LIMIT, REGISTER_LIMIT } from './rateLimit.js';
import {
  rateLimit as limit,
  requireAdmin,
  requireAnonymousCsrf,
  requireAuth,
  requireOrigin,
  requireSessionCsrf,
} from './middleware.js';

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}

function setCookies(res: Response, cookies: string[]): void {
  const existing = res.getHeader('Set-Cookie');
  const merged = Array.isArray(existing) ? [...existing.map(String), ...cookies] : cookies;
  res.setHeader('Set-Cookie', merged);
}

function flagsOf(ctx: IdentityContext): CookieFlags {
  return { secure: ctx.auth.cookieSecure };
}

/** Best-effort verified access session id for credential-less logout.
 * Returns undefined for missing/invalid/expired tokens (logout then only
 * clears cookies, which is the correct idempotent no-op). */
function verifiedAccessSession(ctx: IdentityContext, req: Request): string | undefined {
  try {
    const token = parseCookies(req.headers.cookie)[ACCESS_COOKIE];
    if (!token) return undefined;
    const now = ctx.clock ? ctx.clock() : Date.now();
    return verifyAccessToken(token, ctx.auth, now).sid;
  } catch {
    return undefined;
  }
}

/** CSRF bootstrap with a session-lifetime invariant.
 *
 * - No access cookie: anonymous bootstrap, short standalone lifetime.
 * - Valid access cookie + active session: the new value is BOUND to that
 *   same session (never replaced with an unbound value) and its cookie
 *   lives at most for the session's remaining absolute lifetime.
 * - Stale access cookie (expired/revoked/invalid session): 401 without
 *   setting any cookie — a clear reauthentication signal, never a
 *   silently unusable session.
 */
export function createAuthRouter(ctx: IdentityContext): Router {
  const router = Router();

  router.get(
    '/csrf',
    asyncRoute(async (req, res) => {
      const now = ctx.clock ? ctx.clock() : Date.now();
      const token = issueCsrfToken();
      const accessToken = parseCookies(req.headers.cookie)[ACCESS_COOKIE];
      if (!accessToken) {
        setCookies(res, [csrfCookie(token, flagsOf(ctx), CSRF_MAX_AGE_SEC)]);
        res.status(200).json(ok({ ok: true }));
        return;
      }
      let sessionId: string;
      let sub: string;
      try {
        const claims = verifyAccessToken(accessToken, ctx.auth, now);
        sessionId = claims.sid;
        sub = claims.sub;
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(401, 'TOKEN_INVALID', 'Session is invalid.');
      }
      const check = await getActiveSession(ctx.prisma, sessionId, now);
      if (!check.ok) {
        if (check.reason === 'expired')
          throw new ApiError(401, 'SESSION_EXPIRED', 'Session has expired.');
        if (check.reason === 'revoked')
          throw new ApiError(401, 'SESSION_REVOKED', 'Session is invalid.');
        throw new ApiError(401, 'TOKEN_INVALID', 'Session is invalid.');
      }
      if (check.user.id !== sub) {
        throw new ApiError(401, 'TOKEN_INVALID', 'Session is invalid.');
      }
      const bound = await bindSessionCsrf(ctx.prisma, sessionId, csrfDigest(token), now);
      if (!bound) {
        throw new ApiError(401, 'SESSION_REVOKED', 'Session is invalid.');
      }
      const remainingSec = Math.max(
        1,
        Math.floor((check.absoluteExpiresAt.getTime() - now) / 1000),
      );
      setCookies(res, [csrfCookie(token, flagsOf(ctx), remainingSec)]);
      res.status(200).json(ok({ ok: true }));
    }),
  );

  router.post(
    '/register',
    limit('register', REGISTER_LIMIT),
    requireOrigin,
    requireAnonymousCsrf,
    asyncRoute(async (req, res) => {
      const cookies = parseCookies(req.headers.cookie);
      const csrfToken = cookies[CSRF_COOKIE] ?? '';
      const result = await register(ctx, req.body, csrfToken);
      setCookies(res, result.cookies);
      res.status(201).json(ok({ user: result.user }));
    }),
  );

  router.post(
    '/login',
    limit('login', LOGIN_LIMIT),
    requireOrigin,
    requireAnonymousCsrf,
    asyncRoute(async (req, res) => {
      const cookies = parseCookies(req.headers.cookie);
      const csrfToken = cookies[CSRF_COOKIE] ?? '';
      const result = await login(ctx, req.body, csrfToken);
      setCookies(res, result.cookies);
      res.status(200).json(ok({ user: result.user }));
    }),
  );

  router.post(
    '/refresh',
    limit('refresh', REFRESH_LIMIT),
    requireOrigin,
    asyncRoute(async (req, res) => {
      const result = await refresh(ctx, {
        refreshSecret: readRefreshSecret(req.headers.cookie),
        csrfHeader: req.get(CSRF_HEADER),
        csrfCookie: readCsrfCookie(req.headers.cookie),
      });
      setCookies(res, result.cookies);
      res.status(200).json(ok({ user: result.user }));
    }),
  );

  router.post(
    '/logout',
    requireOrigin,
    asyncRoute(async (req, res) => {
      const secret = readRefreshSecret(req.headers.cookie);
      let accessSessionId: string | undefined;
      if (secret) {
        // A presented credential must still prove CSRF intent.
        const cookies = parseCookies(req.headers.cookie);
        verifyAnonymousCsrf(req.get(CSRF_HEADER), cookies[CSRF_COOKIE]);
      } else {
        // No refresh cookie: fall back to the verified access-token session
        // so logout still revokes durably instead of clearing cookies only.
        // Failures stay anonymous — logout remains idempotent.
        accessSessionId = verifiedAccessSession(ctx, req);
      }
      const cleared = await logout(ctx, { refreshSecret: secret, accessSessionId });
      setCookies(res, cleared);
      res.status(200).json(ok({ ok: true }));
    }),
  );

  router.post(
    '/logout-all',
    requireOrigin,
    requireAuth,
    requireSessionCsrf,
    asyncRoute(async (req, res) => {
      const result = await logoutAll(ctx, req.auth?.userId ?? '');
      setCookies(res, result.cookies);
      res.status(200).json(ok({ ok: true, revoked: result.revoked.length }));
    }),
  );

  router.get(
    '/me',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.status(200).json(ok({ user: req.auth?.user ?? null }));
    }),
  );
  router.patch('/profile',limit('profile-edit',LOGIN_LIMIT),requireOrigin,requireAuth,requireSessionCsrf,asyncRoute(async(req,res)=>{
    res.json(ok(await updateProfile(ctx,req.auth!.userId,req.auth!.sessionId,req.body)));
  }));
  router.get('/student-profile',requireAuth,asyncRoute(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.json(ok(await readStudentProfile(ctx,req.auth!.userId)));
  }));
  router.patch('/student-profile',limit('student-profile-edit',LOGIN_LIMIT),requireOrigin,requireAuth,requireSessionCsrf,asyncRoute(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.json(ok(await editStudentProfile(ctx,req.auth!.userId,req.auth!.userId,req.auth!.sessionId,req.body)));
  }));

  return router;
}

/** Authenticated ADMIN-only identity administration. */
export function createAdminRouter(ctx: IdentityContext): Router {
  const router = Router();
  router.get('/students',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{res.json(ok(await studentDirectory(ctx,req.query)));}));
  router.get('/students/:studentId/profile',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.json(ok(await readStudentProfile(ctx,String(req.params.studentId),req.auth!.userId)));
  }));
  router.patch('/students/:studentId/profile',limit('admin-student-profile-edit',LOGIN_LIMIT),requireOrigin,requireAuth,requireAdmin,requireSessionCsrf,asyncRoute(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.json(ok(await editStudentProfile(ctx,String(req.params.studentId),req.auth!.userId,req.auth!.sessionId,req.body,true)));
  }));

  router.post(
    '/users',
    limit('admin-create', ADMIN_CREATE_LIMIT),
    requireOrigin,
    requireAuth,
    requireAdmin,
    requireSessionCsrf,
    asyncRoute(async (req, res) => {
      const created = await createAdmin(ctx, req.body);
      res.status(201).json(ok({ user: created }));
    }),
  );

  return router;
}
