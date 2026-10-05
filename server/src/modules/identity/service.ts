import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { getLogger } from '../../logger.js';
import { ensureRedis } from '../../infra/redis.js';
import { ApiError, ok } from './errors.js';
import { protectNationalId, validateStudentDetails, type StudentDataKeys } from './student-data.js';
import {
  normalizeDisplayName,
  normalizeEmail,
  normalizePhone,
  rejectPrivilegeFields,
  validatePassword,
  PASSWORD_MAX_LENGTH,
} from './validation.js';
import { hashPassword, verifyPassword, type Argon2Params } from './password.js';
import {
  ACCESS_TOKEN_TTL_SEC,
  generateRefreshSecret,
  sha256Hex,
  signAccessToken,
  type Clock,
  type TokenConfig,
} from './tokens.js';
import {
  accessCookie,
  clearAuthCookies,
  csrfCookie,
  parseCookies,
  refreshCookie,
  REFRESH_COOKIE,
  type CookieFlags,
} from './cookies.js';
import { csrfDigest, issueCsrfToken } from './csrf.js';
import {
  createSessionFamily,
  getActiveSession,
  mapUniqueViolation,
  newSessionTiming,
  revokeAllUserSessions,
  revokeSessionFamily,
  rotateRefreshCredential,
  toSafeUser,
  tombstoneKey,
  SESSION_TOMBSTONE_TTL_SEC,
  type SafeUser,
} from './store.js';

export interface AuthConfig extends TokenConfig {
  studentDataKeys?: StudentDataKeys;
  allowedOrigins: string[];
  cookieSecure: boolean;
  argon2: Argon2Params;
}

export interface IdentityContext {
  prisma: PrismaClient;
  redis: Redis;
  auth: AuthConfig;
  clock?: Clock;
}

export interface SessionCookies {
  user: SafeUser;
  cookies: string[];
}

function nowOf(ctx: IdentityContext): number {
  return ctx.clock ? ctx.clock() : Date.now();
}

/** Write a revocation tombstone so every replica denies the family at once.
 * TTL covers the maximum remaining access-token lifetime. */
async function tombstone(ctx: IdentityContext, sessionId: string): Promise<void> {
  await ensureRedis(ctx.redis);
  await ctx.redis.set(tombstoneKey(sessionId), '1', 'EX', SESSION_TOMBSTONE_TTL_SEC);
}

function cookieFlags(ctx: IdentityContext): CookieFlags {
  return { secure: ctx.auth.cookieSecure };
}

/** Lazy process-wide dummy hash so unknown identifiers cost one Argon2id
 * verification, matching the failure shape (and rough timing) of a wrong
 * password without revealing whether the identifier exists. */
let dummyHashPromise: Promise<string> | null = null;

function dummyHash(ctx: IdentityContext): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(`dummy:${randomUUID()}`, ctx.auth.argon2);
  }
  return dummyHashPromise;
}

async function buildSessionCookies(
  ctx: IdentityContext,
  user: SafeUser,
  role: 'STUDENT' | 'ADMIN',
  sessionId: string,
  refreshSecret: string,
  absoluteExpiresAt: Date,
  csrfToken: string,
): Promise<string[]> {
  const now = nowOf(ctx);
  const { token } = signAccessToken({ sub: user.id, role, sid: sessionId }, ctx.auth, now);
  const remainingSec = Math.max(1, Math.floor((absoluteExpiresAt.getTime() - now) / 1000));
  return [
    accessCookie(token, cookieFlags(ctx)),
    refreshCookie(refreshSecret, remainingSec, cookieFlags(ctx)),
    // Session-bound CSRF never outlives the session it protects.
    csrfCookie(csrfToken, cookieFlags(ctx), remainingSec),
  ];
}

async function establishSession(
  ctx: IdentityContext,
  user: SafeUser,
  role: 'STUDENT' | 'ADMIN',
  csrfToken: string,
  expectedPasswordHash: string,
): Promise<SessionCookies> {
  const now = nowOf(ctx);
  const timing = newSessionTiming(now);
  await createSessionFamily(ctx.prisma, {
    sessionId: timing.sessionId,
    userId: user.id,
    csrfHash: csrfDigest(csrfToken),
    absoluteExpiresAt: timing.absoluteExpiresAt,
    refreshSecret: timing.refreshSecret,
    expectedPasswordHash,
  });
  getLogger().info({ userId: user.id, sessionId: timing.sessionId }, 'session established');
  return {
    user,
    cookies: await buildSessionCookies(
      ctx,
      user,
      role,
      timing.sessionId,
      timing.refreshSecret,
      timing.absoluteExpiresAt,
      csrfToken,
    ),
  };
}

export interface RegisterInput {
  nationalId: unknown;
  parentPhone: unknown;
  schoolYear: unknown;
  governorate: unknown;
  schoolName?: unknown;
  displayName: unknown;
  email: unknown;
  phone: unknown;
  password: unknown;
}

