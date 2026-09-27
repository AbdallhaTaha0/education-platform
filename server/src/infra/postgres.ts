import { Pool, type PoolConfig } from 'pg';
import { getLogger } from '../logger.js';
import { redactUrlForLog } from '../config.js';
import type { DependencyCheck } from './checks.js';

export function createPostgresPool(databaseUrl: string): Pool {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  } satisfies PoolConfig);
  pool.on('error', (err) => {
    // Driver-level details stay server-side; never forwarded to responses.
    getLogger().error({ err, db: redactUrlForLog(databaseUrl) }, 'postgres pool error');
  });
  return pool;
}

/** Liveness of the query path: SELECT 1 against platform PostgreSQL. */
export async function checkPostgres(pool: Pool): Promise<DependencyCheck> {
  const started = Date.now();
  try {
    await pool.query('SELECT 1');
    return { status: 'up', latencyMs: Date.now() - started };
  } catch (err) {
    getLogger().warn({ err }, 'postgres readiness check failed');
    return { status: 'down', latencyMs: Date.now() - started };
  }
}

export async function closePostgres(pool: Pool): Promise<void> {
  await pool.end();
}
