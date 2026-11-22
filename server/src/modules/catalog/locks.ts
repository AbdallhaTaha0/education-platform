import type { TxClient } from './types.js';

/**
 * Course/deletion lock helpers. On Cloudflare D1 (SQLite), row/advisory locks
 * are enforced externally by `withEntityLocks` (MutexDurableObject / LocalAsyncMutex)
 * before entering the Prisma transaction. These functions remain exported as
 * compatibility no-ops so callers that already hold the entity lock keep working.
 */
export async function lockCourseRow(_tx: TxClient, _courseId: string): Promise<void> {
  // Enforced by withEntityLocks([`course:${courseId}`]).
}

export async function lockCourseRowShared(_tx: TxClient, _courseId: string): Promise<void> {
  // Enforced by withEntityLocks([`course:${courseId}`]).
}

export function deletionAdvisoryKey(targetType: string, targetId: string): string {
  return `catalog-deletion:${targetType}:${targetId}`;
}

export async function advisoryLock(_tx: TxClient, _key: string): Promise<void> {
  // Enforced by withEntityLocks([`advisory:${key}`]).
}
