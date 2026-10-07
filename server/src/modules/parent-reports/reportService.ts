/**
 * Roster / village aggregation / report generation. Pure TypeScript over the
 * frozen view facts reader + Prisma models. One aggregation contract serves
 * admin detail, period/lifetime aggregates and parent-text generation; no
 * generated report is ever persisted (transient only).
 */
import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../identity/errors.js';
import type { ViewFactsReader } from './viewFacts.js';
import {
  REPORT_DAYS,
  cairoDate,
  weekSections,
  type ParentReportModel,
  type ReportLanguage,
  type ReportType,
} from './text.js';

export const MAX_PAGE = 50;
export const MAX_COURSES_PER_REQUEST = 50;

/** Canonical courses are live copies: working copies/historical rows set
 * revisionOwnerId, and every one of them is hidden. Only revisionOwnerId-null
 * courses outside deletion are roster/reporting candidates. */
// Roster semantics: every one-time membership row for the course, including
// finite/expired and indefinite grants. Historical membership is preserved
// for browseback; *current* generation eligibility is the stricter rule in
// reportServer/reportCourses (entitlement allowed at the cutoff and course
// PUBLISHED). Documented in m10-report-api-contract.md.
export function canonicalCourseWhere() {
  return { revisionOwnerId: null as null, deletionRequestedAt: null as null };
}

/** Existing entitlement rule (learning/access/entitlement.ts): never extended. */
export function entitledSubscriptionWhere(nowMs: number) {
  const now = new Date(nowMs);
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

export interface RosterRow {
  studentId: string;
  name: string;
  guardianContactAvailable: boolean;
  lastViewedAt: Date | null;
  totalViews: number | null;
}

export interface RosterPage {
  students: RosterRow[];
  nextCursor: string | null;
}

interface CursorKey {
  name: string;
  id: string;
}

function encodeCursor(key: CursorKey): string {
  return Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');
}

function decodeCursor(raw: string): CursorKey {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as CursorKey;
    if (typeof parsed.name !== 'string' || parsed.name.length > 400
      || typeof parsed.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id)) throw new Error('bad');
    return parsed;
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  }
}

const LIKE_ESCAPE = /[%_\\]/g;

export function escapeLike(value: string): string {
  return value.replace(LIKE_ESCAPE, (m) => `\\${m}`);
}

/** Bounded keyset roster for one canonical course. One row per actual student
 * membership (package grants and standalone purchases deduplicate to one row),
 * including zero-activity students. Archived/deleted/working-copy courses are
 * unreachable because the course itself is validated canonical first. */
export async function courseRoster(
  prisma: PrismaClient,
  reader: ViewFactsReader,
  args: { courseId: string; limit: number; q?: string; cursor?: string },
): Promise<RosterPage> {
  const course = await prisma.course.findFirst({
    where: { id: args.courseId, ...canonicalCourseWhere() },
    select: { id: true },
  });
  if (!course) throw new ApiError(404, 'NOT_FOUND', 'Course is not available.');

  const cursorKey = args.cursor ? decodeCursor(args.cursor) : null;
  if (cursorKey) {
    const cursorStudent = await prisma.user.findFirst({ where: {
      id: cursorKey.id, role: 'STUDENT', displayName: cursorKey.name,
      subscriptions: { some: { courseId: args.courseId } },
    }, select: { id: true } });
    if (!cursorStudent) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid cursor for this scope.');
  }
  const q = args.q?.trim() ?? '';
  if (q.length > 100) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid search.');
  }
  const rows = await prisma.$queryRaw<Array<{ studentId: string; name: string }>>`
    SELECT s."studentId" AS "studentId", u."displayName" AS "name"
    FROM "Subscription" s
    JOIN "User" u ON u.id = s."studentId"
    WHERE s."courseId" = ${args.courseId}
      AND u.role = 'STUDENT'
      AND (${q} = '' OR u."displayName" ILIKE ${'%' + escapeLike(q) + '%'})
      AND (${cursorKey?.name ?? ''} = '' OR (u."displayName", s."studentId") > (${cursorKey?.name ?? ''}, ${cursorKey?.id ?? ''}))
      GROUP BY s."studentId", u."displayName"
      ORDER BY u."displayName" ASC, s."studentId" ASC
      LIMIT ${args.limit + 1}`;

  const page = rows.slice(0, args.limit);
  const next = rows.length > args.limit ? page[page.length - 1] : null;
  const studentIds = page.map((r) => r.studentId);
  const totals = await reader.courseTotals(studentIds, args.courseId);
  const tracking = await reader.trackingStartedAt();
  const profiles = await prisma.studentProfile.findMany({
    where: { userId: { in: studentIds } },
    select: { userId: true, parentPhone: true },
  });
  const guardianByStudent = new Map(profiles.map((p) => [p.userId, (p.parentPhone ?? '').trim() !== '']));
  return {
    students: page.map((r) => ({
      studentId: r.studentId,
      name: r.name,
      guardianContactAvailable: guardianByStudent.get(r.studentId) ?? false,
      lastViewedAt: totals.get(r.studentId)?.lastViewedAt ?? null,
      totalViews: tracking === null ? null : totals.get(r.studentId)?.totalViews ?? 0,
    })),
    nextCursor: next ? encodeCursor({ name: next.name, id: next.studentId }) : null,
  };
}

