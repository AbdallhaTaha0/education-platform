import type { PrismaClient } from '@prisma/client';
import { hashPassword, type Argon2Params } from './password.js';
import {
  normalizeDisplayName,
  normalizeEmail,
  normalizePhone,
  validatePassword,
} from './validation.js';
import { toSafeUser, type SafeUser } from './store.js';
import { ApiError } from './errors.js';

/** Advisory lock key serializing first-admin creation inside one database. */
const FIRST_ADMIN_LOCK = 424281;

export interface BootstrapInput {
  displayName: unknown;
  email: unknown;
  phone: unknown;
  password: unknown;
}

export interface BootstrapDeps {
  prisma: PrismaClient;
  argon2: Argon2Params;
}

/**
 * Create the first ADMIN only when none exists. Concurrency-safe: concurrent
 * attempts serialize on a transaction-scoped advisory lock, so at most one
 * succeeds and the rest fail with ADMIN_EXISTS. Never logs credentials.
 */
export async function bootstrapFirstAdmin(
  input: BootstrapInput,
  deps: BootstrapDeps,
): Promise<SafeUser> {
  const displayName = normalizeDisplayName(input.displayName);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const password = validatePassword(input.password);
  const passwordHash = await hashPassword(password, deps.argon2);

  return deps.prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FIRST_ADMIN_LOCK})`;
    const existing = await tx.user.count({ where: { role: 'ADMIN' } });
    if (existing > 0) {
      throw new ApiError(409, 'ADMIN_EXISTS', 'An admin already exists.');
    }
    const created = await tx.user.create({
      data: { email, phone, displayName, passwordHash, role: 'ADMIN' },
    });
    return toSafeUser(created);
  });
}
