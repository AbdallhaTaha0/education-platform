/**
 * Integration: database WRITE capability smoke test (isolated test DB only).
 *
 * Creates, uses, and drops a transient `m1_migration_smoke` table. This table
 * is intentionally NOT part of Prisma migrations: M1 defines no business
 * tables, and this fixture must never leak into production schema history.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

afterAll(async () => {
  await pool.end();
});

describe('postgres write smoke (isolated test database)', () => {
  it('can create, write to, and drop a transient table', async () => {
    const client = await pool.connect();
    try {
      await client.query('CREATE TEMP TABLE m1_migration_smoke (id SERIAL PRIMARY KEY, note TEXT NOT NULL)');
      await client.query('INSERT INTO m1_migration_smoke (note) VALUES ($1)', ['foundation-ok']);
      const { rows } = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM m1_migration_smoke',
      );
      expect(rows[0]?.count).toBe('1');
    } finally {
      client.release();
    }
  });

  it('migration history table exists (migrate deploy ran)', async () => {
    const { rows } = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM _prisma_migrations WHERE migration_name = '20260927090000_m1_init'",
    );
    expect(rows[0]?.count).toBe('1');
  });
});