/** Public registration always creates STUDENT. Privilege fields are rejected. */
export async function register(
  ctx: IdentityContext,
  raw: unknown,
  csrfToken: string,
): Promise<SessionCookies> {
  rejectPrivilegeFields(raw);
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as RegisterInput;
  const displayName = normalizeDisplayName(body.displayName);
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  const password = validatePassword(body.password);
  const userId = randomUUID();
  const details = validateStudentDetails(body as unknown as Record<string, unknown>, true);
  const protectedId = protectNationalId(body.nationalId, ctx.auth.studentDataKeys, userId);

  const conflict = await ctx.prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { email: true, phone: true },
  });
  if (conflict) {
    if (conflict.email === email)
      throw new ApiError(409, 'EMAIL_TAKEN', 'Email is already registered.');
    throw new ApiError(409, 'PHONE_TAKEN', 'Phone is already registered.');
  }
  const passwordHash = await hashPassword(password, ctx.auth.argon2);
  const now = nowOf(ctx);
  const timing = newSessionTiming(now);
  try {
    await ctx.prisma.$transaction([
      ctx.prisma.user.create({
        data: { id: userId, email, phone, displayName, passwordHash, role: 'STUDENT', studentProfile: { create: { ...details, ...protectedId } } },
      }),
      ctx.prisma.authSession.create({
        data: {
          id: timing.sessionId,
          userId,
          csrfHash: csrfDigest(csrfToken),
          absoluteExpiresAt: timing.absoluteExpiresAt,
        },
      }),
      ctx.prisma.refreshToken.create({
        data: { sessionId: timing.sessionId, tokenHash: sha256Hex(timing.refreshSecret) },
      }),
    ]);
  } catch (err) {
    const mapped = mapUniqueViolation(err);
    if (mapped) throw mapped;
    throw new ApiError(500, 'STUDENT_PROFILE_UNAVAILABLE', 'Could not create your account.');
  }
  const created = await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  getLogger().info({ userId }, 'student registered');
  return {
    user: toSafeUser(created),
    cookies: await buildSessionCookies(
      ctx,
      toSafeUser(created),
      'STUDENT',
      timing.sessionId,
      timing.refreshSecret,
      timing.absoluteExpiresAt,
      csrfToken,
    ),
  };
}

export interface LoginInput {
  identifier: unknown;
  password: unknown;
}

/** One identifier field accepts either normalized email or normalized phone.
 * Unknown identifiers and wrong passwords share one public failure shape. */
export async function login(
  ctx: IdentityContext,
  raw: unknown,
  csrfToken: string,
): Promise<SessionCookies> {
  rejectPrivilegeFields(raw);
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as LoginInput;
  const password = typeof body.password === 'string' ? body.password : '';
  // Reject values outside the account password contract before hashing or
  // looking up an identifier; retain the same generic login failure.
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email/phone or password is incorrect.');
  }

  let email: string | null = null;
  let phone: string | null = null;
  if (typeof body.identifier === 'string' && body.identifier.includes('@')) {
    try {
      email = normalizeEmail(body.identifier);
    } catch {
      email = null;
    }
  } else {
    try {
      phone = normalizePhone(body.identifier);
    } catch {
      phone = null;
    }
  }
  const user =
    email !== null
      ? await ctx.prisma.user.findUnique({ where: { email } })
      : phone !== null
        ? await ctx.prisma.user.findUnique({ where: { phone } })
        : null;
  const verified = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyPassword(await dummyHash(ctx), password).then(() => false);
  if (!user || !verified) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email/phone or password is incorrect.');
  }
  if (user.role !== 'STUDENT' && user.role !== 'ADMIN') {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email/phone or password is incorrect.');
  }
  getLogger().info({ userId: user.id }, 'login succeeded');
  return establishSession(ctx, toSafeUser(user), user.role, csrfToken, user.passwordHash);
}

export interface RefreshInput {
  refreshSecret: string | undefined;
  csrfHeader: string | undefined;
  csrfCookie: string | undefined;
}

/** Rotate credentials atomically. Returns fresh cookies; JSON carries no
 * bearer or refresh token. A replayed credential commits the family
 * revocation first; the tombstone and TOKEN_REUSED follow the commit. */
