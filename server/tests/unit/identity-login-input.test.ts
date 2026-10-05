import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { login, type IdentityContext } from '../../src/modules/identity/service.js';
import { PASSWORD_MAX_LENGTH } from '../../src/modules/identity/validation.js';

const auth = {
  secret: 'test-secret-that-is-long-enough-32',
  issuer: 'edu-platform-test', audience: 'edu-platform-test-web',
  allowedOrigins: ['http://localhost:8080'], cookieSecure: false,
  argon2: { memoryKb: 8192, timeCost: 2, parallelism: 1 },
};

describe('login password resource bounds', () => {
  it.each(['student@example.test', '+201000000001'])('rejects an oversized password before identity lookup: %s', async (identifier) => {
    const findUnique = vi.fn();
    const ctx: IdentityContext = { prisma: { user: { findUnique } } as unknown as PrismaClient, redis: {} as Redis, auth };
    await expect(login(ctx, { identifier, password: 'x'.repeat(PASSWORD_MAX_LENGTH + 1) }, 'synthetic-csrf')).rejects.toMatchObject({
      status: 401, code: 'INVALID_CREDENTIALS', message: 'Email/phone or password is incorrect.',
    });
    expect(findUnique).not.toHaveBeenCalled();
  });
});
