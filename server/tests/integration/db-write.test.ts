import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('sqlite/d1 write smoke (isolated test database)', () => {
  it('can create, write to, and query a transient table', async () => {
    await prisma.$executeRawUnsafe(
      'CREATE TEMP TABLE IF NOT EXISTS m1_migration_smoke (id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT NOT NULL)',
    );
    await prisma.$executeRawUnsafe(
      "INSERT INTO m1_migration_smoke (note) VALUES ('foundation-ok')",
    );
    const rows = await prisma.$queryRawUnsafe<Array<{ count: number | bigint }>>(
      'SELECT COUNT(*) AS count FROM m1_migration_smoke',
    );
    expect(Number(rows[0]?.count ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it('can query core schema tables after migration', async () => {
    const count = await prisma.user.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
