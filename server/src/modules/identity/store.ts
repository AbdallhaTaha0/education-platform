import type { PrismaClient, User } from '@prisma/client';
import { withEntityLocks } from '../../infra/locks-do.js';
import { ApiError } from './errors.js';
import { verifySessionCsrf } from './csrf.js';
import {
  REFRESH_ABSOLUTE_TTL_SEC,
  generateRefreshSecret,
  sha256Hex,
  type Clock,
} from './tokens.js';

export type SafeUser = Pick<User, 'id' | 'email' | 'phone' | 'displayName' | 'role' | 'createdAt'>;

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export interface NewSession {
  sessionId: string;
  refreshSecret: string;
  absoluteExpiresAt: Date;
}

export type SessionCheck =
  | { ok: true; sessionId: string; user: User; absoluteExpiresAt: Date }
  | { ok: false; reason: 'missing' | 'revoked' | 'expired' };

/** Durable session authority is D1/SQLite. KV holds only revocation
 * tombstones — never positive session state — so a revocation cannot
 * leave a stale authorization window. */
export const SESSION_TOMBSTONE_TTL_SEC = 900;

export function tombstoneKey(sessionId: string): string {
  return `sessrev:${sessionId}`;
}

/** Create a session family with its first refresh credential. */
export async function createSessionFamily(
  prisma: PrismaClient,
  input: {
    sessionId: string;
    userId: string;
    csrfHash: string | null;
    absoluteExpiresAt: Date;
    refreshSecret: string;
    expectedPasswordHash?: string;
  },
): Promise<void> {
  if (input.expectedPasswordHash !== undefined) {
    await withEntityLocks([`user:${input.userId}`], async () => {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: input.userId },
          select: { passwordHash: true },
        });
        if (user?.passwordHash !== input.expectedPasswordHash) {
          throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email/phone or password is incorrect.');
        }
        await tx.authSession.create({
          data: {
            id: input.sessionId,
            userId: input.userId,
            csrfHash: input.csrfHash,
            absoluteExpiresAt: input.absoluteExpiresAt,
          },
        });
        await tx.refreshToken.create({
          data: { sessionId: input.sessionId, tokenHash: sha256Hex(input.refreshSecret) },
        });
      });
    });
    return;
  }
  await prisma.$transaction([
    prisma.authSession.create({
      data: {
        id: input.sessionId,
        userId: input.userId,
        csrfHash: input.csrfHash,
        absoluteExpiresAt: input.absoluteExpiresAt,
      },
    }),
    prisma.refreshToken.create({
      data: { sessionId: input.sessionId, tokenHash: sha256Hex(input.refreshSecret) },
    }),
  ]);
}

export function newSessionTiming(nowMs: number): NewSession {
  return {
    sessionId: crypto.randomUUID(),
    refreshSecret: generateRefreshSecret(),
    absoluteExpiresAt: new Date(nowMs + REFRESH_ABSOLUTE_TTL_SEC * 1000),
  };
}

/** Authoritative per-request session check against D1/SQLite. */
export async function getActiveSession(
  prisma: PrismaClient,
  sessionId: string,
  nowMs: number,
): Promise<SessionCheck> {
  const session = await prisma.authSession.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!session) return { ok: false, reason: 'missing' };
  if (session.revokedAt) return { ok: false, reason: 'revoked' };
  if (session.absoluteExpiresAt.getTime() <= nowMs) return { ok: false, reason: 'expired' };
  return {
    ok: true,
    sessionId: session.id,
    user: session.user,
    absoluteExpiresAt: session.absoluteExpiresAt,
  };
}

/** Rebind the session synchronizer (CSRF bootstrap on an active session). */
export async function bindSessionCsrf(
  prisma: PrismaClient,
  sessionId: string,
  csrfHash: string,
  nowMs: number,
): Promise<boolean> {
  const updated = await prisma.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { csrfHash, lastUsedAt: new Date(nowMs) },
  });
  return updated.count === 1;
}

export type RotationOutcome =
  | {
      status: 'rotated';
      user: User;
      sessionId: string;
      newRefreshSecret: string;
      absoluteExpiresAt: Date;
    }
  | { status: 'reused'; sessionId: string }
  | { status: 'revoked'; sessionId: string }
  | { status: 'expired'; sessionId: string }
  | { status: 'invalid' };

export interface RotationInput {
  refreshSecret: string;
  csrfHash: string;
  csrf?: { header: string | undefined; cookie: string | undefined };
  clock?: Clock;
}

/**
 * Rotate a refresh credential atomically under the `refresh:<tokenHash>` entity lock.
 * Exactly one concurrent holder of the same credential can succeed; contenders
 * serialize on the lock and observe consumption (reuse).
 */
