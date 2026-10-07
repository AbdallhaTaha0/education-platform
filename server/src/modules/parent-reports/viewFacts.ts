/**
 * Typed readers over agent 1's fixed M10 tracking tables. Platform code never
 * writes these tables (agent 1 owns telemetry writes) and never touches DRM
 * persistence; it only reads frozen facts via parameterized raw SQL so the
 * module works before Prisma delegates are regenerated.
 *
 * Frozen contract (m10-parallel-contract.md):
 *   M10VideoViewSession: id, studentId, courseId, lessonId, mediaAssetId
 *     (platform MediaMapping.id identity), startedAt, countedAt (nullable),
 *     playedMilliseconds. One row per logical playback start/restart; countedAt
 *     is set exactly once when the accepted 30s threshold is crossed.
 *   M10ViewTrackingState: id='global', startedAt. A missing state row means
 *     tracking coverage was never activated — counts are UNKNOWN, not zero.
 */
import { Prisma, type PrismaClient } from '@prisma/client';

export interface SessionRow {
  courseId: string;
  lessonId: string;
  mediaAssetId: string;
  startedAt: Date;
  countedAt: Date;
}

/** Minimal read client: works with PrismaClient and a $transaction client. */
export type RawReaderClient = Pick<PrismaClient, '$queryRaw'>;

export interface ViewFactsReader {
  /** null when tracking was never activated (pre-coverage periods are unknown). */
  trackingStartedAt(): Promise<Date | null>;
  /** Per-student totals for a course: counted sessions + latest counted-after instant. */
  courseTotals(
    studentIds: string[],
    courseId: string,
  ): Promise<Map<string, { totalViews: number; lastViewedAt: Date | null }>>;
  /** Per-lesson media-version-aware counted-session totals for one student. */
  lessonMediaTotals(
    studentId: string,
    courseId: string,
    lessonIds: string[],
  ): Promise<Map<string, Array<{ mediaAssetId: string; totalViews: number; lastViewedAt: Date | null }>>>;
  /** All counted sessions for a student across given courses, measured by the
   * frozen countedAt transition, half-open: countedAt >= start AND countedAt < end. */
  sessionsInWindow(studentId: string, courseIds: string[], start: Date, end: Date): Promise<SessionRow[]>;
  /** Every counted session for a student within one course, by lesson set. */
  sessionsForLessons(studentId: string, courseId: string, lessonIds: string[]): Promise<SessionRow[]>;
}

/** Windows and rankings use the frozen countedAt (threshold transition) event
 * time, never startedAt. This aligns with agent 1's aggregate contract. */
export function postgresViewFactsReader(db: RawReaderClient): ViewFactsReader {
  return {
    async trackingStartedAt() {
      const rows = await db.$queryRaw<Array<{ startedAt: Date }>>`
        SELECT "startedAt" FROM "M10ViewTrackingState" WHERE id = 'global' LIMIT 1`;
      return rows[0]?.startedAt ?? null;
    },
    async courseTotals(studentIds, courseId) {
      if (studentIds.length === 0) return new Map();
      const rows = await db.$queryRaw<
        Array<{ studentId: string; totalViews: bigint; lastViewedAt: Date | null }>
      >`
        SELECT "studentId", COUNT(*)::bigint AS "totalViews", MAX("countedAt") AS "lastViewedAt"
        FROM "M10VideoViewSession"
        WHERE "courseId" = ${courseId} AND "countedAt" IS NOT NULL
          AND "studentId" IN (${Prisma.join(studentIds)})
        GROUP BY "studentId"`;
      const out = new Map<string, { totalViews: number; lastViewedAt: Date | null }>();
      for (const r of rows)
        out.set(r.studentId, { totalViews: Number(r.totalViews), lastViewedAt: r.lastViewedAt });
      return out;
    },
    async lessonMediaTotals(studentId, courseId, lessonIds) {
      if (lessonIds.length === 0) return new Map();
      const rows = await db.$queryRaw<
        Array<{ lessonId: string; mediaAssetId: string; totalViews: bigint; lastViewedAt: Date | null }>
      >`
        SELECT "lessonId", "mediaAssetId", COUNT(*)::bigint AS "totalViews", MAX("countedAt") AS "lastViewedAt"
        FROM "M10VideoViewSession"
        WHERE "studentId" = ${studentId} AND "courseId" = ${courseId} AND "countedAt" IS NOT NULL
          AND "lessonId" IN (${Prisma.join(lessonIds)})
        GROUP BY "lessonId", "mediaAssetId"`;
      const out = new Map<string, Array<{ mediaAssetId: string; totalViews: number; lastViewedAt: Date | null }>>();
      for (const r of rows) {
        const arr = out.get(r.lessonId) ?? [];
        arr.push({ mediaAssetId: r.mediaAssetId, totalViews: Number(r.totalViews), lastViewedAt: r.lastViewedAt });
        out.set(r.lessonId, arr);
      }
      return out;
    },
    async sessionsInWindow(studentId, courseIds, start, end) {
      if (courseIds.length === 0) return [];
      return db.$queryRaw<SessionRow[]>`
        SELECT "courseId", "lessonId", "mediaAssetId", "startedAt", "countedAt"
        FROM "M10VideoViewSession"
        WHERE "studentId" = ${studentId} AND "courseId" IN (${Prisma.join(courseIds)})
          AND "countedAt" IS NOT NULL AND "countedAt" >= ${start} AND "countedAt" < ${end}`;
    },
    async sessionsForLessons(studentId, courseId, lessonIds) {
      if (lessonIds.length === 0) return [];
      return db.$queryRaw<SessionRow[]>`
        SELECT "courseId", "lessonId", "mediaAssetId", "startedAt", "countedAt"
        FROM "M10VideoViewSession"
        WHERE "studentId" = ${studentId} AND "courseId" = ${courseId} AND "countedAt" IS NOT NULL
          AND "lessonId" IN (${Prisma.join(lessonIds)})`;
    },
  };
}