/** Coverage flag per lesson. `currentMediaId` is MediaMapping.id of the live
 * mapping. KNOWN: trackable and every recorded version equals the current
 * one. PARTIAL: any recorded version differs from, or no single version
 * covers, the current one (replacement mixing evidence). UNAVAILABLE:
 * tracking never activated or the current mapping itself cannot be compared. */
export function lessonCoverage(
  trackingStartedAt: Date | null,
  mediaVersions: Array<{ mediaAssetId: string }>,
  currentMediaId: string | null,
): 'KNOWN' | 'PARTIAL' | 'UNAVAILABLE' {
  if (trackingStartedAt === null) return 'UNAVAILABLE';
  if (mediaVersions.length === 0) return currentMediaId === null ? 'UNAVAILABLE' : 'KNOWN';
  if (mediaVersions.length > 1) return 'PARTIAL';
  return currentMediaId === null || mediaVersions[0]!.mediaAssetId !== currentMediaId ? 'PARTIAL' : 'KNOWN';
}

/** Per-student per-lesson view detail for one course, cursor-paginated over
 * lessons in canonical order. Media versions are preserved per lesson row. */
export async function studentCourseViews(
  prisma: PrismaClient,
  reader: ViewFactsReader,
  args: { courseId: string; studentId: string; limit: number; cursor?: string },
): Promise<{
  studentId: string;
  courseId: string;
  trackingStartedAt: Date | null;
  lessons: Array<{
    lessonId: string;
    title: { ar: string; en: string };
    /** The platform media-version identity recorded with views: MediaMapping.id. */
    mediaAssetId: string | null;
    totalViews: number;
    lastViewedAt: Date | null;
    coverage: 'KNOWN' | 'PARTIAL' | 'UNAVAILABLE';
    /** Per recorded media version, so historical evidence is never summed
     * under the live version's identity. */
    mediaVersions: Array<{ mediaAssetId: string; totalViews: number; lastViewedAt: Date | null }>;
    currentMediaViews: number | null;
    currentMediaLastViewedAt: Date | null;
  }>;
  nextCursor: string | null;
}> {
  const course = await prisma.course.findFirst({
    where: { id: args.courseId, ...canonicalCourseWhere() },
    select: { id: true },
  });
  if (!course) throw new ApiError(404, 'NOT_FOUND', 'Course is not available.');
  const membership = await prisma.subscription.findFirst({
    where: { studentId: args.studentId, courseId: args.courseId },
    select: { id: true },
  });
  if (!membership) throw new ApiError(404, 'NOT_FOUND', 'Membership is not available.');

  const cursorLessonId = args.cursor ? decodeCursor(args.cursor).id : null;
  // Lessons are paged in canonical order; the cursor row identifies position.
  let cursorRow = null as null | { sectionPosition: number; position: number };
  if (cursorLessonId) {
    const found = await prisma.lesson.findUnique({
      where: { id: cursorLessonId },
      select: { section: { select: { position: true, courseId: true } }, position: true },
    });
    // A cursor from another course is a validation error, never a silent reset.
    if (!found || found.section.courseId !== args.courseId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid cursor for this scope.');
    }
    cursorRow = { sectionPosition: found.section.position, position: found.position };
  }
  const lessons = await prisma.lesson.findMany({
    where: {
      section: { courseId: args.courseId },
      ...(cursorRow
        ? {
            OR: [
              { section: { courseId: args.courseId, position: { gt: cursorRow.sectionPosition } } },
              { section: { courseId: args.courseId, position: cursorRow.sectionPosition }, position: { gt: cursorRow.position } },
            ],
          }
        : {}),
    },
    orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
    take: args.limit + 1,
    include: { section: { select: { position: true } }, media: { select: { id: true, assetId: true, status: true, retiredAt: true } } },
  });
  const page = lessons.slice(0, args.limit);
  const next = lessons.length > args.limit ? page[page.length - 1] : null;
  const lessonIds = page.map((l) => l.id);
  const [trackingStartedAt, byLesson] = await Promise.all([
    reader.trackingStartedAt(),
    reader.lessonMediaTotals(args.studentId, args.courseId, lessonIds),
  ]);
  return {
    studentId: args.studentId,
    courseId: args.courseId,
    trackingStartedAt,
    lessons: page.map((l) => {
      const versions = byLesson.get(l.id) ?? [];
      const totalViews = versions.reduce((n, v) => n + v.totalViews, 0);
      const lastViewedAt = versions.reduce<Date | null>(
        (acc, v) => (v.lastViewedAt && (!acc || v.lastViewedAt > acc) ? v.lastViewedAt : acc),
        null,
      );
      return {
        lessonId: l.id,
        title: { ar: l.titleAr, en: l.titleEn },
        mediaAssetId: l.media?.id ?? null,
        totalViews,
        lastViewedAt,
        coverage: lessonCoverage(trackingStartedAt, versions, l.media?.status === 'READY' && l.media.retiredAt === null ? l.media.id : null),
        mediaVersions: versions,
        currentMediaViews: trackingStartedAt === null || l.media?.status !== 'READY' || l.media.retiredAt !== null ? null : versions.find((v) => v.mediaAssetId === l.media?.id)?.totalViews ?? 0,
        currentMediaLastViewedAt: versions.find((v) => v.mediaAssetId === l.media?.id)?.lastViewedAt ?? null,
      };
    }),
    nextCursor: next ? encodeCursor({ name: '', id: next.id }) : null,
  };
}