export async function rotateRefreshCredential(
  prisma: PrismaClient,
  input: RotationInput,
): Promise<RotationOutcome> {
  const nowMs = input.clock ? input.clock() : Date.now();
  const presentedHash = sha256Hex(input.refreshSecret);
  return withEntityLocks([`refresh:${presentedHash}`], async () =>
    prisma.$transaction(async (tx) => {
      const row = await tx.refreshToken.findUnique({
        where: { tokenHash: presentedHash },
        select: { id: true, sessionId: true, consumed: true },
      });
      if (!row) {
        return { status: 'invalid' } as const;
      }
      const persistFamilyRevocation = async (reason: string): Promise<void> => {
        await tx.authSession.update({
          where: { id: row.sessionId },
          data: { revokedAt: new Date(nowMs), revokeReason: reason },
        });
        await tx.refreshToken.updateMany({
          where: { sessionId: row.sessionId, consumed: false },
          data: { consumed: true, consumedAt: new Date(nowMs) },
        });
      };
      if (row.consumed) {
        await persistFamilyRevocation('reuse');
        return { status: 'reused', sessionId: row.sessionId } as const;
      }
      const session = await tx.authSession.findUnique({
        where: { id: row.sessionId },
        include: { user: true },
      });
      if (!session || session.revokedAt) {
        await tx.refreshToken.update({
          where: { id: row.id },
          data: { consumed: true, consumedAt: new Date(nowMs) },
        });
        return { status: 'revoked', sessionId: row.sessionId } as const;
      }
      if (session.absoluteExpiresAt.getTime() <= nowMs) {
        await tx.refreshToken.update({
          where: { id: row.id },
          data: { consumed: true, consumedAt: new Date(nowMs) },
        });
        return { status: 'expired', sessionId: row.sessionId } as const;
      }
      if (input.csrf !== undefined) {
        verifySessionCsrf(input.csrf.header, input.csrf.cookie, session.csrfHash);
      }
      const newSecret = generateRefreshSecret();
      await tx.refreshToken.update({
        where: { id: row.id },
        data: { consumed: true, consumedAt: new Date(nowMs) },
      });
      await tx.refreshToken.create({
        data: { sessionId: session.id, tokenHash: sha256Hex(newSecret) },
      });
      await tx.authSession.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date(nowMs), csrfHash: input.csrfHash },
      });
      return {
        status: 'rotated',
        user: session.user,
        sessionId: session.id,
        newRefreshSecret: newSecret,
        absoluteExpiresAt: session.absoluteExpiresAt,
      } as const;
    }),
  );
}

/** Revoke one session family and consume its outstanding credentials. */
export async function revokeSessionFamily(
  prisma: PrismaClient,
  sessionId: string,
  reason: string,
  nowMs: number,
): Promise<number> {
  const updated = await prisma.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date(nowMs), revokeReason: reason },
  });
  await prisma.refreshToken.updateMany({
    where: { sessionId, consumed: false },
    data: { consumed: true, consumedAt: new Date(nowMs) },
  });
  return updated.count;
}

/** Revoke every session family of a user (logout-all). */
export async function revokeAllUserSessions(
  prisma: PrismaClient,
  userId: string,
  reason: string,
  nowMs: number,
): Promise<string[]> {
  const sessions = await prisma.authSession.findMany({
    where: { userId, revokedAt: null },
    select: { id: true },
  });
  const ids = sessions.map((s) => s.id);
  if (ids.length === 0) return ids;
  await prisma.authSession.updateMany({
    where: { id: { in: ids } },
    data: { revokedAt: new Date(nowMs), revokeReason: reason },
  });
  await prisma.refreshToken.updateMany({
    where: { sessionId: { in: ids }, consumed: false },
    data: { consumed: true, consumedAt: new Date(nowMs) },
  });
  return ids;
}

/** Map a Prisma unique violation to the public conflict shape. */
export function mapUniqueViolation(err: unknown): ApiError | null {
  const target =
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
      ? ((err as { meta?: { target?: unknown } }).meta?.target as string[] | undefined)
      : undefined;
  if (!target) return null;
  if (target.includes('nationalIdFingerprint'))
    return new ApiError(409, 'NATIONAL_ID_TAKEN', 'National ID is already registered.', {
      field: 'nationalId',
    });
  if (target.includes('email'))
    return new ApiError(409, 'EMAIL_TAKEN', 'Email is already registered.');
  if (target.includes('phone'))
    return new ApiError(409, 'PHONE_TAKEN', 'Phone is already registered.');
  return new ApiError(409, 'EMAIL_TAKEN', 'Account already exists.');
}
