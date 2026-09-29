import { Prisma } from '@prisma/client';
import type { TxClient } from './types.js';

/** Row-level lock for course-scoped mutations (transitions/reorder/archive). */
export async function lockCourseRow(tx: TxClient, courseId: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SELECT id FROM "Course" WHERE id = ${courseId} FOR UPDATE`);
}

/** Transactional advisory lock for deletion coordination. */
export function deletionAdvisoryKey(targetType: string, targetId: string): string {
  return `catalog-deletion:${targetType}:${targetId}`;
}

export async function advisoryLock(tx: TxClient, key: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
}
