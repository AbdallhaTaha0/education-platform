import type { PrismaClient } from '@prisma/client';
import { withEntityLocks } from '../../infra/locks-do.js';
import { ApiError } from '../identity/errors.js';
import { lockCourseRow, lockCourseRowShared } from './locks.js';
import type { TxClient } from './types.js';
import { assertUuid } from './validation.js';

export async function withCourseLock<T>(
  prisma: PrismaClient,
  courseId: string,
  fn: (tx: TxClient) => Promise<T>,
): Promise<T> {
  assertUuid(courseId, 'courseId');
  const owner = await prisma.course.findUnique({
    where: { id: courseId },
    select: { revisionOwnerId: true },
  });
  const keys = owner?.revisionOwnerId
    ? [`course:${owner.revisionOwnerId}`, `course:${courseId}`]
    : [`course:${courseId}`];
  return withEntityLocks(keys, () =>
    prisma.$transaction(
      async (tx) => {
        const currentOwner = await tx.course.findUnique({
          where: { id: courseId },
          select: { revisionOwnerId: true },
        });
        if (currentOwner?.revisionOwnerId) {
          await lockCourseRow(tx, currentOwner.revisionOwnerId);
          const live = await tx.course.findUniqueOrThrow({
            where: { id: currentOwner.revisionOwnerId },
          });
          if (live.deletionRequestedAt) {
            throw new ApiError(409, 'DELETION_PENDING', 'The published course is being deleted.');
          }
        }
        await lockCourseRow(tx, courseId);
        return fn(tx);
      },
      { timeout: 30000 },
    ),
  );
}

/** Purchase-side counterpart: serializes with course mutations via MutexDurableObject. */
export async function withCourseReadLock<T>(
  prisma: PrismaClient,
  courseId: string,
  fn: (tx: TxClient) => Promise<T>,
): Promise<T> {
  assertUuid(courseId, 'courseId');
  return prisma.$transaction(async (tx) => {
    await lockCourseRowShared(tx, courseId);
    return fn(tx);
  });
}

export async function courseIdForSection(prisma: PrismaClient, sectionId: string): Promise<string> {
  assertUuid(sectionId, 'sectionId');
  const section = await prisma.courseSection.findUnique({
    where: { id: sectionId },
    select: { courseId: true },
  });
  if (section === null) throw new ApiError(404, 'NOT_FOUND', 'Section not found.');
  return section.courseId;
}

export async function courseIdForLesson(prisma: PrismaClient, lessonId: string): Promise<string> {
  assertUuid(lessonId, 'lessonId');
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { section: { select: { courseId: true } } },
  });
  if (lesson === null) throw new ApiError(404, 'NOT_FOUND', 'Lesson not found.');
  return lesson.section.courseId;
}

export async function courseIdForPlan(prisma: PrismaClient, planId: string): Promise<string> {
  assertUuid(planId, 'planId');
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
    select: { courseId: true },
  });
  if (plan === null) throw new ApiError(404, 'NOT_FOUND', 'Plan not found.');
  return plan.courseId;
}
