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

/** Explicit 2026-10-11 owner exception: exactly these three initial release admins. */
export const RELEASE_ADMIN_NAMES = ['AliIbrahim', 'SeifWaleed', 'AbdallahTaha'] as const;

export async function bootstrapReleaseAdmins(
  inputs: Array<{ email: unknown; phone: unknown; password: unknown }>,
  deps: BootstrapDeps,
): Promise<void> {
  if (inputs.length !== RELEASE_ADMIN_NAMES.length) throw new Error('Exactly three identities required');
  const normalized = inputs.map((input, index) => ({
    displayName: RELEASE_ADMIN_NAMES[index],
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
    password: validatePassword(input.password),
  }));
  if (new Set(normalized.map((input) => input.email)).size !== 3 ||
      new Set(normalized.map((input) => input.phone)).size !== 3) {
    throw new Error('Distinct identities required');
  }
  const records: Array<{ displayName: string; email: string; phone: string; passwordHash: string; role: 'ADMIN' }> = [];
  for (const input of normalized) {
    const { password, ...identity } = input;
    records.push({ ...identity, passwordHash: await hashPassword(password, deps.argon2), role: 'ADMIN' as const });
  }
  await deps.prisma.$transaction(async (tx) => {
    // Share the first-admin lock: concurrent ordinary/batch bootstrap cannot both win.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FIRST_ADMIN_LOCK})`;
    if (await tx.user.count() !== 0) throw new Error('Fresh release database required');
    for (const record of records) await tx.user.create({ data: record });
  });
}

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