/** Currently eligible canonical memberships (incl. package grants), deduped
 * by course; existing entitlement terms only. */
export async function eligibleCoursesForStudent(
  prisma: PrismaClient,
  studentId: string,
  nowMs: number,
): Promise<Array<{ courseId: string; titleAr: string; titleEn: string }>> {
  const subs = await prisma.subscription.findMany({
    where: {
      studentId,
      ...entitledSubscriptionWhere(nowMs),
    },
    select: { courseId: true },
  });
  const courseIds = [...new Set(subs.map((s) => s.courseId))];
  if (courseIds.length === 0) return [];
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds }, ...canonicalCourseWhere(), status: 'PUBLISHED' },
    select: { id: true, titleAr: true, titleEn: true },
  });
  return courses
    .map((c) => ({ courseId: c.id, titleAr: c.titleAr, titleEn: c.titleEn }))
    .sort((a, b) => a.courseId.localeCompare(b.courseId));
}

export async function reportCourses(
  prisma: PrismaClient,
  studentId: string,
  args: { limit: number; cursor?: string; nowMs?: number },
): Promise<{ courses: Array<{ courseId: string; title: { ar: string; en: string } }>; nextCursor: string | null }> {
  const user = await prisma.user.findUnique({ where: { id: studentId }, select: { role: true } });
  if (!user || user.role !== 'STUDENT') throw new ApiError(404, 'NOT_FOUND', 'Student is not available.');
  const list = await eligibleCoursesForStudent(prisma, studentId, args.nowMs ?? Date.now());
  const offset = args.cursor ? decodeOffset(args.cursor) : 0;
  const page = list.slice(offset, offset + args.limit);
  const more = list.length > offset + args.limit;
  return {
    courses: page.map((c) => ({ courseId: c.courseId, title: { ar: c.titleAr, en: c.titleEn } })),
    nextCursor: more ? encodeOffset(offset + args.limit) : null,
  };
}

function decodeOffset(raw: string): number {
  try {
    const n = Number(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!Number.isInteger(n) || n < 0 || n > 100000) throw new Error('bad');
    return n;
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  }
}

function encodeOffset(n: number): string {
  return Buffer.from(String(n), 'utf8').toString('base64url');
}