export async function refresh(ctx: IdentityContext, input: RefreshInput): Promise<SessionCookies> {
  if (!input.refreshSecret) {
    throw new ApiError(401, 'TOKEN_MISSING', 'Authentication is required.');
  }
  const csrfToken = issueCsrfToken();
  const outcome = await rotateRefreshCredential(ctx.prisma, {
    refreshSecret: input.refreshSecret,
    csrfHash: csrfDigest(csrfToken),
    csrf: { header: input.csrfHeader, cookie: input.csrfCookie },
    clock: ctx.clock,
  });
  if (outcome.status === 'rotated') {
    getLogger().info({ userId: outcome.user.id, sessionId: outcome.sessionId }, 'refresh rotated');
    return {
      user: toSafeUser(outcome.user),
      cookies: await buildSessionCookies(
        ctx,
        toSafeUser(outcome.user),
        outcome.user.role,
        outcome.sessionId,
        outcome.newRefreshSecret,
        outcome.absoluteExpiresAt,
        csrfToken,
      ),
    };
  }
  if (outcome.status === 'reused') {
    await tombstone(ctx, outcome.sessionId);
    getLogger().warn({ sessionId: outcome.sessionId }, 'refresh reuse revoked family');
    throw new ApiError(401, 'TOKEN_REUSED', 'Session is invalid.');
  }
  if (outcome.status === 'revoked') {
    throw new ApiError(401, 'SESSION_REVOKED', 'Session is invalid.');
  }
  if (outcome.status === 'expired') {
    throw new ApiError(401, 'SESSION_EXPIRED', 'Session has expired.');
  }
  throw new ApiError(401, 'TOKEN_INVALID', 'Session is invalid.');
}

export interface LogoutInput {
  refreshSecret: string | undefined;
  /** Verified access-token session id, used when no refresh cookie exists. */
  accessSessionId: string | undefined;
}

/** Durably revoke the identified server-side session and clear cookies.
 *
 * A 200 response means the session was revoked in PostgreSQL (or was
 * already absent — idempotent). A PostgreSQL revocation failure propagates
 * as a controlled 500 and MUST NOT return success: the caller must not
 * assume the session died. Redis tombstoning is best-effort only after the
 * durable commit, because PostgreSQL remains authoritative.
 */
export async function logout(ctx: IdentityContext, input: LogoutInput): Promise<string[]> {
  let sessionId: string | undefined;
  if (input.refreshSecret) {
    const row = await ctx.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256Hex(input.refreshSecret) },
      select: { sessionId: true },
    });
    sessionId = row?.sessionId ?? input.accessSessionId;
  } else {
    sessionId = input.accessSessionId;
  }
  if (!sessionId) {
    return clearAuthCookies(cookieFlags(ctx));
  }
  const now = nowOf(ctx);
  const revoked = await revokeSessionFamily(ctx.prisma, sessionId, 'logout', now);
  try {
    await tombstone(ctx, sessionId);
  } catch (err) {
    // Tombstone is a cross-replica accelerator only; PostgreSQL already
    // committed the revocation and stays authoritative.
    getLogger().warn({ err, sessionId }, 'logout tombstone best-effort failed');
  }
  getLogger().info({ sessionId, revoked }, 'session logged out');
  return clearAuthCookies(cookieFlags(ctx));
}

/** Revoke every session of the current user; other users are untouched. */
export async function logoutAll(
  ctx: IdentityContext,
  userId: string,
): Promise<{ revoked: string[]; cookies: string[] }> {
  const now = nowOf(ctx);
  const ids = await revokeAllUserSessions(ctx.prisma, userId, 'logout-all', now);
  for (const id of ids) {
    await tombstone(ctx, id);
  }
  getLogger().info({ userId, revoked: ids.length }, 'all sessions logged out');
  return { revoked: ids, cookies: clearAuthCookies(cookieFlags(ctx)) };
}

export interface AdminCreateInput {
  displayName: unknown;
  email: unknown;
  phone: unknown;
  password: unknown;
}

/** Only an authenticated ADMIN reaches here (middleware). The created account
 * is always ADMIN; any client-supplied role is rejected, never trusted. */
export async function createAdmin(ctx: IdentityContext, raw: unknown): Promise<SafeUser> {
  rejectPrivilegeFields(raw);
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as AdminCreateInput;
  const displayName = normalizeDisplayName(body.displayName);
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  const password = validatePassword(body.password);

  const conflict = await ctx.prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { email: true, phone: true },
  });
  if (conflict) {
    if (conflict.email === email)
      throw new ApiError(409, 'EMAIL_TAKEN', 'Email is already registered.');
    throw new ApiError(409, 'PHONE_TAKEN', 'Phone is already registered.');
  }
  const passwordHash = await hashPassword(password, ctx.auth.argon2);
  try {
    const created = await ctx.prisma.user.create({
      data: { email, phone, displayName, passwordHash, role: 'ADMIN' },
    });
    getLogger().info({ userId: created.id }, 'admin created');
    return toSafeUser(created);
  } catch (err) {
    const mapped = mapUniqueViolation(err);
    if (mapped) throw mapped;
    throw err;
  }
}

/** Read the presented refresh secret from the request cookies. */
export function readRefreshSecret(cookieHeader: string | undefined): string | undefined {
  const parsed = parseCookies(cookieHeader);
  return parsed[REFRESH_COOKIE];
}

/** Read the presented CSRF cookie value. */
export function readCsrfCookie(cookieHeader: string | undefined): string | undefined {
  return parseCookies(cookieHeader)['edu_csrf'];
}

export { ACCESS_TOKEN_TTL_SEC, ok };
export type { SafeUser };
