/**
 * Trusted binding resolution (M5).
 *
 * Every protected route resolves the course/lesson/media triple from platform
 * records. The browser contributes only a course slug or a lesson id; lesson
 * ownership, external asset identity, media readiness and subscription dates are
 * always read from PostgreSQL. Nothing from the request body, query string or
 * header is trusted as identity.
 */
import type { PrismaClient } from '@prisma/client';
import { LearningError } from '../errors.js';
import type { LearningBinding } from '../types.js';
import { evaluateEntitlement, isLearnableStatus } from './entitlement.js';
import { assertLessonUnlocked, lessonLocks } from '../../assessments/progression.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new LearningError('LESSON_NOT_FOUND');
  }
  return value;
}

export interface ResolveOptions {
  prisma: PrismaClient;
  studentId: string;
  /** Either a course slug or a course id; resolved server-side. */
  courseRef: string;
  /** Optional lesson id; when absent only the course is resolved. */
  lessonId?: string;
  nowMs: number;
}

export interface ResolvedCourse {
  courseId: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  expiresAt: Date | null;
  entitled: boolean;
  status: string;
}

export interface ResolvedLesson extends LearningBinding {
  titleAr: string;
  titleEn: string;
  position: number;
  mediaStatus: string | null;
}

/** Resolve a course the student may learn, enforcing entitlement. */
export async function resolveCourse(opts: ResolveOptions): Promise<ResolvedCourse> {
  const course = await findCourse(opts.prisma, opts.courseRef);
  if (course === null || course.deletionRequestedAt !== null || !isLearnableStatus(course.status)) {
    // A caller must not be able to distinguish "no such course" from
    // "not learnable", so both surface the same safe category.
    throw new LearningError('LESSON_NOT_FOUND');
  }
  const subscriptions = await opts.prisma.subscription.findMany({
    where: { studentId: opts.studentId },
    select: { courseId: true, startsAt: true, expiresAt: true },
  });
  const decision = evaluateEntitlement(subscriptions, course.id, opts.nowMs);
  if (!decision.allowed) {
    throw new LearningError(decision.reason);
  }
  return {
    courseId: course.id,
    slug: course.slug,
    titleAr: course.titleAr,
    titleEn: course.titleEn,
    descriptionAr: course.descriptionAr,
    descriptionEn: course.descriptionEn,
    expiresAt: decision.expiresAt,
    entitled: true,
    status: course.status,
  };
}

async function findCourse(prisma: PrismaClient, ref: string) {
  const byId = UUID_RE.test(ref) ? await prisma.course.findUnique({ where: { id: ref } }) : null;
  if (byId !== null) return byId;
  return prisma.course.findUnique({ where: { slug: ref } });
}

/**
 * Resolve a lesson inside a course and require a usable media mapping.
 * Cross-course lesson ids cannot be substituted: the lesson must belong to the
 * resolved course, and its media must be READY with an external asset id.
 */
export async function resolveLesson(
  prisma: PrismaClient,
  course: ResolvedCourse,
  lessonId: string,
  studentId: string,
): Promise<ResolvedLesson> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: assertUuid(lessonId, 'lessonId') },
    include: { media: true, section: { select: { courseId: true } } },
  });
  if (lesson === null || lesson.section.courseId !== course.courseId) {
    throw new LearningError('LESSON_NOT_FOUND');
  }
  await assertLessonUnlocked(prisma, studentId, course.courseId, lesson.id);
  if (
    lesson.media === null ||
    lesson.media.status !== 'READY' ||
    lesson.media.externalAssetId === ''
  ) {
    throw new LearningError('MEDIA_NOT_READY');
  }
  return {
    studentId,
    courseId: course.courseId,
    courseSlug: course.slug,
    lessonId: lesson.id,
    externalAssetId: lesson.media.externalAssetId,
    externalAssetIdInternal: lesson.media.assetId,
    titleAr: lesson.titleAr,
    titleEn: lesson.titleEn,
    position: lesson.position,
    mediaStatus: lesson.media.status,
  };
}

/** Ordered protected outline. Media ids and readiness are included only
 * because this payload is already behind an entitlement check. */
export async function loadOutline(
  prisma: PrismaClient,
  courseId: string,
  studentId: string,
): Promise<
  Array<{
    sectionId: string;
    titleAr: string;
    titleEn: string;
    position: number;
    lessons: Array<{
      lessonId: string;
      titleAr: string;
      titleEn: string;
      position: number;
      playable: boolean;
      locked: boolean;
      blockingAssessmentIds: string[];
      completed: boolean;
      resumePositionSeconds: number;
    }>;
  }>
> {
  const sections = await prisma.courseSection.findMany({
    where: { courseId },
    orderBy: { position: 'asc' },
    include: {
      lessons: {
        orderBy: { position: 'asc' },
        include: { media: { select: { status: true, externalAssetId: true } } },
      },
    },
  });
  const progress = await prisma.lessonProgress.findMany({
    where: { studentId, courseId },
    select: { lessonId: true, positionSeconds: true, completedAt: true },
  });
  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
  const locks = await lessonLocks(prisma, studentId, courseId);
  return sections.map((section) => ({
    sectionId: section.id,
    titleAr: section.titleAr,
    titleEn: section.titleEn,
    position: section.position,
    lessons: section.lessons.map((lesson) => {
      const p = byLesson.get(lesson.id);
      return {
        lessonId: lesson.id,
        titleAr: lesson.titleAr,
        titleEn: lesson.titleEn,
        position: lesson.position,
        playable: !locks.get(lesson.id)?.length && lesson.media?.status === 'READY' && lesson.media.externalAssetId !== '',
        locked: !!locks.get(lesson.id)?.length,
        blockingAssessmentIds: locks.get(lesson.id) ?? [],
        completed: p?.completedAt !== null && p?.completedAt !== undefined,
        resumePositionSeconds: p?.completedAt ? 0 : (p?.positionSeconds ?? 0),
      };
    }),
  }));
}
