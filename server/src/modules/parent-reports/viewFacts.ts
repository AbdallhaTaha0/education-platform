/**
 * Typed readers over M10 tracking tables. Works with both SQLite/D1 and Prisma.
 */
import { Prisma, type PrismaClient } from '@prisma/client';

export interface SessionRow {
  courseId: string;
  lessonId: string;
  mediaAssetId: string;
  startedAt: Date;
  countedAt: Date;
}

export type RawReaderClient = Pick<PrismaClient, '$queryRaw'>;

export interface ViewFactsReader {
  trackingStartedAt(): Promise<Date | null>;
  courseTotals(
    studentIds: string[],
    courseId: string,
  ): Promise<Map<string, { totalViews: number; lastViewedAt: Date | null }>>;
  lessonMediaTotals(
    studentId: string,
    courseId: string,
    lessonIds: string[],
  ): Promise<
    Map<string, Array<{ mediaAssetId: string; totalViews: number; lastViewedAt: Date | null }>>
  >;
  sessionsInWindow(
    studentId: string,
    courseIds: string[],
    start: Date,
    end: Date,
  ): Promise<SessionRow[]>;
  sessionsForLessons(
    studentId: string,
    courseId: string,
    lessonIds: string[],
  ): Promise<SessionRow[]>;
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value : new Date(value);
}

function normalizeSession(r: {
  courseId: string;
  lessonId: string;
  mediaAssetId: string;
  startedAt: Date | string | number;
  countedAt: Date | string | number;
}): SessionRow {
  return {
    courseId: r.courseId,
    lessonId: r.lessonId,
    mediaAssetId: r.mediaAssetId,
    startedAt: toDate(r.startedAt)!,
    countedAt: toDate(r.countedAt)!,
  };
}

export function postgresViewFactsReader(db: RawReaderClient): ViewFactsReader {
  return {
    async trackingStartedAt() {
      const rows = await db.$queryRaw<Array<{ startedAt: Date | string | number }>>`
        SELECT "startedAt" FROM "M10ViewTrackingState" WHERE id = 'global' LIMIT 1`;
      return toDate(rows[0]?.startedAt);
    },
    async courseTotals(studentIds, courseId) {
      if (studentIds.length === 0) return new Map();
      const rows = await db.$queryRaw<
        Array<{ studentId: string; totalViews: number | bigint; lastViewedAt: Date | string | number | null }>
      >`
        SELECT "studentId", CAST(COUNT(*) AS INTEGER) AS "totalViews", MAX("countedAt") AS "lastViewedAt"
        FROM "M10VideoViewSession"
        WHERE "courseId" = ${courseId} AND "countedAt" IS NOT NULL
          AND "studentId" IN (${Prisma.join(studentIds)})
        GROUP BY "studentId"`;
      const out = new Map<string, { totalViews: number; lastViewedAt: Date | null }>();
      for (const r of rows)
        out.set(r.studentId, {
          totalViews: Number(r.totalViews),
          lastViewedAt: toDate(r.lastViewedAt),
        });
      return out;
    },
    async lessonMediaTotals(studentId, courseId, lessonIds) {
      if (lessonIds.length === 0) return new Map();
      const rows = await db.$queryRaw<
        Array<{
          lessonId: string;
          mediaAssetId: string;
          totalViews: number | bigint;
          lastViewedAt: Date | string | number | null;
        }>
      >`
        SELECT "lessonId", "mediaAssetId", CAST(COUNT(*) AS INTEGER) AS "totalViews", MAX("countedAt") AS "lastViewedAt"
        FROM "M10VideoViewSession"
        WHERE "studentId" = ${studentId} AND "courseId" = ${courseId} AND "countedAt" IS NOT NULL
          AND "lessonId" IN (${Prisma.join(lessonIds)})
        GROUP BY "lessonId", "mediaAssetId"`;
      const out = new Map<
        string,
        Array<{ mediaAssetId: string; totalViews: number; lastViewedAt: Date | null }>
      >();
      for (const r of rows) {
        const arr = out.get(r.lessonId) ?? [];
        arr.push({
          mediaAssetId: r.mediaAssetId,
          totalViews: Number(r.totalViews),
          lastViewedAt: toDate(r.lastViewedAt),
        });
        out.set(r.lessonId, arr);
      }
      return out;
    },
    async sessionsInWindow(studentId, courseIds, start, end) {
      if (courseIds.length === 0) return [];
      const rows = await db.$queryRaw<
        Array<{
          courseId: string;
          lessonId: string;
          mediaAssetId: string;
          startedAt: Date | string | number;
          countedAt: Date | string | number;
        }>
      >`
        SELECT "courseId", "lessonId", "mediaAssetId", "startedAt", "countedAt"
        FROM "M10VideoViewSession"
        WHERE "studentId" = ${studentId} AND "courseId" IN (${Prisma.join(courseIds)})
          AND "countedAt" IS NOT NULL AND "countedAt" >= ${start} AND "countedAt" < ${end}`;
      return rows.map(normalizeSession);
    },
    async sessionsForLessons(studentId, courseId, lessonIds) {
      if (lessonIds.length === 0) return [];
      const rows = await db.$queryRaw<
        Array<{
          courseId: string;
          lessonId: string;
          mediaAssetId: string;
          startedAt: Date | string | number;
          countedAt: Date | string | number;
        }>
      >`
        SELECT "courseId", "lessonId", "mediaAssetId", "startedAt", "countedAt"
        FROM "M10VideoViewSession"
        WHERE "studentId" = ${studentId} AND "courseId" = ${courseId} AND "countedAt" IS NOT NULL
          AND "lessonId" IN (${Prisma.join(lessonIds)})`;
      return rows.map(normalizeSession);
    },
  };
}
