/**
 * Explicit own-session recovery (playback-recovery improvements).
 *
 * Lists only the authenticated student's own bounded platform references with
 * safe course/lesson labels and honest lifecycle state. Never exposes external
 * session ids, tokens, storage URLs or inferred browser names. Platform ACTIVE
 * alone does not prove someone is watching; the UI must say so.
 *
 * Termination reuses the existing owner-checked end operation; there is no
 * force-end-all and no automatic termination on login/tab/retry/reload.
 *
 * Bounded blocker-first ordering: at most ten rows are returned, but rows
 * that can still consume the concurrent-stream slot (ACTIVE, pending
 * termination, or exhausted termination retries) sort before completed
 * history, oldest first. Ten newer completed rows can never hide an older
 * blocker. Honest lifecycle fields are unchanged.
 */
import type { PrismaClient } from '@prisma/client';

export interface OwnSessionView {
  referenceId: string;
  courseSlug: string;
  courseTitleAr: string;
  courseTitleEn: string;
  lessonId: string;
  lessonTitleAr: string;
  lessonTitleEn: string;
  status: string;
  terminationStatus: string | null;
  pendingEndReason: string | null;
  createdAt: string;
  tokenExpiresAt: string;
  sessionExpiresAt: string;
  endedAt: string | null;
}

const MAX_OWN_SESSIONS = 10;

const SESSION_SELECT = {
  id: true,
  status: true,
  terminationStatus: true,
  pendingEndReason: true,
  createdAt: true,
  tokenExpiresAt: true,
  sessionExpiresAt: true,
  endedAt: true,
  courseId: true,
  lessonId: true,
} as const;

export async function listOwnSessions(
  prisma: PrismaClient,
  studentId: string,
): Promise<OwnSessionView[]> {
  // Recoverable first: still ACTIVE, still awaiting termination, or with
  // exhausted termination retries (external state uncertain). Oldest first
  // so the longest-held slot leads.
  const urgent = await prisma.playbackReference.findMany({
    where: {
      studentId,
      OR: [
        { status: 'ACTIVE' },
        { terminationStatus: 'PENDING' },
        { status: 'TERMINATION_FAILED' },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_OWN_SESSIONS,
    select: { ...SESSION_SELECT },
  });
  // Fill the remainder with the most recent other visible history so the
  // bounded shape is preserved.
  const seen = new Set(urgent.map((r) => r.id));
  const rest =
    urgent.length >= MAX_OWN_SESSIONS
      ? []
      : await prisma.playbackReference.findMany({
          where: {
            studentId,
            status: { in: ['ACTIVE', 'ENDED'] },
            id: { notIn: [...seen] },
          },
          orderBy: { createdAt: 'desc' },
          take: MAX_OWN_SESSIONS - urgent.length,
          select: { ...SESSION_SELECT },
        });
  const rows = [...urgent, ...rest];
  if (rows.length === 0) return [];
  const courseIds = [...new Set(rows.map((r) => r.courseId))];
  const lessonIds = [...new Set(rows.map((r) => r.lessonId))];
  const [courses, lessons] = await Promise.all([
    prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, slug: true, titleAr: true, titleEn: true },
    }),
    prisma.lesson.findMany({
      where: { id: { in: lessonIds } },
      select: { id: true, titleAr: true, titleEn: true },
    }),
  ]);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  return rows.map((r) => {
    const course = courseById.get(r.courseId);
    const lesson = lessonById.get(r.lessonId);
    return {
      referenceId: r.id,
      courseSlug: course?.slug ?? '',
      courseTitleAr: course?.titleAr ?? '',
      courseTitleEn: course?.titleEn ?? '',
      lessonId: r.lessonId,
      lessonTitleAr: lesson?.titleAr ?? '',
      lessonTitleEn: lesson?.titleEn ?? '',
      status: r.status,
      terminationStatus: r.terminationStatus,
      pendingEndReason: r.pendingEndReason,
      createdAt: r.createdAt.toISOString(),
      tokenExpiresAt: r.tokenExpiresAt.toISOString(),
      sessionExpiresAt: r.sessionExpiresAt.toISOString(),
      endedAt: r.endedAt ? r.endedAt.toISOString() : null,
    };
  });
}
