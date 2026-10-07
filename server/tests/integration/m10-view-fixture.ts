/**
 * TEST-ONLY fixture for agent 1's frozen M10 tracking tables.
 *
 * Labeled: tests insert telemetry rows directly; agent 2's production code
 * never writes these tables. Column semantics match the real migration
 * 20261007100000_m10_view_tracking, which this fixture mirrors for the
 * isolated-phase run. When the real migration is applied (it now is, in the
 * test stack), ensureM10ViewTablesForTest detects the table and does NOT
 * create a substitute.
 */
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export async function ensureM10ViewTablesForTest(prisma: PrismaClient): Promise<void> {
  // The real agent-1 migration owns these tables; nothing to create.
  const existing = await prisma.$queryRawUnsafe<Array<{ reg: string | null }>>(
    `SELECT to_regclass('"M10VideoViewSession"')::text AS reg`,
  );
  if (existing[0]?.reg) return;
  throw new Error('The real M10 migration must be applied before report integration tests.');
}

export async function resetM10ViewFactsForTest(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM "M10VideoViewSession"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "M10ViewTrackingState"`);
}

export async function setTrackingStartedAt(prisma: PrismaClient, startedAt: Date): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "M10ViewTrackingState"`;
  await prisma.$executeRaw`INSERT INTO "M10ViewTrackingState" ("id", "startedAt") VALUES ('global', ${startedAt.toISOString()}::timestamp)`;
}

export async function insertViewSession(
  prisma: PrismaClient,
  row: {
    studentId: string;
    courseId: string;
    lessonId: string;
    mediaAssetId: string;
    startedAt: Date;
    countedAt?: Date | null;
    playedMilliseconds?: number;
  },
): Promise<void> {
  const counted = row.countedAt === undefined ? new Date(row.startedAt.getTime() + 30_000) : row.countedAt;
  await prisma.$executeRaw`INSERT INTO "M10VideoViewSession" ("id", "studentId", "courseId", "lessonId", "mediaAssetId", "mediaExternalAssetId", "playbackReferenceId", "startedAt", "countedAt", "playedMilliseconds")
     VALUES (${randomUUID()}, ${row.studentId}, ${row.courseId}, ${row.lessonId}, ${row.mediaAssetId}, ${randomUUID()}, ${randomUUID()}, ${row.startedAt.toISOString()}::timestamp, ${counted === null ? null : counted.toISOString()}::timestamp, ${row.playedMilliseconds ?? 30_000})`;
}
