/**
 * Logout durability at the service boundary with stubbed persistence:
 * a database revocation failure must propagate (never resolve success),
 * while a credential-less logout performs no database work at all.
 */
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { describe, expect, it } from 'vitest';
import { logout, type IdentityContext } from '../../src/modules/identity/service.js';

const auth = {
  secret: 'test-secret-that-is-long-enough-32',
  issuer: 'edu-platform-test',
  audience: 'edu-platform-test-web',
  allowedOrigins: ['http://localhost:8080'],
  cookieSecure: false,
  argon2: { memoryKb: 8192, timeCost: 2, parallelism: 1 },
};

function stubCtx(prisma: unknown): IdentityContext {
  return { prisma: prisma as PrismaClient, redis: {} as Redis, auth };
}

describe('logout durability', () => {
  it('propagates a PostgreSQL revocation failure instead of succeeding', async () => {
    const ctx = stubCtx({
      refreshToken: {
        findUnique: async () => ({ sessionId: 'sess-1' }),
      },
      authSession: {
        updateMany: async () => {
          throw new Error('database unavailable');
        },
      },
    });
    await expect(
      logout(ctx, { refreshSecret: 'presented', accessSessionId: undefined }),
    ).rejects.toThrow('database unavailable');
  });

  it('returns clearing cookies without touching the database when no session is identified', async () => {
    const calls: string[] = [];
    const ctx = stubCtx({
      refreshToken: {
        findUnique: async () => {
          calls.push('findUnique');
          return null;
        },
      },
    });
    const cleared = await logout(ctx, {
      refreshSecret: 'unknown-secret',
      accessSessionId: undefined,
    });
    expect(calls).toEqual(['findUnique']);
    expect(cleared.some((h) => h.startsWith('edu_access=') && h.includes('Max-Age=0'))).toBe(true);
  });
});
