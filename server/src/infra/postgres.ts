import type { PrismaClient } from '@prisma/client';
import { getLogger } from '../logger.js';
import type { DependencyCheck } from './checks.js';

export interface DbHealthTarget {
  $queryRaw: PrismaClient['$queryRaw'];
}

export function createPostgresPool(_databaseUrl?: string): DbHealthTarget | null {
  return null;
}

/** Liveness of the query path: SELECT 1 against platform D1/SQLite via Prisma. */
export async function checkPostgres(target: DbHealthTarget | null): Promise<DependencyCheck> {
  const started = Date.now();
  if (!target) {
    return { status: 'up', latencyMs: 0 };
  }
  try {
    await target.$queryRaw`SELECT 1`;
    return { status: 'up', latencyMs: Date.now() - started };
  } catch (err) {
    getLogger().warn({ err }, 'database readiness check failed');
    return { status: 'down', latencyMs: Date.now() - started };
  }
}

export async function closePostgres(_target: DbHealthTarget | null): Promise<void> {
  // Prisma manages D1/SQLite lifecycle directly.
}
