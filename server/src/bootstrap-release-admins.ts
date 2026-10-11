/** Owner-approved fresh-release bootstrap. Never run automatically at startup. */
import { PrismaClient } from '@prisma/client';
import { bootstrapReleaseAdmins } from './modules/identity/bootstrap.js';
import { PRODUCTION_ARGON2 } from './modules/identity/password.js';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const inputs = [1, 2, 3].map((index) => ({
      email: process.env[`RELEASE_ADMIN_${index}_EMAIL`],
      phone: process.env[`RELEASE_ADMIN_${index}_PHONE`],
      password: process.env[`RELEASE_ADMIN_${index}_PASSWORD`],
    }));
    await bootstrapReleaseAdmins(inputs, { prisma, argon2: PRODUCTION_ARGON2 });
    console.log(JSON.stringify({ ok: true, adminsCreated: 3 }));
  } catch {
    // Do not print inputs, database URLs, constraint details or secret-bearing errors.
    console.error('Release admin setup refused: validate all three identities and passwords; database must have no users.');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
void main();
