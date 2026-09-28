/**
 * Non-interactive one-time first-admin bootstrap.
 *
 * Input arrives ONLY through environment variables (never committed files,
 * image layers, or CLI history captured in reports):
 *   BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL,
 *   BOOTSTRAP_ADMIN_PHONE, BOOTSTRAP_ADMIN_PASSWORD
 *
 * Exit 0 when the first admin is created; exit 1 when an admin already
 * exists or input is invalid. The password is never printed or logged.
 */
import { PrismaClient } from '@prisma/client';
import { bootstrapFirstAdmin } from './modules/identity/bootstrap.js';
import { PRODUCTION_ARGON2 } from './modules/identity/password.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    // eslint-disable-next-line no-console
    console.error(`bootstrap: missing ${name}`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const created = await bootstrapFirstAdmin(
      {
        displayName: required('BOOTSTRAP_ADMIN_NAME'),
        email: required('BOOTSTRAP_ADMIN_EMAIL'),
        phone: required('BOOTSTRAP_ADMIN_PHONE'),
        password: required('BOOTSTRAP_ADMIN_PASSWORD'),
      },
      { prisma, argon2: PRODUCTION_ARGON2 },
    );
    // Safe fields only: id, email, phone, display name, role, timestamps.
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        ok: true,
        user: { id: created.id, email: created.email, phone: created.phone, role: created.role },
      }),
    );
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`bootstrap: failed (${err instanceof Error ? err.message : 'unknown'})`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => process.exit(1));
